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

export const runtime =
  "nodejs";

const YOUTH_ID_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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

function createRandomYouthId() {
  let randomPart = "";

  for (
    let index = 0;
    index < 12;
    index += 1
  ) {
    randomPart +=
      YOUTH_ID_ALPHABET[
        crypto.randomInt(
          0,
          YOUTH_ID_ALPHABET.length
        )
      ];
  }

  return `YI-${randomPart}`;
}

async function reserveUniqueYouthId(
  registrationId
) {
  for (
    let attempt = 0;
    attempt < 15;
    attempt += 1
  ) {
    const youthId =
      createRandomYouthId();

    const reservationReference =
      adminDb
        .collection(
          "youthIdReservations"
        )
        .doc(
          youthId.toLowerCase()
        );

    let reserved =
      false;

    await adminDb.runTransaction(
      async (
        transaction
      ) => {
        const snapshot =
          await transaction.get(
            reservationReference
          );

        if (
          snapshot.exists
        ) {
          return;
        }

        transaction.set(
          reservationReference,
          {
            youthId,
            registrationId,

            status:
              "reserved",

            createdAt:
              FieldValue.serverTimestamp(),
          }
        );

        reserved =
          true;
      }
    );

    if (reserved) {
      return {
        youthId,
        reservationReference,
      };
    }
  }

  throw new Error(
    "A unique Youth Initiative ID could not be generated."
  );
}

function validatePassword(
  password,
  registration
) {
  if (
    typeof password !==
    "string"
  ) {
    return "Password is required.";
  }

  if (
    password.length < 10 ||
    password.length > 64
  ) {
    return "Password must contain between 10 and 64 characters.";
  }

  if (
    !/[A-Z]/.test(
      password
    )
  ) {
    return "Password must contain an uppercase letter.";
  }

  if (
    !/[a-z]/.test(
      password
    )
  ) {
    return "Password must contain a lowercase letter.";
  }

  if (
    !/[0-9]/.test(
      password
    )
  ) {
    return "Password must contain a number.";
  }

  if (
    !/[^A-Za-z0-9]/.test(
      password
    )
  ) {
    return "Password must contain a special character.";
  }

  const passwordLower =
    password.toLowerCase();

  if (
    passwordLower.includes(
      registration.firstName.toLowerCase()
    ) ||
    passwordLower.includes(
      registration.lastName.toLowerCase()
    )
  ) {
    return "Password cannot contain the student's name.";
  }

  return null;
}

function createRequestError(
  message,
  status,
  code
) {
  const error =
    new Error(message);

  error.status =
    status;

  error.code =
    code;

  return error;
}

function getExpiryDate(
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

export async function POST(
  request
) {
  let createdUser =
    null;

  let youthIdReservation =
    null;

  let registrationReference =
    null;

  let activationClaimed =
    false;

  try {
    /*
      Account activation is a
      sensitive one-time action.

      The frontend sends a
      limited-use App Check token,
      so consume it here.
    */

    await requireAppCheck(
      request,
      {
        consume: true,
      }
    );

    const {
      registrationId,
      token,
      password,
      confirmPassword,
    } =
      await request.json();

    if (
      typeof registrationId !==
        "string" ||
      !registrationId.trim() ||
      typeof token !==
        "string" ||
      !token.trim() ||
      typeof password !==
        "string" ||
      typeof confirmPassword !==
        "string"
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "All password fields are required.",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      password !==
      confirmPassword
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "Passwords do not match.",
        },
        {
          status:
            400,
        }
      );
    }

    registrationReference =
      adminDb
        .collection(
          "pendingRegistrations"
        )
        .doc(
          registrationId.trim()
        );

    /*
      Atomically validate the
      activation token and lock
      the registration while the
      Firebase account is created.
    */

    const registration =
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

          const registrationData =
            snapshot.data();

          if (
            registrationData.status ===
            "account_created"
          ) {
            throw createRequestError(
              "This account has already been activated.",
              409,
              "account-already-created"
            );
          }

          if (
            registrationData.activationInProgress ===
            true
          ) {
            throw createRequestError(
              "This account is already being activated. Please wait and try again.",
              409,
              "activation-in-progress"
            );
          }

          const requiresParentalConsent =
            registrationData.requiresParentalConsent ===
            true;

          let storedTokenHash =
            null;

          let tokenExpiry =
            null;

          /*
            MINOR FLOW

            Parent or guardian consent
            must already be approved.

            /api/consent/approve creates
            a separate activation token.
          */

          if (
            requiresParentalConsent
          ) {
            if (
              registrationData.status !==
                "consent_approved" ||
              registrationData.consentStatus !==
                "approved"
            ) {
              throw createRequestError(
                "Parental consent must be completed before this account can be activated.",
                403,
                "consent-required"
              );
            }

            storedTokenHash =
              registrationData.activationTokenHash;

            tokenExpiry =
              getExpiryDate(
                registrationData.activationExpiresAt
              );
          } else {
            /*
              ADULT FLOW

              The contact email must
              already have been verified.

              /api/email-verification/verify
              creates the activation token
              used here.

              The original email
              verification token can never
              activate an account.
            */

            if (
              registrationData.status !==
                "email_verified" ||
              registrationData.emailVerificationStatus !==
                "verified" ||
              registrationData.consentStatus !==
                "not_required"
            ) {
              throw createRequestError(
                "Please verify your email address before creating your account.",
                403,
                "email-verification-required"
              );
            }

            storedTokenHash =
              registrationData.activationTokenHash;

            tokenExpiry =
              getExpiryDate(
                registrationData.activationExpiresAt
              );
          }

          const providedTokenHash =
            hashToken(
              token.trim()
            );

          if (
            !hashesMatch(
              providedTokenHash,
              storedTokenHash
            )
          ) {
            throw createRequestError(
              "The account setup link is invalid.",
              401,
              "invalid-activation-token"
            );
          }

          if (
            !tokenExpiry ||
            tokenExpiry.getTime() <
              Date.now()
          ) {
            throw createRequestError(
              "The account setup link has expired.",
              410,
              "activation-token-expired"
            );
          }

          const passwordError =
            validatePassword(
              password,
              registrationData
            );

          if (
            passwordError
          ) {
            throw createRequestError(
              passwordError,
              400,
              "invalid-password"
            );
          }

          transaction.update(
            registrationReference,
            {
              activationInProgress:
                true,

              activationStartedAt:
                FieldValue.serverTimestamp(),

              updatedAt:
                FieldValue.serverTimestamp(),
            }
          );

          return registrationData;
        }
      );

    activationClaimed =
      true;

    /*
      Generate a random Youth ID.

      The ID contains no name,
      birth date or other personal
      information.
    */

    youthIdReservation =
      await reserveUniqueYouthId(
        registrationId.trim()
      );

    const youthId =
      youthIdReservation.youthId;

    const internalEmail =
      `${youthId.toLowerCase()}@youthinitiative.local`;

    /*
      Firebase Authentication
      securely stores the password.

      The password is never stored
      in Firestore.
    */

    createdUser =
      await adminAuth.createUser(
        {
          email:
            internalEmail,

          password,

          displayName:
            `${registration.firstName} ${registration.lastName}`,

          /*
            This is the internal
            Youth-ID Firebase account.

            It is not claiming that
            the contact email itself
            is the Firebase Auth email.
          */
          emailVerified:
            true,

          disabled:
            false,
        }
      );

    const studentReference =
      adminDb
        .collection(
          "students"
        )
        .doc(
          createdUser.uid
        );

    const batch =
      adminDb.batch();

    batch.set(
      studentReference,
      {
        firebaseUid:
          createdUser.uid,

        registrationId:
          registrationId.trim(),

        firstName:
          registration.firstName,

        lastName:
          registration.lastName,

        fullName:
          `${registration.firstName} ${registration.lastName}`,

        contactEmail:
          registration.email,

        /*
          Adults proved ownership of
          their contact email during
          registration.

          Minor student contact email
          ownership is not independently
          verified by the parental
          consent flow.
        */
        contactEmailVerified:
          registration.requiresParentalConsent ===
          true
            ? false
            : registration.emailVerificationStatus ===
                "verified",

        contactEmailVerifiedAt:
          registration.requiresParentalConsent ===
          true
            ? null
            : registration.emailVerifiedAt ||
              null,

        parentEmail:
          registration.parentEmail ||
          null,

        internalEmail,

        youthId,

        dateOfBirth:
          registration.dateOfBirth,

        requiresParentalConsent:
          registration.requiresParentalConsent ===
          true,

        role:
          "student",

        accountStatus:
          "active",

        consentStatus:
          registration.requiresParentalConsent ===
          true
            ? "approved"
            : "not_required",

        learningMode:
          null,

        interests:
          [],

        onboardingCompleted:
          false,

        totalXp:
          0,

        level:
          1,

        badgeCount:
          0,

        completedWorkshopCount:
          0,

        currentStreak:
          0,

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),

        lastLoginAt:
          null,
      }
    );

    /*
      Finalize registration.

      BOTH adult and minor flows
      now use a separate activation
      token.

      Remove that token after the
      account has been created.
    */

    const registrationUpdate =
      {
        firebaseUid:
          createdUser.uid,

        youthId,

        internalEmail,

        status:
          "account_created",

        accountCreatedAt:
          FieldValue.serverTimestamp(),

        activationTokenHash:
          null,

        activationExpiresAt:
          null,

        activationInProgress:
          false,

        activationStartedAt:
          null,

        activationCompletedAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      };

    /*
      Clean any obsolete setup
      material as defense-in-depth.
    */

    if (
      registration.requiresParentalConsent ===
      true
    ) {
      registrationUpdate.consentTokenHash =
        null;

      registrationUpdate.consentExpiresAt =
        null;
    } else {
      registrationUpdate.emailVerificationTokenHash =
        null;

      registrationUpdate.emailVerificationExpiresAt =
        null;

      /*
        These fields belonged to the
        older adult registration flow.
        Clearing them is safe if they
        happen to exist.
      */

      registrationUpdate.consentTokenHash =
        null;

      registrationUpdate.consentExpiresAt =
        null;
    }

    batch.update(
      registrationReference,
      registrationUpdate
    );

    batch.update(
      youthIdReservation
        .reservationReference,
      {
        status:
          "assigned",

        firebaseUid:
          createdUser.uid,

        assignedAt:
          FieldValue.serverTimestamp(),
      }
    );

    await batch.commit();

    return Response.json(
      {
        success:
          true,

        youthId,

        firstName:
          registration.firstName,
      },
      {
        status:
          201,
      }
    );
  } catch (
    error
  ) {
    /*
      App Check errors should
      return the App Check
      response.
    */

    const appCheckResponse =
      appCheckErrorResponse(
        error
      );

    if (
      appCheckResponse &&
      error?.code !==
        "invalid-activation-token"
    ) {
      return appCheckResponse;
    }

    console.error(
      "Account activation error:",
      error
    );

    /*
      If Firebase Auth was
      created but Firestore
      failed, remove the Auth
      user so a broken account
      is not left behind.
    */

    if (
      createdUser?.uid
    ) {
      try {
        await adminAuth.deleteUser(
          createdUser.uid
        );
      } catch (
        cleanupError
      ) {
        console.error(
          "Failed to clean up Auth user:",
          cleanupError
        );
      }
    }

    /*
      Remove an unused Youth ID
      reservation after failure.
    */

    if (
      youthIdReservation
        ?.reservationReference
    ) {
      try {
        await youthIdReservation
          .reservationReference
          .delete();
      } catch (
        cleanupError
      ) {
        console.error(
          "Failed to clean up Youth ID reservation:",
          cleanupError
        );
      }
    }

    /*
      Release the activation lock
      so the user can retry while
      the activation token remains
      valid.
    */

    if (
      activationClaimed &&
      registrationReference
    ) {
      try {
        const snapshot =
          await registrationReference.get();

        if (
          snapshot.exists &&
          snapshot.data()
            .status !==
            "account_created"
        ) {
          await registrationReference.update(
            {
              activationInProgress:
                false,

              activationStartedAt:
                null,

              updatedAt:
                FieldValue.serverTimestamp(),
            }
          );
        }
      } catch (
        cleanupError
      ) {
        console.error(
          "Failed to release activation lock:",
          cleanupError
        );
      }
    }

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
            error.code,
        },
        {
          status:
            error.status,
        }
      );
    }

    if (
      error?.code ===
      "auth/email-already-exists"
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "An account has already been created for this registration.",
        },
        {
          status:
            409,
        }
      );
    }

    return Response.json(
      {
        success:
          false,

        message:
          "The account could not be activated. Please try again.",
      },
      {
        status:
          500,
      }
    );
  }
}