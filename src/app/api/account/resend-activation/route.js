import crypto from "crypto";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  Resend,
} from "resend";

import {
  adminDb,
} from "@/services/firebaseAdmin";

import {
  appCheckErrorResponse,
  requireAppCheck,
} from "@/services/appCheckServer";

export const runtime =
  "nodejs";

const resend =
  new Resend(
    process.env.RESEND_API_KEY
  );

const ACTIVATION_EXPIRY_MINUTES =
  30;

const RESEND_COOLDOWN_SECONDS =
  60;

const RESEND_WINDOW_MS =
  60 * 60 * 1000;

const MAX_RESENDS_PER_WINDOW =
  5;

function hashToken(
  token
) {
  return crypto
    .createHash(
      "sha256"
    )
    .update(
      token
    )
    .digest(
      "hex"
    );
}

function escapeHtml(
  value
) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

function getDate(
  value
) {
  if (!value) {
    return null;
  }

  const date =
    value?.toDate?.() ||
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}

function maskEmail(
  email
) {
  if (
    typeof email !==
      "string" ||
    !email.includes("@")
  ) {
    return "your registered email";
  }

  const [
    localPart,
    domain,
  ] =
    email.split("@");

  const visibleCharacters =
    localPart.slice(
      0,
      2
    );

  const hiddenCharacters =
    "*".repeat(
      Math.max(
        2,
        localPart.length -
          visibleCharacters.length
      )
    );

  return `${visibleCharacters}${hiddenCharacters}@${domain}`;
}

function createRequestError(
  message,
  status,
  code,
  extra = {}
) {
  const error =
    new Error(
      message
    );

  error.status =
    status;

  error.code =
    code;

  Object.assign(
    error,
    extra
  );

  return error;
}

export async function POST(
  request
) {
  try {
    await requireAppCheck(
      request
    );

    const requestBody =
      await request.json();

    const registrationId =
      typeof requestBody
        ?.registrationId ===
      "string"
        ? requestBody
            .registrationId
            .trim()
        : "";

    if (
      !registrationId ||
      registrationId.length >
        200
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "Account setup recovery could not be started.",

          code:
            "invalid-registration",
        },
        {
          status:
            400,
        }
      );
    }

    const registrationReference =
      adminDb
        .collection(
          "pendingRegistrations"
        )
        .doc(
          registrationId
        );

    const activationToken =
      crypto
        .randomBytes(
          32
        )
        .toString(
          "hex"
        );

    const activationTokenHash =
      hashToken(
        activationToken
      );

    const activationExpiresAt =
      new Date(
        Date.now() +
          ACTIVATION_EXPIRY_MINUTES *
            60 *
            1000
      );

    let recipientEmail =
      "";

    let firstName =
      "Student";

    let recipientType =
      "student";

    let oldTokenHash =
      null;

    let oldTokenExpiry =
      null;

    let nextResendCount =
      1;

    let resendWindowStartedAt =
      new Date();

    await adminDb.runTransaction(
      async (
        transaction
      ) => {
        const snapshot =
          await transaction.get(
            registrationReference
          );

        if (
          !snapshot.exists
        ) {
          throw createRequestError(
            "Account setup recovery could not be started.",
            404,
            "registration-not-found"
          );
        }

        const registration =
          snapshot.data();

        if (
          registration.status ===
          "account_created"
        ) {
          throw createRequestError(
            "This account has already been created. Please sign in instead.",
            409,
            "account-already-created"
          );
        }

        if (
          registration
            .activationInProgress ===
          true
        ) {
          throw createRequestError(
            "This account is currently being activated. Please wait a moment and try again.",
            409,
            "activation-in-progress"
          );
        }

        if (
          registration
            .activationRecoveryInProgress ===
          true
        ) {
          throw createRequestError(
            "A new account setup email is already being sent. Please wait a moment.",
            409,
            "activation-recovery-in-progress"
          );
        }

        const requiresParentalConsent =
          registration
            .requiresParentalConsent ===
          true;

        /*
          ADULT

          Email ownership has already
          been verified.

          Recovery can therefore be
          sent to the verified student
          contact email.
        */

        if (
          !requiresParentalConsent
        ) {
          if (
            registration.status !==
              "email_verified" ||
            registration
              .emailVerificationStatus !==
              "verified" ||
            registration
              .consentStatus !==
              "not_required"
          ) {
            throw createRequestError(
              "Email verification must be completed before account setup can be recovered.",
              403,
              "email-verification-required"
            );
          }

          recipientEmail =
            typeof registration
              .email ===
            "string"
              ? registration.email
                  .trim()
                  .toLowerCase()
              : "";

          recipientType =
            "student";
        } else {
          /*
            MINOR

            Parent or guardian consent
            has already been approved.

            Recovery is sent to the
            approved parent email,
            because the minor's student
            email was not independently
            verified.
          */

          if (
            registration.status !==
              "consent_approved" ||
            registration
              .consentStatus !==
              "approved"
          ) {
            throw createRequestError(
              "Parent or guardian consent must be completed before account setup can be recovered.",
              403,
              "consent-required"
            );
          }

          recipientEmail =
            typeof registration
              .parentEmail ===
            "string"
              ? registration
                  .parentEmail
                  .trim()
                  .toLowerCase()
              : "";

          recipientType =
            "parent";
        }

        if (
          !recipientEmail
        ) {
          throw createRequestError(
            "A trusted email address was not available for account setup recovery.",
            409,
            "recovery-email-missing"
          );
        }

        firstName =
          registration.firstName ||
          "Student";

        const now =
          Date.now();

        const lastSentAt =
          getDate(
            registration
              .lastActivationRecoverySentAt
          );

        if (
          lastSentAt
        ) {
          const secondsSinceLastSend =
            Math.floor(
              (
                now -
                lastSentAt.getTime()
              ) /
                1000
            );

          const retryAfterSeconds =
            Math.max(
              0,
              RESEND_COOLDOWN_SECONDS -
                secondsSinceLastSend
            );

          if (
            retryAfterSeconds >
            0
          ) {
            throw createRequestError(
              `Please wait ${retryAfterSeconds} seconds before requesting another account setup email.`,
              429,
              "activation-recovery-cooldown",
              {
                retryAfterSeconds,
              }
            );
          }
        }

        const storedWindowStart =
          getDate(
            registration
              .activationRecoveryWindowStartedAt
          );

        let currentResendCount =
          Number.isFinite(
            registration
              .activationRecoveryCount
          )
            ? registration
                .activationRecoveryCount
            : 0;

        if (
          !storedWindowStart ||
          now -
              storedWindowStart.getTime() >=
            RESEND_WINDOW_MS
        ) {
          resendWindowStartedAt =
            new Date(
              now
            );

          currentResendCount =
            0;
        } else {
          resendWindowStartedAt =
            storedWindowStart;
        }

        if (
          currentResendCount >=
          MAX_RESENDS_PER_WINDOW
        ) {
          const retryAfterSeconds =
            Math.max(
              1,
              Math.ceil(
                (
                  RESEND_WINDOW_MS -
                  (
                    now -
                    resendWindowStartedAt.getTime()
                  )
                ) /
                  1000
              )
            );

          throw createRequestError(
            "Too many account setup emails have been requested. Please try again later.",
            429,
            "activation-recovery-limit",
            {
              retryAfterSeconds,
            }
          );
        }

        nextResendCount =
          currentResendCount +
          1;

        /*
          Preserve the previous token
          temporarily.

          If email delivery fails,
          restore the previous state.
        */

        oldTokenHash =
          registration
            .activationTokenHash ||
          null;

        oldTokenExpiry =
          registration
            .activationExpiresAt ||
          null;

        /*
          Store the new activation
          token before sending.

          This immediately invalidates
          any previous setup link.
        */

        transaction.update(
          registrationReference,
          {
            activationTokenHash,

            activationExpiresAt,

            activationRecoveryInProgress:
              true,

            activationRecoveryStartedAt:
              FieldValue.serverTimestamp(),

            updatedAt:
              FieldValue.serverTimestamp(),
          }
        );
      }
    );

    const appUrl =
      process.env
        .NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const setupUrl =
      `${appUrl}/set-password/${encodeURIComponent(
        registrationId
      )}` +
      `?token=${encodeURIComponent(
        activationToken
      )}`;

    const safeFirstName =
      escapeHtml(
        firstName
      );

    const recipientMessage =
      recipientType ===
      "parent"
        ? `
            <p>
              Parent or Guardian,
            </p>

            <p>
              A new account setup
              link was requested for
              <strong>
                ${safeFirstName}
              </strong>
              &apos;s SAIT Youth
              Initiative account.
            </p>
          `
        : `
            <p>
              Hi ${safeFirstName},
            </p>

            <p>
              A new account setup
              link was requested for
              your SAIT Youth
              Initiative account.
            </p>
          `;

    const emailResult =
      await resend.emails.send(
        {
          from:
            process.env
              .EMAIL_FROM ||
            "SAIT Youth Initiative <onboarding@resend.dev>",

          to: [
            recipientEmail,
          ],

          replyTo:
            process.env
              .EMAIL_REPLY_TO ||
            "youth.programs@sait.ca",

          subject:
            "Complete Your Youth Initiative Account Setup",

          html: `
            <!doctype html>

            <html lang="en">
              <body
                style="
                  margin:0;
                  padding:30px;
                  background:#f4f5f7;
                  font-family:Arial,Helvetica,sans-serif;
                  color:#222;
                "
              >
                <div
                  style="
                    max-width:620px;
                    margin:auto;
                    background:#ffffff;
                    border-radius:14px;
                    padding:32px;
                    border-top:4px solid #e2232a;
                  "
                >
                  <div
                    style="
                      color:#e2232a;
                      font-size:34px;
                      font-weight:900;
                    "
                  >
                    SAIT
                  </div>

                  <p
                    style="
                      margin-top:4px;
                      color:#555;
                      font-weight:700;
                    "
                  >
                    Youth Initiative
                  </p>

                  <h1>
                    Complete Account Setup
                  </h1>

                  ${recipientMessage}

                  <p>
                    Email verification
                    or parental consent
                    has already been
                    completed. Use the
                    secure link below to
                    create the account
                    password.
                  </p>

                  <a
                    href="${setupUrl}"
                    style="
                      display:inline-block;
                      margin-top:12px;
                      padding:14px 24px;
                      background:#e2232a;
                      color:#ffffff;
                      text-decoration:none;
                      border-radius:8px;
                      font-weight:700;
                    "
                  >
                    Continue Account Setup
                  </a>

                  <p
                    style="
                      margin-top:24px;
                      color:#777;
                      font-size:13px;
                      line-height:1.6;
                    "
                  >
                    This secure account
                    setup link expires in
                    30 minutes.
                  </p>

                  <p
                    style="
                      color:#777;
                      font-size:13px;
                      line-height:1.6;
                    "
                  >
                    Requesting a new
                    setup link invalidates
                    the previous setup
                    link.
                  </p>

                  <p
                    style="
                      color:#777;
                      font-size:13px;
                      line-height:1.6;
                    "
                  >
                    If you did not request
                    this message, you can
                    ignore it or contact
                    youth.programs@sait.ca.
                  </p>
                </div>
              </body>
            </html>
          `,
        }
      );

    /*
      Email failed.

      Restore the previous activation
      state so a previously valid setup
      token is not destroyed because of
      an email-delivery problem.
    */

    if (
      emailResult.error
    ) {
      await adminDb.runTransaction(
        async (
          transaction
        ) => {
          const snapshot =
            await transaction.get(
              registrationReference
            );

          if (
            !snapshot.exists
          ) {
            return;
          }

          const registration =
            snapshot.data();

          if (
            registration
              .activationTokenHash !==
            activationTokenHash
          ) {
            return;
          }

          transaction.update(
            registrationReference,
            {
              activationTokenHash:
                oldTokenHash,

              activationExpiresAt:
                oldTokenExpiry,

              activationRecoveryInProgress:
                false,

              activationRecoveryStartedAt:
                null,

              lastActivationRecoveryError:
                emailResult
                  .error
                  .message ||
                "Account setup email could not be sent.",

              updatedAt:
                FieldValue.serverTimestamp(),
            }
          );
        }
      );

      return Response.json(
        {
          success:
            false,

          message:
            "We could not send a new account setup email. Please try again.",

          code:
            "activation-recovery-email-failed",
        },
        {
          status:
            502,
        }
      );
    }

    await registrationReference.update(
      {
        activationRecoveryInProgress:
          false,

        activationRecoveryStartedAt:
          null,

        activationRecoveryCount:
          nextResendCount,

        activationRecoveryWindowStartedAt:
          resendWindowStartedAt,

        lastActivationRecoverySentAt:
          FieldValue.serverTimestamp(),

        lastActivationRecoveryError:
          null,

        activationRecoveryEmailId:
          emailResult
            .data
            ?.id ||
          null,

        updatedAt:
          FieldValue.serverTimestamp(),
      }
    );

    return Response.json(
      {
        success:
          true,

        message:
          `A new account setup link has been sent to ${maskEmail(
            recipientEmail
          )}.`,

        retryAfterSeconds:
          RESEND_COOLDOWN_SECONDS,
      },
      {
        status:
          200,
      }
    );
  } catch (
    error
  ) {
    const appCheckResponse =
      appCheckErrorResponse(
        error
      );

    if (
      appCheckResponse
    ) {
      return appCheckResponse;
    }

    console.error(
      "Activation recovery error:",
      error
    );

    if (
      error?.status
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            error.message,

          code:
            error.code ||
            "activation-recovery-failed",

          ...(
            error.retryAfterSeconds
              ? {
                  retryAfterSeconds:
                    error.retryAfterSeconds,
                }
              : {}
          ),
        },
        {
          status:
            error.status,
        }
      );
    }

    return Response.json(
      {
        success:
          false,

        message:
          "Account setup recovery could not be started. Please try again.",

        code:
          "activation-recovery-failed",
      },
      {
        status:
          500,
      }
    );
  }
}