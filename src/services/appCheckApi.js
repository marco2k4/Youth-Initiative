import {
  getLimitedUseToken,
  getToken,
} from "firebase/app-check";

import {
  appCheck,
} from "@/services/firebase";

export async function appCheckFetch(
  url,
  options = {},
  securityOptions = {}
) {
  const {
    limitedUse = false,
  } = securityOptions;

  if (!appCheck) {
    throw new Error(
      "App verification is not available."
    );
  }

  let tokenResponse;

  try {
    tokenResponse =
      limitedUse
        ? await getLimitedUseToken(
            appCheck
          )
        : await getToken(
            appCheck,
            false
          );
  } catch (error) {
    console.error(
      "App Check token error:",
      error?.message
    );

    throw new Error(
      "App verification could not be completed."
    );
  }

  if (!tokenResponse?.token) {
    throw new Error(
      "App verification token is unavailable."
    );
  }

  const headers =
    new Headers(
      options.headers || {}
    );

  headers.set(
    "X-Firebase-AppCheck",
    tokenResponse.token
  );

  return fetch(
    url,
    {
      ...options,
      headers,
    }
  );
}