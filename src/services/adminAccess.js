import {
  adminAuth,
  adminDb,
} from "@/services/firebaseAdmin";

export async function requireActiveAdmin(
  request
) {
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
    /*
      true = also check whether Firebase
      refresh tokens were revoked.
    */
    decodedToken =
      await adminAuth.verifyIdToken(
        token,
        true
      );
  } catch {
    const error =
      new Error(
        "Administrator session is invalid or expired."
      );

    error.status = 401;
    throw error;
  }

  const adminSnapshot =
    await adminDb
      .collection("admins")
      .doc(decodedToken.uid)
      .get();

  if (!adminSnapshot.exists) {
    const error =
      new Error(
        "Administrator access required."
      );

    error.status = 403;
    throw error;
  }

  const adminData =
    adminSnapshot.data();

  if (
    adminData.role !== "admin" ||
    adminData.status !== "active"
  ) {
    const error =
      new Error(
        "Administrator access is inactive."
      );

    error.status = 403;
    throw error;
  }

  return {
    uid: decodedToken.uid,
    email:
      decodedToken.email ||
      adminData.email ||
      null,
    adminData,
  };
}

export function adminAccessResponse(
  error
) {
  if (
    error?.status === 401 ||
    error?.status === 403
  ) {
    return Response.json(
      {
        success: false,
        message: error.message,
      },
      {
        status: error.status,
      }
    );
  }

  return null;
}