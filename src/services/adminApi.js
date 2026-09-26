import {
  auth,
} from "@/services/firebase";

export async function adminFetch(
  url,
  options = {}
) {
  const user =
    auth.currentUser;

  if (!user) {
    throw new Error(
      "Admin session unavailable."
    );
  }

  const token =
    await user.getIdToken();

  const headers =
    new Headers(
      options.headers || {}
    );

  headers.set(
    "Authorization",
    `Bearer ${token}`
  );

  return fetch(
    url,
    {
      ...options,
      headers,
    }
  );
}