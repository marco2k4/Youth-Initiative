import crypto from "crypto";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
} from "@/services/firebaseAdmin";

import {
  appCheckErrorResponse,
  requireAppCheck,
} from "@/services/appCheckServer";

import {
  sendPasswordChangedEmail,
} from "@/services/accountEmailServer";

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
    typeof password !==
      "string" ||
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

export async function POST(request) {
  let resetReference = null;
  let operationId = null;
  let studentId = null;

  try {
    await requireAppCheck(
      request,
      {
        consume: true,
      }
    );

    const {
      requestId,
      token,
      password,
      confirmPassword,
    } =
      await request.json();

    if (
      typeof requestId !==
        "string" ||
      !requestId.trim() ||
      typeof token !==
        "string" ||
      !token.trim()
    ) {
      return errorResponse(
        "Password reset information is missing.",
        400
      );
    }

    if (
      typeof password !==
        "string" ||
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
      validatePassword(
        password
      );

    if (
      passwordError
    ) {
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
        .doc(
          requestId.trim()
        );

    operationId =
      crypto.randomUUID();

    /*
      SECURITY TRANSACTION

      The token is permanently
      consumed BEFORE Firebase
      changes the password.

      If anything fails afterward,
      this token can never be used
      again.
    */

    await adminDb.runTransaction(
      async (
        transaction
      ) => {
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
          reset.status ===
          "completed"
        ) {
          throw new Error(
            "RESET_ALREADY_USED"
          );
        }

        /*
          processing means another
          request already consumed
          this token.

          Never reopen it.
        */

        if (
          reset.status ===
            "processing" ||
          reset.status ===
            "failed"
        ) {
          throw new Error(
            "RESET_ALREADY_USED"
          );
        }

        if (
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
          Check expiry.
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
          Check reset token.
        */

        const providedTokenHash =
          hashToken(
            token
          );

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
            .doc(
              studentId
            );

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

        /*
          Only active student
          accounts can reset
          passwords.
        */

        if (
          student.role !==
            "student" ||
          student.accountStatus !==
            "active"
        ) {
          throw new Error(
            "ACCOUNT_INACTIVE"
          );
        }

        /*
          Verify Firebase UID
          consistency.
        */

        if (
          typeof student.firebaseUid ===
            "string" &&
          student.firebaseUid !==
            studentId
        ) {
          throw new Error(
            "ACCOUNT_MISMATCH"
          );
        }

        /*
          Verify Youth ID
          consistency.
        */

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
          CONSUME TOKEN NOW.

          From this point forward
          this authorization can
          never be reused.
        */

        transaction.update(
          resetReference,
          {
            status:
              "processing",

            resetTokenHash:
              null,

            resetExpiresAt:
              null,

            tokenConsumedAt:
              FieldValue.serverTimestamp(),

            processingOperationId:
              operationId,

            updatedAt:
              FieldValue.serverTimestamp(),
          }
        );
      }
    );

    /*
      Change password through
      Firebase Auth.

      Password is NEVER written
      to Firestore.
    */

    try {
      await adminAuth.updateUser(
        studentId,
        {
          password,
        }
      );

      /*
        Kill existing Firebase
        sessions.

        User must authenticate
        again using the new
        password.
      */

      await adminAuth.revokeRefreshTokens(
        studentId
      );
    } catch (
      authError
    ) {
      console.error(
        "Firebase password update failed:",
        authError?.code ||
          authError?.message
      );

      /*
        FAIL CLOSED.

        Do NOT restore
        resetTokenHash.

        User must request another
        reset link if Firebase
        failed.
      */

      try {
        await resetReference.update(
          {
            status:
              "failed",

            failureStage:
              "firebase_auth",

            failedAt:
              FieldValue.serverTimestamp(),

            updatedAt:
              FieldValue.serverTimestamp(),
          }
        );
      } catch (
        firestoreError
      ) {
        console.error(
          "Could not record password reset failure:",
          firestoreError?.message
        );
      }

      return errorResponse(
        "Password could not be updated. Please request a new password reset email and try again.",
        500
      );
    }

    /*
      Finalize Firestore record.

      The password has already
      changed and the token has
      already been destroyed.
    */

    try {
      await adminDb.runTransaction(
        async (
          transaction
        ) => {
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

              processingOperationId:
                FieldValue.delete(),

              updatedAt:
                FieldValue.serverTimestamp(),
            }
          );
        }
      );
    } catch (
      finalizationError
    ) {
      /*
        Password change already
        succeeded.

        Never tell the user to
        reuse this link because
        the token was consumed.

        Log the metadata failure
        instead.
      */

      console.error(
        "Password reset finalization error:",
        finalizationError?.message
      );
    }

    /*
      Send a security notification
      AFTER the password has already
      been changed successfully.

      Notification delivery must
      never affect the completed
      password reset.
    */

    try {
      const [
        studentSnapshot,
        resetSnapshot,
      ] =
        await Promise.all([
          adminDb
            .collection(
              "students"
            )
            .doc(
              studentId
            )
            .get(),

          resetReference.get(),
        ]);

      if (
        studentSnapshot.exists &&
        resetSnapshot.exists
      ) {
        const student =
          studentSnapshot.data();

        const reset =
          resetSnapshot.data();

        const notificationResult =
          await sendPasswordChangedEmail(
            {
              firstName:
                student.firstName,

              email:
                student.contactEmail,

              parentEmail:
                student.parentEmail,

              recoveryMode:
                reset.recoveryMode,
            }
          );

        if (
          !notificationResult.success
        ) {
          console.error(
            "Password-change notification was not sent:",
            notificationResult.error
          );
        }
      }
    } catch (
      notificationError
    ) {
      console.error(
        "Unexpected password-change notification error:",
        notificationError
      );
    }

    return Response.json(
      {
        success:
          true,

        message:
          "Password updated successfully. Please sign in again using your new password.",
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
        "This password reset link has already been used. Please request a new one.",
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

    console.error(
      "Complete password reset error:",
      error?.message
    );

    return errorResponse(
      "Password could not be updated.",
      500
    );
  }
}