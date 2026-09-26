import crypto from "crypto";

import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "@/services/firebaseAdmin";

export const runtime = "nodejs";

const RESET_TOKEN_EXPIRY_MINUTES = 30;

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

function verificationError(
  message,
  status
) {
  return Response.json(
    {
      success: false,
      message,
    },
    {
      status,
    }
  );
}

export async function POST(request) {
  try {
    const {
      requestId,
      token,
      approve,
    } = await request.json();

    if (
      typeof requestId !== "string" ||
      !requestId.trim() ||
      typeof token !== "string" ||
      !token.trim()
    ) {
      return verificationError(
        "Verification link is incomplete.",
        400
      );
    }

    const resetReference =
      adminDb
        .collection(
          "passwordResetRequests"
        )
        .doc(requestId);

    /*
      ------------------------------------------------
      LINK CHECK ONLY

      The parent page calls this first with:
      approve: false

      Nothing is consumed or changed.
      ------------------------------------------------
    */

    if (approve !== true) {
      const resetSnapshot =
        await resetReference.get();

      if (!resetSnapshot.exists) {
        return verificationError(
          "This password reset link is unavailable.",
          404
        );
      }

      const reset =
        resetSnapshot.data();

      /*
        This route is only for guardian
        verification.

        Adults bypass this page and receive
        their reset token directly by email.
      */

      if (
        reset.recoveryMode !==
          "guardian" ||
        reset.requiresGuardianApproval !==
          true
      ) {
        return verificationError(
          "This verification link is not valid for this recovery request.",
          400
        );
      }

      if (
        reset.status !==
        "pending_guardian_verification"
      ) {
        if (
          reset.status ===
            "ready_for_reset" ||
          reset.guardianVerified ===
            true
        ) {
          return verificationError(
            "This verification link has already been used.",
            409
          );
        }

        if (
          reset.status ===
          "completed"
        ) {
          return verificationError(
            "This password reset has already been completed.",
            409
          );
        }

        return verificationError(
          "This password reset request is no longer available.",
          409
        );
      }

      const expiry =
        getDate(
          reset.verificationExpiresAt
        );

      if (
        !expiry ||
        expiry.getTime() <
          Date.now()
      ) {
        return verificationError(
          "This verification link has expired.",
          410
        );
      }

      const providedHash =
        hashToken(token);

      if (
        !hashesMatch(
          providedHash,
          reset.verificationTokenHash
        )
      ) {
        return verificationError(
          "Verification token is invalid.",
          401
        );
      }

      return Response.json({
        success: true,
        verified: false,
        readyForApproval: true,
      });
    }

    /*
      ------------------------------------------------
      PARENT APPROVES

      Important security change:

      We DO NOT use the guardian verification
      token as the password-reset token.

      Once the guardian approves, we create a
      completely new one-time token.
      ------------------------------------------------
    */

    const resetToken =
      crypto
        .randomBytes(32)
        .toString("hex");

    const resetTokenHash =
      hashToken(resetToken);

    const resetTokenExpiresAt =
      Timestamp.fromDate(
        new Date(
          Date.now() +
            RESET_TOKEN_EXPIRY_MINUTES *
              60 *
              1000
        )
      );

    let youthId = null;

    await adminDb.runTransaction(
      async (transaction) => {
        const resetSnapshot =
          await transaction.get(
            resetReference
          );

        if (
          !resetSnapshot.exists
        ) {
          throw new Error(
            "RESET_NOT_FOUND"
          );
        }

        const reset =
          resetSnapshot.data();

        if (
          reset.recoveryMode !==
            "guardian" ||
          reset.requiresGuardianApproval !==
            true
        ) {
          throw new Error(
            "INVALID_RECOVERY_MODE"
          );
        }

        if (
          reset.status ===
            "ready_for_reset" ||
          reset.guardianVerified ===
            true
        ) {
          throw new Error(
            "ALREADY_VERIFIED"
          );
        }

        if (
          reset.status ===
          "completed"
        ) {
          throw new Error(
            "RESET_COMPLETED"
          );
        }

        if (
          reset.status !==
          "pending_guardian_verification"
        ) {
          throw new Error(
            "RESET_UNAVAILABLE"
          );
        }

        const expiry =
          getDate(
            reset.verificationExpiresAt
          );

        if (
          !expiry ||
          expiry.getTime() <
            Date.now()
        ) {
          throw new Error(
            "VERIFICATION_EXPIRED"
          );
        }

        const providedHash =
          hashToken(token);

        if (
          !hashesMatch(
            providedHash,
            reset.verificationTokenHash
          )
        ) {
          throw new Error(
            "INVALID_TOKEN"
          );
        }

        youthId =
          reset.youthId || null;

        transaction.update(
          resetReference,
          {
            guardianVerified: true,

            status:
              "ready_for_reset",

            verificationTokenHash:
              null,

            verificationUsedAt:
              FieldValue.serverTimestamp(),

            resetTokenHash,

            resetExpiresAt:
              resetTokenExpiresAt,

            updatedAt:
              FieldValue.serverTimestamp(),
          }
        );
      }
    );

    /*
      The plaintext reset token is returned
      only once.

      Firestore stores only its hash.
    */

    return Response.json({
      success: true,

      verified: true,

      youthId,

      resetToken,
    });
  } catch (error) {
    const errorCode =
      error?.message;

    if (
      errorCode ===
      "RESET_NOT_FOUND"
    ) {
      return verificationError(
        "This password reset link is unavailable.",
        404
      );
    }

    if (
      errorCode ===
      "INVALID_RECOVERY_MODE"
    ) {
      return verificationError(
        "This verification link is not valid for this recovery request.",
        400
      );
    }

    if (
      errorCode ===
      "ALREADY_VERIFIED"
    ) {
      return verificationError(
        "This verification link has already been used.",
        409
      );
    }

    if (
      errorCode ===
      "RESET_COMPLETED"
    ) {
      return verificationError(
        "This password reset has already been completed.",
        409
      );
    }

    if (
      errorCode ===
      "RESET_UNAVAILABLE"
    ) {
      return verificationError(
        "This password reset request is no longer available.",
        409
      );
    }

    if (
      errorCode ===
      "VERIFICATION_EXPIRED"
    ) {
      return verificationError(
        "This verification link has expired.",
        410
      );
    }

    if (
      errorCode ===
      "INVALID_TOKEN"
    ) {
      return verificationError(
        "Verification token is invalid.",
        401
      );
    }

    console.error(
      "Password reset verification error:",
      error?.message
    );

    return Response.json(
      {
        success: false,

        message:
          "Verification could not be completed.",
      },
      {
        status: 500,
      }
    );
  }
}