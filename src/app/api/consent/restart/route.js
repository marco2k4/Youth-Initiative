import crypto from "crypto";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "@/services/firebaseAdmin";

import {
  appCheckErrorResponse,
  requireAppCheck,
} from "@/services/appCheckServer";

export const runtime =
  "nodejs";

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

function hashesMatch(
  providedHash,
  storedHash
) {
  if (
    typeof providedHash !==
      "string" ||
    typeof storedHash !==
      "string"
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

function createRequestError(
  message,
  status,
  code
) {
  const error =
    new Error(
      message
    );

  error.status =
    status;

  error.code =
    code;

  return error;
}

export async function POST(
  request
) {
  try {
    /*
      This is a pre-login
      registration recovery
      endpoint.

      App Check is required,
      but Firebase login is
      not required.
    */

    await requireAppCheck(
      request
    );

    const {
      registrationId,
      resendToken,
    } =
      await request.json();

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
          success:
            false,

          message:
            "Registration restart information is incomplete.",

          code:
            "restart-request-incomplete",
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
          registrationId.trim()
        );

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
            "The registration could not be found.",
            404,
            "registration-not-found"
          );
        }

        const registration =
          snapshot.data();

        /*
          Only an under-18
          registration that is still
          waiting for consent can be
          restarted through this
          endpoint.
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
          throw createRequestError(
            "This registration can no longer be restarted.",
            409,
            "registration-not-pending"
          );
        }

        /*
          The separate resend token
          identifies the pending
          registration owned by this
          browser session.

          It does NOT grant parental
          consent or account access.
        */

        const providedTokenHash =
          hashToken(
            resendToken.trim()
          );

        if (
          !hashesMatch(
            providedTokenHash,
            registration
              .resendTokenHash
          )
        ) {
          throw createRequestError(
            "This registration restart request is not authorized.",
            401,
            "invalid-restart-token"
          );
        }

        const resendExpiry =
          getDate(
            registration
              .resendTokenExpiresAt
          );

        /*
          Do not restart an active
          registration unnecessarily.

          While the resend
          authorization remains valid,
          the existing consent resend
          flow should be used.
        */

        if (
          resendExpiry &&
          resendExpiry.getTime() >=
            Date.now()
        ) {
          throw createRequestError(
            "This registration is still active. Please resend the parental consent email instead.",
            409,
            "registration-still-active"
          );
        }

        /*
          Close the stale pending
          registration.

          We keep the document for
          audit/history, but remove
          every token that could still
          authorize consent or resend
          operations.

          The registration route does
          not treat status "expired"
          as an active duplicate, so
          the student can begin again.
        */

        transaction.update(
          registrationReference,
          {
            status:
              "expired",

            consentStatus:
              "expired",

            consentTokenHash:
              null,

            consentExpiresAt:
              null,

            resendTokenHash:
              null,

            resendTokenExpiresAt:
              null,

            activationTokenHash:
              null,

            activationExpiresAt:
              null,

            activationInProgress:
              false,

            expirationReason:
              "consent_resend_session_expired",

            expiredAt:
              FieldValue.serverTimestamp(),

            updatedAt:
              FieldValue.serverTimestamp(),
          }
        );
      }
    );

    return Response.json(
      {
        success:
          true,

        message:
          "The expired registration has been closed. You can now start registration again.",
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
      "Consent registration restart error:",
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
            "registration-restart-failed",
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
          "The registration could not be restarted. Please try again.",

        code:
          "registration-restart-failed",
      },
      {
        status:
          500,
      }
    );
  }
}