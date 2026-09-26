import {
  adminAppCheck,
} from "@/services/firebaseAdmin";

export async function requireAppCheck(
  request,
  options = {}
) {
  const {
    consume = false,
  } = options;

  const appCheckToken =
    request.headers.get(
      "X-Firebase-AppCheck"
    );

  if (!appCheckToken) {
    const error =
      new Error(
        "App verification required."
      );

    error.status = 401;

    throw error;
  }

  try {
    const verificationResult =
      await adminAppCheck.verifyToken(
        appCheckToken,
        consume
          ? {
              consume: true,
            }
          : undefined
      );

    /*
      Used later for limited-use tokens
      on highly sensitive operations.
    */

    if (
      consume &&
      verificationResult
        .alreadyConsumed === true
    ) {
      const error =
        new Error(
          "App verification token has already been used."
        );

      error.status = 401;

      throw error;
    }

    return verificationResult;
  } catch (error) {
    if (error?.status === 401) {
      throw error;
    }

    const verificationError =
      new Error(
        "App verification failed."
      );

    verificationError.status = 401;

    throw verificationError;
  }
}

export function appCheckErrorResponse(
  error
) {
  if (error?.status === 401) {
    return Response.json(
      {
        success: false,

        message:
          error.message ||
          "App verification failed.",
      },
      {
        status: 401,
      }
    );
  }

  return null;
}