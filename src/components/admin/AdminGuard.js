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

  const [
    verified,
    setVerified,
  ] = useState(false);

  const [
    checking,
    setChecking,
  ] = useState(true);

  useEffect(() => {
    if (
      pathname ===
      "/admin/login"
    ) {
      setVerified(true);
      setChecking(false);

      return;
    }

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          firebaseUser
        ) => {
          try {
            if (
              !firebaseUser
            ) {
              router.replace(
                "/admin/login"
              );

              return;
            }

            /*
              adminFetch sends both:
              - Firebase Auth token
              - Firebase App Check token
            */

            const response =
              await adminFetch(
                "/api/admin/auth/verify",
                {
                  method: "POST",
                }
              );

            if (
              !response.ok
            ) {
              await signOut(
                auth
              );

              router.replace(
                "/admin/login"
              );

              return;
            }

            setVerified(
              true
            );
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
              // Ignore sign-out failure.
            }

            router.replace(
              "/admin/login"
            );
          } finally {
            setChecking(
              false
            );
          }
        }
      );

    return unsubscribe;
  }, [
    pathname,
    router,
  ]);

  if (
    pathname ===
    "/admin/login"
  ) {
    return children;
  }

  if (
    checking ||
    !verified
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