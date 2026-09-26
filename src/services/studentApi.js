import {
  auth,
} from "@/services/firebase";

import {
  appCheckFetch,
} from "@/services/appCheckApi";

export async function studentFetch(
  url,
  options = {},
  securityOptions = {}
) {
  const user =
    auth.currentUser;

  if (!user) {
    throw new Error(
      "Student session unavailable."
    );
  }

  const authToken =
    await user.getIdToken();

  const headers =
    new Headers(
      options.headers || {}
    );

  headers.set(
    "Authorization",
    `Bearer ${authToken}`
  );

  return appCheckFetch(
    url,
    {
      ...options,
      headers,
    },
    securityOptions
  );
}