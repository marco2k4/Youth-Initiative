"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import {
  LoaderCircle,
} from "lucide-react";

import {
  auth,
} from "@/services/firebase";

import {
  adminFetch,
} from "@/services/adminApi";

export default function AdminGuard({
  children,
}) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const isLoginPage =
    pathname ===
    "/admin/login";

  const [
    verifiedPath,
    setVerifiedPath,
  ] = useState(null);

  useEffect(() => {
    /*
      The login page itself does not require
      administrator verification.
    */

    if (
      isLoginPage
    ) {
      return undefined;
    }

    let active =
      true;

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          firebaseUser
        ) => {
          if (
            !active
          ) {
            return;
          }

          try {
            if (
              !firebaseUser
            ) {
              setVerifiedPath(
                null
              );

              router.replace(
                "/admin/login"
              );

              return;
            }

            /*
              adminFetch sends:

              - Firebase Authentication token
              - Firebase App Check token
            */

            const response =
              await adminFetch(
                "/api/admin/auth/verify",
                {
                  method:
                    "POST",
                }
              );

            if (
              !response.ok
            ) {
              await signOut(
                auth
              );

              if (
                active
              ) {
                setVerifiedPath(
                  null
                );

                router.replace(
                  "/admin/login"
                );
              }

              return;
            }

            if (
              active
            ) {
              setVerifiedPath(
                pathname
              );
            }
          } catch (error) {
            console.error(
              "Admin guard error:",
              error?.message
            );

            try {
              await signOut(
                auth
              );
            } catch {
              // Ignore sign-out cleanup failure.
            }

            if (
              active
            ) {
              setVerifiedPath(
                null
              );

              router.replace(
                "/admin/login"
              );
            }
          }
        }
      );

    return () => {
      active =
        false;

      unsubscribe();
    };
  }, [
    isLoginPage,
    pathname,
    router,
  ]);

  /*
    Never guard the login page itself.
  */

  if (
    isLoginPage
  ) {
    return children;
  }

  /*
    Show protected admin content only
    after this exact route has passed
    server-side administrator verification.
  */

  if (
    verifiedPath !==
    pathname
  ) {
    return (
      <main className="admin-guard-loading">
        <LoaderCircle
          size={35}
          className="button-spinner"
        />

        <span>
          Verifying administrator...
        </span>
      </main>
    );
  }

  return children;
}