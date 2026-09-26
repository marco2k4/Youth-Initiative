import crypto from "crypto";

import { FieldValue } from "firebase-admin/firestore";
import { Resend } from "resend";

import {
  appCheckErrorResponse,
  requireAppCheck,
} from "@/services/appCheckServer";
import { adminDb } from "@/services/firebaseAdmin";
import {
  calculateAge,
  registrationSchema,
} from "@/validations/registrationSchema";

export const runtime = "nodejs";

const resend = new Resend(
  process.env.RESEND_API_KEY
);

const CONSENT_EXPIRY_MINUTES = 30;
const RESEND_ACCESS_HOURS = 24;

function normalizeName(value) {
  return value
    .trim()
    .replace(/\s+/g, " ");
}

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function maskEmail(email) {
  if (
    typeof email !== "string" ||
    !email.includes("@")
  ) {
    return "parent or guardian email";
  }

  const [
    localPart,
    domain,
  ] = email.split("@");

  const visibleCharacters =
    localPart.slice(0, 2);

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

export async function POST(request) {
  try {
    await requireAppCheck(request);
    const requestBody =
      await request.json();

    const validatedData =
      await registrationSchema.validate(
        requestBody,
        {
          abortEarly: false,
          stripUnknown: true,
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
      calculateAge(dateOfBirth);

    const requiresParentalConsent =
      age !== null &&
      age < 18;

    /*
      Prevent duplicate pending
      registrations.
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
          ]
        )
        .limit(1)
        .get();

    if (
      !pendingRegistrationQuery.empty
    ) {
      return Response.json(
        {
          success: false,

          message:
            "A registration is already pending for this email address.",

          code:
            "registration-already-pending",
        },
        {
          status: 409,
        }
      );
    }

    /*
      Check existing active account.

      Student documents store the real
      email as contactEmail.
    */

    const studentQuery =
      await adminDb
        .collection("students")
        .where(
          "contactEmail",
          "==",
          email
        )
        .limit(1)
        .get();

    if (!studentQuery.empty) {
      return Response.json(
        {
          success: false,

          message:
            "An account already exists with this email address. Please use the Login or Forgot Password option.",

          code:
            "account-already-exists",
        },
        {
          status: 409,
        }
      );
    }

    /*
      Create secure setup / consent token.
    */

    const consentToken =
      crypto
        .randomBytes(32)
        .toString("hex");

    const consentTokenHash =
      hashToken(consentToken);

    const consentExpiresAt =
      new Date(
        Date.now() +
          CONSENT_EXPIRY_MINUTES *
            60 *
            1000
      );

    /*
      Separate token used only for requesting
      another consent email.

      It cannot approve consent.
    */

    let resendToken = null;
    let resendTokenHash = null;
    let resendTokenExpiresAt = null;

    if (requiresParentalConsent) {
      resendToken =
        crypto
          .randomBytes(32)
          .toString("hex");

      resendTokenHash =
        hashToken(resendToken);

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

    await pendingRegistrationReference.set({
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
          : "consent_not_required",

      consentTokenHash,

      consentExpiresAt,

      consentApprovedAt: null,

      guardianConfirmed: false,
      termsAccepted: false,
      consentTermsVersion: null,

      resendTokenHash,
      resendTokenExpiresAt,

      resendCount: 0,

      youthId: null,
      firebaseUid: null,

      emailStatus:
        requiresParentalConsent
          ? "pending"
          : "not_required",

      emailSentAt: null,

      lastConsentEmailSentAt: null,

      createdAt:
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    /*
      18+ students don't require
      parental consent.
    */

    if (!requiresParentalConsent) {
      return Response.json(
        {
          success: true,

          message:
            "Registration created successfully.",

          registrationId:
            pendingRegistrationReference.id,

          email,
          firstName,

          requiresParentalConsent:
            false,

          nextStep:
            "set_password",

          setupToken:
            consentToken,
        },
        {
          status: 201,
        }
      );
    }

    /*
      Under-18 consent email.
    */

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const consentUrl =
      `${appUrl}/consent/${pendingRegistrationReference.id}` +
      `?token=${encodeURIComponent(
        consentToken
      )}`;

    const safeFirstName =
      escapeHtml(firstName);

    const safeLastName =
      escapeHtml(lastName);

    const safeFullName =
      `${safeFirstName} ${safeLastName}`;

    const emailResult =
      await resend.emails.send({
        from:
          process.env.EMAIL_FROM ||
          "SAIT Youth Initiative <onboarding@resend.dev>",

        to: [parentEmail],

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
                  Parental Consent Request
                </h1>

                <p>
                  Hello Parent or Guardian,
                </p>

                <p>
                  <strong>
                    ${safeFullName}
                  </strong>
                  has started creating an
                  account on the SAIT Youth
                  Initiative platform.
                </p>

                <p>
                  Because the student is under
                  18, parent or guardian consent
                  is required before the account
                  can be activated.
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
                  This secure consent link expires
                  in 30 minutes.
                </p>

                <p
                  style="
                    color:#777;
                    font-size:13px;
                  "
                >
                  If you did not expect this
                  request, you can ignore this
                  email.
                </p>
              </div>
            </body>
          </html>
        `,
      });

    /*
      Registration itself succeeded.

      If email delivery fails, don't throw away
      the registration. Send the student to the
      pending page where they can retry.
    */

    if (emailResult.error) {
      await pendingRegistrationReference.update({
        emailStatus: "failed",

        emailError:
          emailResult.error.message ||
          "Email could not be sent.",

        updatedAt:
          FieldValue.serverTimestamp(),
      });

      return Response.json(
        {
          success: true,

          message:
            "Registration was created, but the consent email could not be delivered. Please resend it.",

          registrationId:
            pendingRegistrationReference.id,

          email,
          firstName,

          parentEmailMasked:
            maskEmail(parentEmail),

          requiresParentalConsent:
            true,

          nextStep:
            "parent_consent",

          emailSent: false,

          resendToken,
        },
        {
          status: 202,
        }
      );
    }

    await pendingRegistrationReference.update({
      emailStatus: "sent",

      emailId:
        emailResult.data?.id ||
        null,

      emailSentAt:
        FieldValue.serverTimestamp(),

      lastConsentEmailSentAt:
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    return Response.json(
      {
        success: true,

        message:
          "Parental consent email sent successfully.",

        registrationId:
          pendingRegistrationReference.id,

        email,
        firstName,

        parentEmailMasked:
          maskEmail(parentEmail),

        requiresParentalConsent:
          true,

        nextStep:
          "parent_consent",

        emailSent: true,

        resendToken,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    const appCheckResponse =
      appCheckErrorResponse(error);

    if (appCheckResponse) {
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
          success: false,

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
          status: 400,
        }
      );
    }

    return Response.json(
      {
        success: false,

        message:
          "We could not complete your registration. Please try again.",
      },
      {
        status: 500,
      }
    );
  }
}