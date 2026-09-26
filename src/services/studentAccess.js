import {
  adminAuth,
  adminDb,
} from "@/services/firebaseAdmin";

import {
  requireAppCheck,
} from "@/services/appCheckServer";

export async function requireActiveStudent(
  request,
  options = {}
) {
  const {
    consumeAppCheck = false,
  } = options;

  /*
    1. Verify App Check
  */

  await requireAppCheck(
    request,
    {
      consume:
        consumeAppCheck,
    }
  );

  /*
    2. Verify Firebase Authentication
  */

  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    !authorization ||
    !authorization.startsWith(
      "Bearer "
    )
  ) {
    const error =
      new Error(
        "Authentication required."
      );

    error.status = 401;
    throw error;
  }

  const token =
    authorization
      .slice(7)
      .trim();

  if (!token) {
    const error =
      new Error(
        "Authentication required."
      );

    error.status = 401;
    throw error;
  }

  let decodedToken;

  try {
    decodedToken =
      await adminAuth.verifyIdToken(
        token,
        true
      );
  } catch {
    const error =
      new Error(
        "Student session is invalid or expired."
      );

    error.status = 401;
    throw error;
  }

  /*
    3. Verify student profile
  */

  const studentSnapshot =
    await adminDb
      .collection("students")
      .doc(decodedToken.uid)
      .get();

  if (!studentSnapshot.exists) {
    const error =
      new Error(
        "Student profile not found."
      );

    error.status = 404;
    throw error;
  }

  const student =
    studentSnapshot.data();

  /*
    Ensure Firestore UID and Firebase UID
    represent the same account.
  */

  if (
    student.firebaseUid &&
    student.firebaseUid !==
      decodedToken.uid
  ) {
    const error =
      new Error(
        "Student account information is invalid."
      );

    error.status = 403;
    throw error;
  }

  if (
    student.role !== "student"
  ) {
    const error =
      new Error(
        "Student access required."
      );

    error.status = 403;
    throw error;
  }

  if (
    student.accountStatus !==
      "active"
  ) {
    const error =
      new Error(
        "This student account is inactive."
      );

    error.status = 403;
    throw error;
  }

  /*
    Minor accounts cannot use protected
    student APIs without approved consent.
  */

  if (
    student.requiresParentalConsent ===
      true &&
    student.consentStatus !==
      "approved"
  ) {
    const error =
      new Error(
        "Parental consent is required."
      );

    error.status = 403;
    throw error;
  }

  return {
    uid:
      decodedToken.uid,

    email:
      decodedToken.email ||
      null,

    student,
  };
}

export function studentAccessResponse(
  error
) {
  if (
    error?.status === 401 ||
    error?.status === 403 ||
    error?.status === 404
  ) {
    return Response.json(
      {
        success: false,
        message:
          error.message,
      },
      {
        status:
          error.status,
      }
    );
  }

  return null;
}