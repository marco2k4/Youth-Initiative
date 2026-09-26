import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
} from "@/services/firebaseAdmin";

import {
  adminAccessResponse,
  requireActiveAdmin,
} from "@/services/adminAccess";

export const runtime = "nodejs";

const VALID_LEARNING_MODES = [
  "in-person",
  "online",
  "both",
];

const VALID_ACCOUNT_STATUSES = [
  "active",
  "inactive",
];

const VALID_INTERESTS = [
  "coding",
  "artificial intelligence",
  "robotics",
  "skilled trades",
  "business",
  "design",
  "health",
  "aviation",
  "culinary",
];

const NAME_REGEX =
  /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/;

const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function apiError(
  message,
  status
) {
  const error =
    new Error(message);

  error.status = status;

  return error;
}

function customErrorResponse(
  error
) {
  if (
    [
      400,
      404,
      409,
    ].includes(
      error?.status
    )
  ) {
    return Response.json(
      {
        success: false,
        message: error.message,
      },
      {
        status:
          error.status,
      }
    );
  }

  return null;
}

function normalizeName(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .replace(
      /\s+/g,
      " "
    );
}

function validateStudentUpdate(
  data
) {
  const firstName =
    normalizeName(
      data.firstName
    );

  const lastName =
    normalizeName(
      data.lastName
    );

  const contactEmail =
    String(
      data.contactEmail ||
      ""
    )
      .trim()
      .toLowerCase();

  const learningMode =
    data.learningMode
      ? String(
          data.learningMode
        ).trim()
      : null;

  const accountStatus =
    String(
      data.accountStatus ||
      ""
    )
      .trim()
      .toLowerCase();

  if (
    firstName.length < 2 ||
    firstName.length > 40 ||
    !NAME_REGEX.test(
      firstName
    )
  ) {
    throw apiError(
      "First name is invalid.",
      400
    );
  }

  if (
    lastName.length < 2 ||
    lastName.length > 40 ||
    !NAME_REGEX.test(
      lastName
    )
  ) {
    throw apiError(
      "Last name is invalid.",
      400
    );
  }

  if (
    contactEmail.length >
      254 ||
    !EMAIL_REGEX.test(
      contactEmail
    )
  ) {
    throw apiError(
      "Contact email is invalid.",
      400
    );
  }

  if (
    learningMode !==
      null &&
    !VALID_LEARNING_MODES.includes(
      learningMode
    )
  ) {
    throw apiError(
      "Learning mode is invalid.",
      400
    );
  }

  if (
    !VALID_ACCOUNT_STATUSES.includes(
      accountStatus
    )
  ) {
    throw apiError(
      "Account status is invalid.",
      400
    );
  }

  if (
    !Array.isArray(
      data.interests
    )
  ) {
    throw apiError(
      "Student interests are invalid.",
      400
    );
  }

  if (
    data.interests.length >
    5
  ) {
    throw apiError(
      "A student can have a maximum of 5 interests.",
      400
    );
  }

  const normalizedInterests =
    data.interests.map(
      (interest) =>
        String(
          interest
        )
          .trim()
          .toLowerCase()
    );

  if (
    normalizedInterests.some(
      (interest) =>
        !VALID_INTERESTS.includes(
          interest
        )
    )
  ) {
    throw apiError(
      "One or more student interests are invalid.",
      400
    );
  }

  if (
    new Set(
      normalizedInterests
    ).size !==
    normalizedInterests.length
  ) {
    throw apiError(
      "Duplicate interests are not allowed.",
      400
    );
  }

  return {
    firstName,
    lastName,

    contactEmail,

    learningMode,

    interests:
      normalizedInterests,

    accountStatus,
  };
}

async function getStudentAndAuthUser(
  studentId
) {
  const studentReference =
    adminDb
      .collection(
        "students"
      )
      .doc(
        studentId
      );

  const studentSnapshot =
    await studentReference.get();

  if (
    !studentSnapshot.exists
  ) {
    throw apiError(
      "Student not found.",
      404
    );
  }

  const student =
    studentSnapshot.data();

  /*
    A document in this collection must
    represent a student account.
  */

  if (
    student.role &&
    student.role !==
      "student"
  ) {
    throw apiError(
      "This account is not a student account.",
      409
    );
  }

  /*
    Student document ID should be the
    Firebase Authentication UID.

    If firebaseUid is stored, it must match.
  */

  if (
    student.firebaseUid &&
    student.firebaseUid !==
      studentId
  ) {
    throw apiError(
      "Student authentication information is inconsistent.",
      409
    );
  }

  let authUser;

  try {
    authUser =
      await adminAuth.getUser(
        studentId
      );
  } catch (error) {
    if (
      error?.code ===
      "auth/user-not-found"
    ) {
      throw apiError(
        "The Firebase account for this student could not be found.",
        409
      );
    }

    throw error;
  }

  return {
    studentReference,
    studentSnapshot,
    student,
    authUser,
  };
}


/*
  ========================================
  GET STUDENTS
  ========================================
*/

export async function GET(
  request
) {
  try {
    await requireActiveAdmin(
      request
    );

    const snapshot =
      await adminDb
        .collection(
          "students"
        )
        .get();

    const students =
      snapshot.docs
        .map(
          (document) => ({
            id:
              document.id,

            ...document.data(),
          })
        )
        .sort(
          (
            firstStudent,
            secondStudent
          ) =>
            String(
              firstStudent
                .firstName ||
              ""
            ).localeCompare(
              String(
                secondStudent
                  .firstName ||
                ""
              )
            )
        );

    return Response.json({
      success: true,
      students,
    });
  } catch (error) {
    const accessResponse =
      adminAccessResponse(
        error
      );

    if (accessResponse) {
      return accessResponse;
    }

    console.error(
      "Admin load students error:",
      error?.message
    );

    return Response.json(
      {
        success: false,

        message:
          "Students could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }
}


/*
  ========================================
  UPDATE STUDENT
  ========================================
*/

export async function PUT(
  request
) {
  let authStateChanged =
    false;

  let previousDisabledState =
    null;

  let targetStudentId =
    null;

  try {
    const admin =
      await requireActiveAdmin(
        request
      );

    const requestBody =
      await request.json();

    targetStudentId =
      typeof requestBody.id ===
        "string"
        ? requestBody.id.trim()
        : "";

    if (
      !targetStudentId
    ) {
      throw apiError(
        "Student ID is required.",
        400
      );
    }

    const validatedData =
      validateStudentUpdate(
        requestBody
      );

    const {
      studentReference,
      authUser,
    } =
      await getStudentAndAuthUser(
        targetStudentId
      );

    /*
      Keep Firebase Authentication's
      disabled state synchronized with
      Firestore accountStatus.
    */

    const desiredDisabledState =
      validatedData
        .accountStatus ===
      "inactive";

    previousDisabledState =
      authUser.disabled;

    if (
      authUser.disabled !==
      desiredDisabledState
    ) {
      await adminAuth.updateUser(
        targetStudentId,
        {
          disabled:
            desiredDisabledState,
        }
      );

      authStateChanged =
        true;
    }

    /*
      If account is being disabled,
      revoke existing refresh tokens.

      This forces old sessions to
      authenticate again.
    */

    if (
      desiredDisabledState
    ) {
      try {
        await adminAuth
          .revokeRefreshTokens(
            targetStudentId
          );
      } catch (
        revokeError
      ) {
        console.error(
          "Student token revocation error:",
          revokeError?.message
        );

        /*
          The Auth account is already
          disabled, so continue writing
          the inactive state to Firestore.
        */
      }
    }

    try {
      await studentReference.update({
        firstName:
          validatedData
            .firstName,

        lastName:
          validatedData
            .lastName,

        fullName:
          `${validatedData.firstName} ${validatedData.lastName}`,

        contactEmail:
          validatedData
            .contactEmail,

        learningMode:
          validatedData
            .learningMode,

        interests:
          validatedData
            .interests,

        accountStatus:
          validatedData
            .accountStatus,

        updatedBy:
          admin.uid,

        updatedAt:
          FieldValue.serverTimestamp(),

        accountStatusUpdatedAt:
          FieldValue.serverTimestamp(),
      });
    } catch (
      firestoreError
    ) {
      /*
        Firebase Auth and Firestore cannot
        participate in one atomic transaction.

        If Firestore fails after we changed
        Firebase's disabled state, attempt to
        restore the previous Auth state.
      */

      if (
        authStateChanged &&
        previousDisabledState !==
          null
      ) {
        try {
          await adminAuth.updateUser(
            targetStudentId,
            {
              disabled:
                previousDisabledState,
            }
          );
        } catch (
          rollbackError
        ) {
          console.error(
            "Student Auth rollback failed:",
            rollbackError?.message
          );
        }
      }

      throw firestoreError;
    }

    return Response.json({
      success: true,

      message:
        validatedData
          .accountStatus ===
        "inactive"
          ? "Student updated and account deactivated successfully."
          : "Student updated successfully.",
    });
  } catch (error) {
    const accessResponse =
      adminAccessResponse(
        error
      );

    if (accessResponse) {
      return accessResponse;
    }

    const customResponse =
      customErrorResponse(
        error
      );

    if (customResponse) {
      return customResponse;
    }

    console.error(
      "Admin update student error:",
      error?.message
    );

    return Response.json(
      {
        success: false,

        message:
          "Student could not be updated.",
      },
      {
        status: 500,
      }
    );
  }
}


/*
  ========================================
  DEACTIVATE STUDENT
  ========================================

  DELETE here means deactivate.

  We do NOT delete the student document
  or Firebase Authentication account.
*/

export async function DELETE(
  request
) {
  let previousDisabledState =
    null;

  let authenticationChanged =
    false;

  let targetStudentId =
    null;

  try {
    const admin =
      await requireActiveAdmin(
        request
      );

    const requestBody =
      await request.json();

    targetStudentId =
      typeof requestBody.id ===
        "string"
        ? requestBody.id.trim()
        : "";

    if (
      !targetStudentId
    ) {
      throw apiError(
        "Student ID is required.",
        400
      );
    }

    const {
      studentReference,
      authUser,
    } =
      await getStudentAndAuthUser(
        targetStudentId
      );

    previousDisabledState =
      authUser.disabled;

    /*
      Disable Firebase Authentication
      before changing Firestore.

      This fails closed:
      the user cannot continue signing in
      if a later database operation fails.
    */

    if (
      !authUser.disabled
    ) {
      await adminAuth.updateUser(
        targetStudentId,
        {
          disabled: true,
        }
      );

      authenticationChanged =
        true;
    }

    /*
      Revoke existing sessions.

      Do not expose revocation errors to
      the browser, but record them.
    */

    try {
      await adminAuth
        .revokeRefreshTokens(
          targetStudentId
        );
    } catch (
      revokeError
    ) {
      console.error(
        "Student token revocation error:",
        revokeError?.message
      );
    }

    try {
      await studentReference.update({
        accountStatus:
          "inactive",

        deactivatedBy:
          admin.uid,

        deactivatedAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      });
    } catch (
      firestoreError
    ) {
      /*
        Attempt rollback only when this
        request changed Firebase Auth.

        Token revocation remains in place;
        the student can sign in again after
        reactivation if rollback succeeds.
      */

      if (
        authenticationChanged
      ) {
        try {
          await adminAuth.updateUser(
            targetStudentId,
            {
              disabled:
                previousDisabledState,
            }
          );
        } catch (
          rollbackError
        ) {
          console.error(
            "Student Auth rollback failed:",
            rollbackError?.message
          );
        }
      }

      throw firestoreError;
    }

    return Response.json({
      success: true,

      message:
        "Student account deactivated successfully.",
    });
  } catch (error) {
    const accessResponse =
      adminAccessResponse(
        error
      );

    if (accessResponse) {
      return accessResponse;
    }

    const customResponse =
      customErrorResponse(
        error
      );

    if (customResponse) {
      return customResponse;
    }

    console.error(
      "Admin deactivate student error:",
      error?.message
    );

    return Response.json(
      {
        success: false,

        message:
          "Student could not be deactivated.",
      },
      {
        status: 500,
      }
    );
  }
}