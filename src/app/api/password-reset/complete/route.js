import crypto from "crypto";

import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
} from "@/services/firebaseAdmin";

export const runtime = "nodejs";

const PROCESSING_LOCK_MINUTES = 5;

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

function validatePassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 10
  ) {
    return "Password must contain at least 10 characters.";
  }

  if (password.length > 64) {
    return "Password cannot exceed 64 characters.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must contain an uppercase letter.";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must contain a lowercase letter.";
  }

  if (!/[0-9]/.test(password)) {
    return "Password must contain a number.";
  }

  if (
    !/[^A-Za-z0-9]/.test(
      password
    )
  ) {
    return "Password must contain a special character.";
  }

  return null;
}

function errorResponse(
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

async function releaseProcessingLock(
  resetReference,
  operationId
) {
  try {
    await adminDb.runTransaction(
      async (transaction) => {
        const snapshot =
          await transaction.get(
            resetReference
          );

        if (!snapshot.exists) {
          return;
        }

        const reset =
          snapshot.data();

        if (
          reset.status ===
            "processing" &&
          reset.processingOperationId ===
            operationId
        ) {
          transaction.update(
            resetReference,
            {
              status:
                "ready_for_reset",

              processingOperationId:
                FieldValue.delete(),

              processingStartedAt:
                FieldValue.delete(),

              updatedAt:
                FieldValue.serverTimestamp(),
            }
          );
        }
      }
    );
  } catch (error) {
    console.error(
      "Could not release password reset lock:",
      error?.message
    );
  }
}

export async function POST(request) {
  let resetReference = null;
  let operationId = null;
  let studentId = null;

  try {
    const {
      requestId,
      token,
      password,
      confirmPassword,
    } = await request.json();

    /*
      Basic request validation.
    */

    if (
      typeof requestId !== "string" ||
      !requestId.trim() ||
      typeof token !== "string" ||
      !token.trim()
    ) {
      return errorResponse(
        "Password reset information is missing.",
        400
      );
    }

    if (
      typeof password !== "string" ||
      typeof confirmPassword !==
        "string"
    ) {
      return errorResponse(
        "Password information is incomplete.",
        400
      );
    }

    if (
      password !==
      confirmPassword
    ) {
      return errorResponse(
        "Passwords do not match.",
        400
      );
    }

    const passwordError =
      validatePassword(password);

    if (passwordError) {
      return errorResponse(
        passwordError,
        400
      );
    }

    resetReference =
      adminDb
        .collection(
          "passwordResetRequests"
        )
        .doc(requestId.trim());

    operationId =
      crypto.randomUUID();

    /*
      ------------------------------------------------
      SECURITY TRANSACTION

      Before touching Firebase Auth we verify:

      - reset request exists
      - request has not been used
      - request is ready
      - token is valid
      - token is not expired
      - recovery mode is valid
      - minors received guardian approval
      - student exists
      - account is active
      - Firebase UID matches student record

      Then we temporarily lock the request.
      ------------------------------------------------
    */

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

        /*
          Already consumed.
        */

        if (
          reset.status ===
          "completed"
        ) {
          throw new Error(
            "RESET_ALREADY_USED"
          );
        }

        /*
          Handle an existing processing lock.

          A fresh lock blocks a concurrent
          request.

          A stale lock older than 5 minutes
          may be recovered.
        */

        if (
          reset.status ===
          "processing"
        ) {
          const processingStartedAt =
            getDate(
              reset.processingStartedAt
            );

          const lockExpired =
            !processingStartedAt ||
            Date.now() -
              processingStartedAt.getTime() >=
              PROCESSING_LOCK_MINUTES *
                60 *
                1000;

          if (!lockExpired) {
            throw new Error(
              "RESET_PROCESSING"
            );
          }
        } else if (
          reset.status !==
          "ready_for_reset"
        ) {
          throw new Error(
            "RESET_NOT_READY"
          );
        }

        /*
          Validate recovery mode.
        */

        if (
          reset.recoveryMode ===
          "guardian"
        ) {
          if (
            reset
              .requiresGuardianApproval !==
              true ||
            reset.guardianVerified !==
              true
          ) {
            throw new Error(
              "GUARDIAN_APPROVAL_REQUIRED"
            );
          }
        } else if (
          reset.recoveryMode ===
          "student"
        ) {
          if (
            reset
              .requiresGuardianApproval ===
            true
          ) {
            throw new Error(
              "INVALID_RECOVERY_MODE"
            );
          }
        } else {
          throw new Error(
            "INVALID_RECOVERY_MODE"
          );
        }

        /*
          Validate token expiry.
        */

        const resetExpiry =
          getDate(
            reset.resetExpiresAt
          );

        if (
          !resetExpiry ||
          resetExpiry.getTime() <
            Date.now()
        ) {
          throw new Error(
            "RESET_EXPIRED"
          );
        }

        /*
          Validate one-time token.

          Firestore contains only the hash.
        */

        const providedTokenHash =
          hashToken(token);

        if (
          !hashesMatch(
            providedTokenHash,
            reset.resetTokenHash
          )
        ) {
          throw new Error(
            "INVALID_RESET_TOKEN"
          );
        }

        if (
          typeof reset.studentId !==
            "string" ||
          !reset.studentId
        ) {
          throw new Error(
            "INVALID_STUDENT"
          );
        }

        studentId =
          reset.studentId;

        const studentReference =
          adminDb
            .collection(
              "students"
            )
            .doc(studentId);

        /*
          Firestore transactions require
          reads before writes, so student
          validation happens before locking.
        */

        const studentSnapshot =
          await transaction.get(
            studentReference
          );

        if (
          !studentSnapshot.exists
        ) {
          throw new Error(
            "INVALID_STUDENT"
          );
        }

        const student =
          studentSnapshot.data();

        if (
          student.role !== "student" ||
          student.accountStatus !==
            "active"
        ) {
          throw new Error(
            "ACCOUNT_INACTIVE"
          );
        }

        /*
          Make sure the reset request belongs
          to the same Firebase account.
        */

        if (
          student.firebaseUid &&
          student.firebaseUid !==
            studentId
        ) {
          throw new Error(
            "ACCOUNT_MISMATCH"
          );
        }

        if (
          reset.youthId &&
          student.youthId &&
          reset.youthId !==
            student.youthId
        ) {
          throw new Error(
            "ACCOUNT_MISMATCH"
          );
        }

        /*
          Lock this reset request so the
          same token cannot be processed
          concurrently.
        */

        transaction.update(
          resetReference,
          {
            status:
              "processing",

            processingOperationId:
              operationId,

            processingStartedAt:
              Timestamp.fromDate(
                new Date()
              ),

            updatedAt:
              FieldValue.serverTimestamp(),
          }
        );
      }
    );

    /*
      ------------------------------------------------
      FIREBASE AUTH

      Firebase Admin changes the password.

      No password is stored in Firestore.
      ------------------------------------------------
    */

    try {
      await adminAuth.updateUser(
        studentId,
        {
          password,
        }
      );

      /*
        Revoke existing refresh tokens after
        a successful password reset.

        This prevents old authenticated
        sessions from continuing indefinitely.
      */

      await adminAuth.revokeRefreshTokens(
        studentId
      );
    } catch (authError) {
      console.error(
        "Firebase password update failed:",
        authError?.code ||
          authError?.message
      );

      await releaseProcessingLock(
        resetReference,
        operationId
      );

      return errorResponse(
        "Password could not be updated. Please try again.",
        500
      );
    }

    /*
      ------------------------------------------------
      FINALIZE

      Destroy the reset token after the
      Firebase password has changed.
      ------------------------------------------------
    */

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
            "FINALIZATION_FAILED"
          );
        }

        const reset =
          resetSnapshot.data();

        if (
          reset.status !==
            "processing" ||
          reset.processingOperationId !==
            operationId
        ) {
          throw new Error(
            "FINALIZATION_FAILED"
          );
        }

        transaction.update(
          resetReference,
          {
            status:
              "completed",

            usedAt:
              FieldValue.serverTimestamp(),

            resetTokenHash:
              null,

            resetExpiresAt:
              null,

            processingOperationId:
              FieldValue.delete(),

            processingStartedAt:
              FieldValue.delete(),

            updatedAt:
              FieldValue.serverTimestamp(),
          }
        );
      }
    );

    return Response.json({
      success: true,

      message:
        "Password updated successfully.",
    });
  } catch (error) {
    const errorCode =
      error?.message;

    if (
      errorCode ===
      "RESET_NOT_FOUND"
    ) {
      return errorResponse(
        "Password reset request was not found.",
        404
      );
    }

    if (
      errorCode ===
      "RESET_ALREADY_USED"
    ) {
      return errorResponse(
        "This password reset link has already been used.",
        409
      );
    }

    if (
      errorCode ===
      "RESET_PROCESSING"
    ) {
      return errorResponse(
        "This password reset is already being processed.",
        409
      );
    }

    if (
      errorCode ===
      "RESET_NOT_READY"
    ) {
      return errorResponse(
        "This password reset request is not ready.",
        403
      );
    }

    if (
      errorCode ===
      "GUARDIAN_APPROVAL_REQUIRED"
    ) {
      return errorResponse(
        "Parent or guardian approval is required before resetting this password.",
        403
      );
    }

    if (
      errorCode ===
      "INVALID_RECOVERY_MODE"
    ) {
      return errorResponse(
        "This password reset request is invalid.",
        400
      );
    }

    if (
      errorCode ===
      "RESET_EXPIRED"
    ) {
      return errorResponse(
        "This password reset link has expired.",
        410
      );
    }

    if (
      errorCode ===
      "INVALID_RESET_TOKEN"
    ) {
      return errorResponse(
        "Password reset token is invalid.",
        401
      );
    }

    if (
      errorCode ===
        "INVALID_STUDENT" ||
      errorCode ===
        "ACCOUNT_MISMATCH"
    ) {
      return errorResponse(
        "This password reset request is invalid.",
        403
      );
    }

    if (
      errorCode ===
      "ACCOUNT_INACTIVE"
    ) {
      return errorResponse(
        "This account is not available for password recovery.",
        403
      );
    }

    /*
      At this point Firebase may already
      have changed the password, so we do
      not automatically unlock a failed
      finalization.

      The stale-lock recovery above protects
      against permanent lockout.
    */

    console.error(
      "Complete password reset error:",
      error?.message
    );

    return errorResponse(
      "Password could not be updated. Please try again.",
      500
    );
  }
}