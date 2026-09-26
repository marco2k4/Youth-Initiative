import crypto from "crypto";

import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/services/firebaseAdmin";

export const runtime = "nodejs";

const CONSENT_TERMS_VERSION =
  "2026-09-v1";

const ACTIVATION_TOKEN_EXPIRY_MINUTES = 30;

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
    Buffer.from(providedHash);

  const storedBuffer =
    Buffer.from(storedHash);

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

function createRequestError(
  message,
  status,
  code
) {
  const error = new Error(message);

  error.status = status;
  error.code = code;

  return error;
}

export async function POST(request) {
  try {
    const {
      registrationId,
      token,
      guardianConfirmed,
      termsAccepted,
    } = await request.json();

    if (
      typeof registrationId !== "string" ||
      !registrationId.trim() ||
      typeof token !== "string" ||
      !token.trim()
    ) {
      return Response.json(
        {
          success: false,
          message:
            "The consent request is incomplete.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      guardianConfirmed !== true ||
      termsAccepted !== true
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Both consent confirmations are required.",
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

    /*
      Generate a separate account activation
      token.

      The parental consent token will be
      destroyed after approval.
    */

    const activationToken = crypto
      .randomBytes(32)
      .toString("hex");

    const activationTokenHash =
      hashToken(activationToken);

    const activationExpiresAt =
      new Date(
        Date.now() +
          ACTIVATION_TOKEN_EXPIRY_MINUTES *
            60 *
            1000
      );

    await adminDb.runTransaction(
      async (transaction) => {
        const registrationSnapshot =
          await transaction.get(
            registrationReference
          );

        if (!registrationSnapshot.exists) {
          throw createRequestError(
            "This registration could not be found.",
            404,
            "registration-not-found"
          );
        }

        const registration =
          registrationSnapshot.data();

        if (
          registration.requiresParentalConsent !==
          true
        ) {
          throw createRequestError(
            "Parental consent is not required for this registration.",
            400,
            "consent-not-required"
          );
        }

        if (
          registration.status ===
            "consent_approved" ||
          registration.consentStatus ===
            "approved"
        ) {
          throw createRequestError(
            "Consent has already been recorded for this registration.",
            409,
            "consent-already-approved"
          );
        }

        if (
          registration.status ===
          "account_created"
        ) {
          throw createRequestError(
            "This account has already been created.",
            409,
            "account-already-created"
          );
        }

        if (
          registration.status !==
            "pending_consent" ||
          registration.consentStatus !==
            "pending"
        ) {
          throw createRequestError(
            "This consent request is no longer available.",
            409,
            "invalid-consent-state"
          );
        }

        const providedTokenHash =
          hashToken(token);

        if (
          !hashesMatch(
            providedTokenHash,
            registration.consentTokenHash
          )
        ) {
          throw createRequestError(
            "This consent link is invalid.",
            401,
            "invalid-consent-token"
          );
        }

        const expiryDate =
          registration.consentExpiresAt
            ?.toDate?.() ||
          new Date(
            registration.consentExpiresAt
          );

        if (
          Number.isNaN(
            expiryDate.getTime()
          ) ||
          expiryDate.getTime() <
            Date.now()
        ) {
          throw createRequestError(
            "This consent link has expired. Please begin registration again.",
            410,
            "consent-token-expired"
          );
        }

        /*
          Record the real consent.

          The original consent token is
          consumed here and cannot be used
          again.
        */

        transaction.update(
          registrationReference,
          {
            consentStatus: "approved",

            status:
              "consent_approved",

            guardianConfirmed: true,

            termsAccepted: true,

            consentTermsVersion:
              CONSENT_TERMS_VERSION,

            consentApprovedAt:
              FieldValue.serverTimestamp(),

            consentTokenUsedAt:
              FieldValue.serverTimestamp(),

            consentTokenHash: null,

            activationTokenHash,

            activationExpiresAt,

            updatedAt:
              FieldValue.serverTimestamp(),
          }
        );
      }
    );

    return Response.json({
      success: true,

      message:
        "Parental consent recorded successfully.",

      registrationId,

      activationToken,
    });
  } catch (error) {
    console.error(
      "Consent approval error:",
      error
    );

    if (error?.status) {
      return Response.json(
        {
          success: false,
          message: error.message,
          code: error.code,
        },
        {
          status: error.status,
        }
      );
    }

    return Response.json(
      {
        success: false,

        message:
          "We could not record parental consent. Please try again.",
      },
      {
        status: 500,
      }
    );
  }
}