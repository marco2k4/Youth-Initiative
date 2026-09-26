import crypto from "crypto";

import { adminDb } from "@/services/firebaseAdmin";

import {
  appCheckErrorResponse,
  requireAppCheck,
} from "@/services/appCheckServer";

export const runtime = "nodejs";

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

export async function POST(request) {
  try {
    await requireAppCheck(request);
    const {
      registrationId,
      token,
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
            "The consent link is incomplete.",
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

    if (!registrationSnapshot.exists) {
      return Response.json(
        {
          success: false,

          message:
            "This registration could not be found.",
        },
        {
          status: 404,
        }
      );
    }

    const registration =
      registrationSnapshot.data();

    if (
      registration.status ===
        "consent_approved" ||
      registration.consentStatus ===
        "approved"
    ) {
      return Response.json(
        {
          success: false,

          message:
            "This consent request has already been completed.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      registration.status ===
      "account_created"
    ) {
      return Response.json(
        {
          success: false,

          message:
            "This account has already been created.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      registration.requiresParentalConsent !==
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
            "This consent request is not available.",
        },
        {
          status: 409,
        }
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
      return Response.json(
        {
          success: false,

          message:
            "This consent link is invalid.",
        },
        {
          status: 401,
        }
      );
    }

    const expiryDate =
      registration.consentExpiresAt
        ?.toDate?.() ||
      new Date(
        registration.consentExpiresAt
      );

    if (
      Number.isNaN(expiryDate.getTime()) ||
      expiryDate.getTime() <
        Date.now()
    ) {
      return Response.json(
        {
          success: false,

          message:
            "This consent link has expired. Please begin registration again.",
        },
        {
          status: 410,
        }
      );
    }

    /*
      Only send the minimum information
      required by the consent page.
    */

    return Response.json({
      success: true,

      registration: {
        registrationId,

        firstName:
          registration.firstName,

        lastName:
          registration.lastName,

        status:
          registration.status,
      },
    });
  } catch (error) {
    const appCheckResponse =
      appCheckErrorResponse(error);

    if (appCheckResponse) {
      return appCheckResponse;
    }
    
    console.error(
      "Consent verification error:",
      error
    );

    return Response.json(
      {
        success: false,

        message:
          "The consent link could not be verified.",
      },
      {
        status: 500,
      }
    );
  }
}