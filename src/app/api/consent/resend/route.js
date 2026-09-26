import crypto from "crypto";

import { FieldValue } from "firebase-admin/firestore";
import { Resend } from "resend";

import { adminDb } from "@/services/firebaseAdmin";

import {
  appCheckErrorResponse,
  requireAppCheck,
} from "@/services/appCheckServer";

export const runtime = "nodejs";

const resend = new Resend(
  process.env.RESEND_API_KEY
);

const CONSENT_EXPIRY_MINUTES = 30;

const RESEND_COOLDOWN_SECONDS = 60;

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function hashesMatch(
  providedHash,
  storedHash
) {
  if (
    typeof providedHash !== "string" ||
    typeof storedHash !== "string"
  ) {
    return false;
  }

  const providedBuffer =
    Buffer.from(
      providedHash,
      "hex"
    );

  const storedBuffer =
    Buffer.from(
      storedHash,
      "hex"
    );

  if (
    providedBuffer.length !==
    storedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    providedBuffer,
    storedBuffer
  );
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(request) {
  try {
    await requireAppCheck(request);
    const {
      registrationId,
      resendToken,
    } = await request.json();

    if (
      typeof registrationId !==
        "string" ||
      !registrationId.trim() ||
      typeof resendToken !==
        "string" ||
      !resendToken.trim()
    ) {
      return Response.json(
        {
          success: false,

          message:
            "The resend request is incomplete.",
        },
        {
          status: 400,
        }
      );
    }

    const registrationReference =
      adminDb
        .collection(
          "pendingRegistrations"
        )
        .doc(registrationId);

    const registrationSnapshot =
      await registrationReference.get();

    if (
      !registrationSnapshot.exists
    ) {
      return Response.json(
        {
          success: false,

          message:
            "The registration could not be found.",
        },
        {
          status: 404,
        }
      );
    }

    const registration =
      registrationSnapshot.data();

    /*
      Only a registration still waiting for
      parental consent can request another
      consent email.
    */

    if (
      registration
        .requiresParentalConsent !==
        true ||
      registration.status !==
        "pending_consent" ||
      registration.consentStatus !==
        "pending"
    ) {
      return Response.json(
        {
          success: false,

          message:
            "This registration is no longer waiting for parental consent.",
        },
        {
          status: 409,
        }
      );
    }

    /*
      Verify the separate resend token.
    */

    const providedResendHash =
      hashToken(resendToken);

    if (
      !hashesMatch(
        providedResendHash,
        registration
          .resendTokenHash
      )
    ) {
      return Response.json(
        {
          success: false,

          message:
            "This resend request is not authorized.",
        },
        {
          status: 401,
        }
      );
    }

    const resendExpiry =
      getDate(
        registration
          .resendTokenExpiresAt
      );

    if (
      !resendExpiry ||
      resendExpiry.getTime() <
        Date.now()
    ) {
      return Response.json(
        {
          success: false,

          message:
            "The resend session has expired. Please begin registration again.",
        },
        {
          status: 410,
        }
      );
    }

    /*
      Prevent repeated email spam.
    */

    const lastEmailTime =
      getDate(
        registration
          .lastConsentEmailSentAt
      );

    if (lastEmailTime) {
      const secondsSinceLastEmail =
        Math.floor(
          (
            Date.now() -
            lastEmailTime.getTime()
          ) /
            1000
        );

      if (
        secondsSinceLastEmail <
        RESEND_COOLDOWN_SECONDS
      ) {
        const waitSeconds =
          RESEND_COOLDOWN_SECONDS -
          secondsSinceLastEmail;

        return Response.json(
          {
            success: false,

            message:
              `Please wait ${waitSeconds} seconds before requesting another email.`,

            retryAfter:
              waitSeconds,
          },
          {
            status: 429,
          }
        );
      }
    }

    if (
      !registration.parentEmail
    ) {
      return Response.json(
        {
          success: false,

          message:
            "No parent or guardian email is attached to this registration.",
        },
        {
          status: 400,
        }
      );
    }

    /*
      Every resend gets a NEW consent token.

      The old consent link becomes invalid.
    */

    const newConsentToken =
      crypto
        .randomBytes(32)
        .toString("hex");

    const newConsentTokenHash =
      hashToken(
        newConsentToken
      );

    const newConsentExpiry =
      new Date(
        Date.now() +
          CONSENT_EXPIRY_MINUTES *
            60 *
            1000
      );

    /*
      Save the new token before sending so
      the new link is valid as soon as it
      arrives.
    */

    await registrationReference.update({
      consentTokenHash:
        newConsentTokenHash,

      consentExpiresAt:
        newConsentExpiry,

      emailStatus:
        "sending",

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    const appUrl =
      process.env
        .NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const consentUrl =
      `${appUrl}/consent/${registrationId}` +
      `?token=${encodeURIComponent(
        newConsentToken
      )}`;

    const safeFullName =
      `${escapeHtml(
        registration.firstName
      )} ${escapeHtml(
        registration.lastName
      )}`;

    const emailResult =
      await resend.emails.send({
        from:
          process.env.EMAIL_FROM ||
          "SAIT Youth Initiative <onboarding@resend.dev>",

        to: [
          registration.parentEmail,
        ],

        subject:
          "New Parental Consent Link – SAIT Youth Initiative",

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
                  padding:32px;
                  border-radius:14px;
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

                <p>
                  Hello Parent or Guardian,
                </p>

                <p>
                  A new parental consent link
                  was requested for
                  <strong>
                    ${safeFullName}
                  </strong>.
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
                  Review and Provide Consent
                </a>

                <p
                  style="
                    margin-top:24px;
                    color:#777;
                    font-size:13px;
                  "
                >
                  This new link expires in
                  30 minutes. Any previous
                  consent link should no longer
                  be used.
                </p>
              </div>
            </body>
          </html>
        `,
      });

    if (emailResult.error) {
      await registrationReference.update({
        emailStatus:
          "failed",

        emailError:
          emailResult.error.message ||
          "Email could not be sent.",

        updatedAt:
          FieldValue.serverTimestamp(),
      });

      return Response.json(
        {
          success: false,

          message:
            "The consent email could not be sent. Please try again.",
        },
        {
          status: 502,
        }
      );
    }

    await registrationReference.update({
      emailStatus:
        "sent",

      emailId:
        emailResult.data?.id ||
        null,

      emailError:
        null,

      emailSentAt:
        FieldValue.serverTimestamp(),

      lastConsentEmailSentAt:
        FieldValue.serverTimestamp(),

      resendCount:
        FieldValue.increment(1),

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    return Response.json({
      success: true,

      message:
        "A new parental consent email has been sent.",
    });
  } catch (error) {
    const appCheckResponse =
      appCheckErrorResponse(error);

    if (appCheckResponse) {
      return appCheckResponse;
    }
    console.error(
      "Consent resend error:",
      error
    );

    return Response.json(
      {
        success: false,

        message:
          "The consent email could not be resent. Please try again.",
      },
      {
        status: 500,
      }
    );
  }
}