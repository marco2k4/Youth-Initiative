import crypto from "crypto";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  Resend,
} from "resend";

import {
  appCheckErrorResponse,
  requireAppCheck,
} from "@/services/appCheckServer";

import {
  adminDb,
} from "@/services/firebaseAdmin";

import {
  calculateAge,
  registrationSchema,
} from "@/validations/registrationSchema";

export const runtime =
  "nodejs";

const resend =
  new Resend(
    process.env.RESEND_API_KEY
  );

const CONSENT_EXPIRY_MINUTES =
  30;

const EMAIL_VERIFICATION_EXPIRY_MINUTES =
  30;

const RESEND_ACCESS_HOURS =
  24;

function normalizeName(
  value
) {
  return value
    .trim()
    .replace(
      /\s+/g,
      " "
    );
}

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
    value
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

function maskEmail(
  email
) {
  if (
    typeof email !==
      "string" ||
    !email.includes(
      "@"
    )
  ) {
    return "parent or guardian email";
  }

  const [
    localPart,
    domain,
  ] =
    email.split(
      "@"
    );

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

export async function POST(
  request
) {
  try {
    await requireAppCheck(
      request
    );

    const requestBody =
      await request.json();

    const validatedData =
      await registrationSchema.validate(
        requestBody,
        {
          abortEarly:
            false,

          stripUnknown:
            true,
        }
      );

    const firstName =
      normalizeName(
        validatedData.firstName
      );

    const lastName =
      normalizeName(
        validatedData.lastName
      );

    const email =
      validatedData.email
        .trim()
        .toLowerCase();

    const parentEmail =
      validatedData.parentEmail
        ? validatedData.parentEmail
            .trim()
            .toLowerCase()
        : null;

    const dateOfBirth =
      validatedData.dateOfBirth;

    const age =
      calculateAge(
        dateOfBirth
      );

    const requiresParentalConsent =
      age !== null &&
      age < 18;

    /*
      Prevent duplicate
      pending registrations.
    */

    const pendingRegistrationQuery =
      await adminDb
        .collection(
          "pendingRegistrations"
        )
        .where(
          "email",
          "==",
          email
        )
        .where(
          "status",
          "in",
          [
            "pending_consent",
            "consent_approved",
            "consent_not_required",
            "pending_email_verification",
          ]
        )
        .limit(
          1
        )
        .get();

    if (
      !pendingRegistrationQuery.empty
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "A registration is already pending for this email address.",

          code:
            "registration-already-pending",
        },
        {
          status:
            409,
        }
      );
    }

    /*
      Check whether an
      active account already
      uses this email.
    */

    const studentQuery =
      await adminDb
        .collection(
          "students"
        )
        .where(
          "contactEmail",
          "==",
          email
        )
        .limit(
          1
        )
        .get();

    if (
      !studentQuery.empty
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "An account already exists with this email address. Please use the Login or Forgot Password option.",

          code:
            "account-already-exists",
        },
        {
          status:
            409,
        }
      );
    }

    /*
      MINOR:
      Create parent-consent
      token.

      ADULT:
      Create email ownership
      verification token.

      Adult verification token
      is never returned from this
      API.
    */

    let consentToken =
      null;

    let consentTokenHash =
      null;

    let consentExpiresAt =
      null;

    let emailVerificationToken =
      null;

    let emailVerificationTokenHash =
      null;

    let emailVerificationExpiresAt =
      null;

    if (
      requiresParentalConsent
    ) {
      consentToken =
        crypto
          .randomBytes(
            32
          )
          .toString(
            "hex"
          );

      consentTokenHash =
        hashToken(
          consentToken
        );

      consentExpiresAt =
        new Date(
          Date.now() +
            CONSENT_EXPIRY_MINUTES *
              60 *
              1000
        );
    } else {
      emailVerificationToken =
        crypto
          .randomBytes(
            32
          )
          .toString(
            "hex"
          );

      emailVerificationTokenHash =
        hashToken(
          emailVerificationToken
        );

      emailVerificationExpiresAt =
        new Date(
          Date.now() +
            EMAIL_VERIFICATION_EXPIRY_MINUTES *
              60 *
              1000
        );
    }

    /*
      Separate resend token
      for minor consent.

      This token cannot approve
      consent.
    */

    let resendToken =
      null;

    let resendTokenHash =
      null;

    let resendTokenExpiresAt =
      null;

    if (
      requiresParentalConsent
    ) {
      resendToken =
        crypto
          .randomBytes(
            32
          )
          .toString(
            "hex"
          );

      resendTokenHash =
        hashToken(
          resendToken
        );

      resendTokenExpiresAt =
        new Date(
          Date.now() +
            RESEND_ACCESS_HOURS *
              60 *
              60 *
              1000
        );
    }

    const pendingRegistrationReference =
      adminDb
        .collection(
          "pendingRegistrations"
        )
        .doc();

    await pendingRegistrationReference.set(
      {
        firstName,
        lastName,

        fullName:
          `${firstName} ${lastName}`,

        email,
        parentEmail,

        dateOfBirth,
        age,

        requiresParentalConsent,

        consentStatus:
          requiresParentalConsent
            ? "pending"
            : "not_required",

        status:
          requiresParentalConsent
            ? "pending_consent"
            : "pending_email_verification",

        consentTokenHash,

        consentExpiresAt,

        consentApprovedAt:
          null,

        emailVerificationStatus:
          requiresParentalConsent
            ? "not_required"
            : "pending",

        emailVerificationTokenHash,

        emailVerificationExpiresAt,

        emailVerifiedAt:
          null,

        guardianConfirmed:
          false,

        termsAccepted:
          false,

        consentTermsVersion:
          null,

        resendTokenHash,

        resendTokenExpiresAt,

        resendCount:
          0,

        youthId:
          null,

        firebaseUid:
          null,

        emailStatus:
          "pending",

        emailSentAt:
          null,

        lastConsentEmailSentAt:
          null,

        lastEmailVerificationSentAt:
          null,

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      }
    );

    const appUrl =
      process.env
        .NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const safeFirstName =
      escapeHtml(
        firstName
      );

    const safeLastName =
      escapeHtml(
        lastName
      );

    const safeFullName =
      `${safeFirstName} ${safeLastName}`;

    /*
      ADULT FLOW

      Send verification email.
      Do NOT return any password
      setup token here.
    */

    if (
      !requiresParentalConsent
    ) {
      const verificationUrl =
        `${appUrl}/verify-email/${pendingRegistrationReference.id}` +
        `#token=${encodeURIComponent(
          emailVerificationToken
        )}`;

      const emailResult =
        await resend.emails.send(
          {
            from:
              process.env
                .EMAIL_FROM ||
              "SAIT Youth Initiative <onboarding@resend.dev>",

            to: [
              email,
            ],

            subject:
              "Verify Your Email – SAIT Youth Initiative",

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
                      Verify Your Email
                    </h1>

                    <p>
                      Hi ${safeFirstName},
                    </p>

                    <p>
                      You started creating
                      an account on the SAIT
                      Youth Initiative
                      platform.
                    </p>

                    <p>
                      Please verify that
                      this email address
                      belongs to you before
                      creating your
                      password.
                    </p>

                    <a
                      href="${verificationUrl}"
                      style="
                        display:inline-block;
                        margin-top:12px;
                        padding:14px 24px;
                        background:#e2232a;
                        color:white;
                        text-decoration:none;
                        border-radius:8px;
                        font-weight:700;
                      "
                    >
                      Verify Email
                    </a>

                    <p
                      style="
                        margin-top:24px;
                        color:#777;
                        font-size:13px;
                      "
                    >
                      This secure
                      verification link
                      expires in 30
                      minutes.
                    </p>

                    <p
                      style="
                        color:#777;
                        font-size:13px;
                      "
                    >
                      If you did not create
                      this registration,
                      you can ignore this
                      email.
                    </p>
                  </div>
                </body>
              </html>
            `,
          }
        );

      if (
        emailResult.error
      ) {
        await pendingRegistrationReference.update(
          {
            status:
              "email_delivery_failed",

            emailStatus:
              "failed",

            emailError:
              emailResult
                .error
                .message ||
              "Email could not be sent.",

            updatedAt:
              FieldValue.serverTimestamp(),
          }
        );

        return Response.json(
          {
            success:
              false,

            message:
              "We could not send the verification email. Please try registering again.",

            code:
              "verification-email-failed",
          },
          {
            status:
              502,
          }
        );
      }

      await pendingRegistrationReference.update(
        {
          emailStatus:
            "sent",

          emailId:
            emailResult
              .data
              ?.id ||
            null,

          emailSentAt:
            FieldValue.serverTimestamp(),

          lastEmailVerificationSentAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        }
      );

      return Response.json(
        {
          success:
            true,

          message:
            "A verification email has been sent to your email address.",

          registrationId:
            pendingRegistrationReference.id,

          email,

          firstName,

          requiresParentalConsent:
            false,

          nextStep:
            "verify_email",

          emailSent:
            true,
        },
        {
          status:
            201,
        }
      );
    }

    /*
      MINOR FLOW

      Send parental consent
      email.
    */

    const consentUrl =
      `${appUrl}/consent/${pendingRegistrationReference.id}` +
      `?token=${encodeURIComponent(
        consentToken
      )}`;

    const emailResult =
      await resend.emails.send(
        {
          from:
            process.env
              .EMAIL_FROM ||
            "SAIT Youth Initiative <onboarding@resend.dev>",

          to: [
            parentEmail,
          ],

          subject:
            "Parental Consent Required – SAIT Youth Initiative",

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
                    Parental Consent
                    Request
                  </h1>

                  <p>
                    Hello Parent or
                    Guardian,
                  </p>

                  <p>
                    <strong>
                      ${safeFullName}
                    </strong>
                    has started creating
                    an account on the SAIT
                    Youth Initiative
                    platform.
                  </p>

                  <p>
                    Because the student
                    is under 18, parent or
                    guardian consent is
                    required before the
                    account can be
                    activated.
                  </p>

                  <a
                    href="${consentUrl}"
                    style="
                      display:inline-block;
                      margin-top:12px;
                      padding:14px 24px;
                      background:#e2232a;
                      color:white;
                      text-decoration:none;
                      border-radius:8px;
                      font-weight:700;
                    "
                  >
                    Review and Provide
                    Consent
                  </a>

                  <p
                    style="
                      margin-top:24px;
                      color:#777;
                      font-size:13px;
                    "
                  >
                    This secure consent
                    link expires in 30
                    minutes.
                  </p>

                  <p
                    style="
                      color:#777;
                      font-size:13px;
                    "
                  >
                    If you did not expect
                    this request, you can
                    ignore this email.
                  </p>
                </div>
              </body>
            </html>
          `,
        }
      );

    /*
      Registration itself
      succeeded.

      If the parent email fails,
      keep the registration so
      the existing resend flow
      can be used.
    */

    if (
      emailResult.error
    ) {
      await pendingRegistrationReference.update(
        {
          emailStatus:
            "failed",

          emailError:
            emailResult
              .error
              .message ||
            "Email could not be sent.",

          updatedAt:
            FieldValue.serverTimestamp(),
        }
      );

      return Response.json(
        {
          success:
            true,

          message:
            "Registration was created, but the consent email could not be delivered. Please resend it.",

          registrationId:
            pendingRegistrationReference.id,

          email,

          firstName,

          parentEmailMasked:
            maskEmail(
              parentEmail
            ),

          requiresParentalConsent:
            true,

          nextStep:
            "parent_consent",

          emailSent:
            false,

          resendToken,
        },
        {
          status:
            202,
        }
      );
    }

    await pendingRegistrationReference.update(
      {
        emailStatus:
          "sent",

        emailId:
          emailResult
            .data
            ?.id ||
          null,

        emailSentAt:
          FieldValue.serverTimestamp(),

        lastConsentEmailSentAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      }
    );

    return Response.json(
      {
        success:
          true,

        message:
          "Parental consent email sent successfully.",

        registrationId:
          pendingRegistrationReference.id,

        email,

        firstName,

        parentEmailMasked:
          maskEmail(
            parentEmail
          ),

        requiresParentalConsent:
          true,

        nextStep:
          "parent_consent",

        emailSent:
          true,

        resendToken,
      },
      {
        status:
          201,
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
      "Registration API error:",
      error
    );

    if (
      error?.name ===
      "ValidationError"
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "Please correct the information entered and try again.",

          fieldErrors:
            error.inner?.reduce(
              (
                errors,
                validationError
              ) => {
                if (
                  validationError.path &&
                  !errors[
                    validationError.path
                  ]
                ) {
                  errors[
                    validationError.path
                  ] =
                    validationError.message;
                }

                return errors;
              },
              {}
            ),
        },
        {
          status:
            400,
        }
      );
    }

    return Response.json(
      {
        success:
          false,

        message:
          "We could not complete your registration. Please try again.",
      },
      {
        status:
          500,
      }
    );
  }
}