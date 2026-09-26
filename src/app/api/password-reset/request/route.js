import crypto from "crypto";

import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import { Resend } from "resend";

import { adminDb } from "@/services/firebaseAdmin";

export const runtime = "nodejs";

const resend = new Resend(
  process.env.RESEND_API_KEY
);

const TOKEN_EXPIRY_MINUTES = 30;
const REQUEST_COOLDOWN_SECONDS = 60;
const MAX_REQUESTS_PER_HOUR = 5;

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getDate(value) {
  if (!value) {
    return null;
  }

  const date =
    value?.toDate?.() ||
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}

function calculateCurrentAge(dateOfBirth) {
  if (
    typeof dateOfBirth !== "string"
  ) {
    return null;
  }

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      dateOfBirth
    );

  if (!match) {
    return null;
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  const birthDate =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    birthDate.getUTCFullYear() !== year ||
    birthDate.getUTCMonth() !==
      month - 1 ||
    birthDate.getUTCDate() !== day
  ) {
    return null;
  }

  const today = new Date();

  let age =
    today.getUTCFullYear() -
    birthDate.getUTCFullYear();

  const currentMonth =
    today.getUTCMonth();

  const birthMonth =
    birthDate.getUTCMonth();

  if (
    currentMonth < birthMonth ||
    (
      currentMonth === birthMonth &&
      today.getUTCDate() <
        birthDate.getUTCDate()
    )
  ) {
    age -= 1;
  }

  return age;
}

function genericResponse() {
  return Response.json(
    {
      success: true,

      message:
        "If the Youth Initiative ID is valid and eligible for recovery, a secure email will be sent shortly.",
    },
    {
      status: 200,
    }
  );
}

async function checkRateLimit(
  studentId
) {
  const rateReference =
    adminDb
      .collection(
        "passwordResetRateLimits"
      )
      .doc(studentId);

  let allowed = false;

  await adminDb.runTransaction(
    async (transaction) => {
      const snapshot =
        await transaction.get(
          rateReference
        );

      const now = new Date();

      if (!snapshot.exists) {
        transaction.set(
          rateReference,
          {
            requestCount: 1,

            windowStartedAt:
              Timestamp.fromDate(
                now
              ),

            lastRequestedAt:
              Timestamp.fromDate(
                now
              ),

            updatedAt:
              FieldValue.serverTimestamp(),
          }
        );

        allowed = true;

        return;
      }

      const data =
        snapshot.data();

      const lastRequestedAt =
        getDate(
          data.lastRequestedAt
        );

      const windowStartedAt =
        getDate(
          data.windowStartedAt
        );

      if (lastRequestedAt) {
        const secondsSinceLastRequest =
          (
            now.getTime() -
            lastRequestedAt.getTime()
          ) /
          1000;

        if (
          secondsSinceLastRequest <
          REQUEST_COOLDOWN_SECONDS
        ) {
          allowed = false;

          return;
        }
      }

      const hourInMilliseconds =
        60 * 60 * 1000;

      const currentWindowExpired =
        !windowStartedAt ||
        now.getTime() -
          windowStartedAt.getTime() >=
          hourInMilliseconds;

      if (currentWindowExpired) {
        transaction.set(
          rateReference,
          {
            requestCount: 1,

            windowStartedAt:
              Timestamp.fromDate(
                now
              ),

            lastRequestedAt:
              Timestamp.fromDate(
                now
              ),

            updatedAt:
              FieldValue.serverTimestamp(),
          },
          {
            merge: true,
          }
        );

        allowed = true;

        return;
      }

      const currentCount =
        Number(
          data.requestCount || 0
        );

      if (
        currentCount >=
        MAX_REQUESTS_PER_HOUR
      ) {
        allowed = false;

        return;
      }

      transaction.update(
        rateReference,
        {
          requestCount:
            currentCount + 1,

          lastRequestedAt:
            Timestamp.fromDate(
              now
            ),

          updatedAt:
            FieldValue.serverTimestamp(),
        }
      );

      allowed = true;
    }
  );

  return allowed;
}

export async function POST(request) {
  try {
    const {
      youthId,
    } = await request.json();

    const cleanedYouthId =
      typeof youthId === "string"
        ? youthId
            .trim()
            .toUpperCase()
        : "";

    /*
      Missing input is a validation problem,
      so it can safely return 400.
    */

    if (!cleanedYouthId) {
      return Response.json(
        {
          success: false,

          message:
            "Youth Initiative ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
      Find account.

      From this point onward we use the
      same public response whether the
      account exists or not.
    */

    const studentQuery =
      await adminDb
        .collection("students")
        .where(
          "youthId",
          "==",
          cleanedYouthId
        )
        .limit(1)
        .get();

    if (studentQuery.empty) {
      return genericResponse();
    }

    const studentDocument =
      studentQuery.docs[0];

    const student =
      studentDocument.data();

    /*
      Only active student accounts are
      eligible for password recovery.
    */

    if (
      student.role !== "student" ||
      student.accountStatus !== "active"
    ) {
      return genericResponse();
    }

    /*
      Work out whether the student is
      currently under 18.

      We calculate from DOB so someone
      who registered at 17 but is now 18
      can use adult recovery.
    */

    const currentAge =
      calculateCurrentAge(
        student.dateOfBirth
      );

    const requiresGuardianApproval =
      currentAge !== null
        ? currentAge < 18
        : student
            .requiresParentalConsent ===
          true;

    /*
      Minor:
        parentEmail

      Adult:
        contactEmail
    */

    const recoveryEmail =
      requiresGuardianApproval
        ? student.parentEmail
        : student.contactEmail;

    if (!recoveryEmail) {
      /*
        Don't reveal that the account
        exists but has no recovery email.
      */

      return genericResponse();
    }

    /*
      Prevent password-reset email spam.
    */

    const allowed =
      await checkRateLimit(
        studentDocument.id
      );

    if (!allowed) {
      return genericResponse();
    }

    /*
      Generate a cryptographically secure
      one-time token.

      Only its SHA-256 hash is stored.
    */

    const rawToken =
      crypto
        .randomBytes(32)
        .toString("hex");

    const tokenHash =
      hashToken(rawToken);

    const expiresAt =
      Timestamp.fromDate(
        new Date(
          Date.now() +
            TOKEN_EXPIRY_MINUTES *
              60 *
              1000
        )
      );

    const resetReference =
      adminDb
        .collection(
          "passwordResetRequests"
        )
        .doc();

    /*
      Minor:
        token verifies guardian.

      Adult:
        token directly authorizes
        password reset.
    */

    await resetReference.set({
      studentId:
        studentDocument.id,

      youthId:
        student.youthId,

      recoveryMode:
        requiresGuardianApproval
          ? "guardian"
          : "student",

      requiresGuardianApproval,

      guardianVerified:
        false,

      verificationTokenHash:
        requiresGuardianApproval
          ? tokenHash
          : null,

      resetTokenHash:
        requiresGuardianApproval
          ? null
          : tokenHash,

      status:
        requiresGuardianApproval
          ? "pending_guardian_verification"
          : "ready_for_reset",

      verificationExpiresAt:
        requiresGuardianApproval
          ? expiresAt
          : null,

      resetExpiresAt:
        requiresGuardianApproval
          ? null
          : expiresAt,

      usedAt: null,

      verificationUsedAt: null,

      createdAt:
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    /*
      Minor goes to guardian verification.

      Adult goes directly to create
      a new password.
    */

    const recoveryUrl =
      requiresGuardianApproval
        ? `${appUrl}/parental-verification/${resetReference.id}?token=${encodeURIComponent(
            rawToken
          )}`
        : `${appUrl}/reset-password/${resetReference.id}?token=${encodeURIComponent(
            rawToken
          )}`;

    const safeFirstName =
      escapeHtml(
        student.firstName
      );

    const subject =
      requiresGuardianApproval
        ? "Password Reset Approval – SAIT Youth Initiative"
        : "Reset Your Password – SAIT Youth Initiative";

    const heading =
      requiresGuardianApproval
        ? "Password Reset Approval"
        : "Reset Your Password";

    const explanation =
      requiresGuardianApproval
        ? `
          A password reset was requested for
          <strong>${safeFirstName}</strong>'s
          Youth Initiative account.
          <br /><br />
          Because the student is under 18,
          parent or guardian approval is
          required before the password can
          be changed.
        `
        : `
          A password reset was requested for
          your Youth Initiative account.
          <br /><br />
          Use the secure link below to create
          a new password.
        `;

    const buttonText =
      requiresGuardianApproval
        ? "Review Password Reset"
        : "Reset Password";

    let emailResult;

    try {
      emailResult =
        await resend.emails.send({
          from:
            process.env.EMAIL_FROM ||
            "SAIT Youth Initiative <onboarding@resend.dev>",

          to: [
            recoveryEmail,
          ],

          subject,

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
                    ${heading}
                  </h1>

                  <p
                    style="
                      line-height:1.7;
                    "
                  >
                    ${explanation}
                  </p>

                  <a
                    href="${recoveryUrl}"
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
                    ${buttonText}
                  </a>

                  <p
                    style="
                      margin-top:24px;
                      color:#777;
                      font-size:13px;
                    "
                  >
                    This secure link expires
                    in 30 minutes and can only
                    be used for this password
                    recovery request.
                  </p>

                  <p
                    style="
                      color:#777;
                      font-size:13px;
                    "
                  >
                    If you did not request
                    this password reset,
                    you can ignore this email.
                  </p>
                </div>
              </body>
            </html>
          `,
        });
    } catch (emailError) {
      console.error(
        "Password recovery email delivery failed:",
        emailError?.message
      );

      await resetReference.update({
        status:
          "delivery_failed",

        verificationTokenHash:
          null,

        resetTokenHash:
          null,

        updatedAt:
          FieldValue.serverTimestamp(),
      });

      /*
        Still return generic response.
        Do not expose whether this
        account exists.
      */

      return genericResponse();
    }

    if (emailResult?.error) {
      console.error(
        "Password recovery email delivery failed:",
        emailResult.error.message
      );

      await resetReference.update({
        status:
          "delivery_failed",

        verificationTokenHash:
          null,

        resetTokenHash:
          null,

        updatedAt:
          FieldValue.serverTimestamp(),
      });

      return genericResponse();
    }

    await resetReference.update({
      emailStatus:
        "sent",

      emailId:
        emailResult.data?.id ||
        null,

      emailSentAt:
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    /*
      IMPORTANT:
      Do not return requestId.

      Returning different information for
      existing/non-existing accounts would
      defeat our enumeration protection.
    */

    return genericResponse();
  } catch (error) {
    console.error(
      "Password reset request error:",
      error?.message
    );

    /*
      For a valid-shaped request we still
      avoid exposing internal account state.
    */

    return genericResponse();
  }
}