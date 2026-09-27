"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  usePathname,
} from "next/navigation";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/services/firebase";

const AuthContext =
  createContext();

export function AuthProvider({
  children,
}) {
  const pathname =
    usePathname();

  const isAdminRoute =
    pathname?.startsWith(
      "/admin"
    ) === true;

  const [
    user,
    setUser,
  ] =
    useState(null);

  const [
    studentProfile,
    setStudentProfile,
  ] =
    useState(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  useEffect(() => {
    let providerActive =
      true;

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          firebaseUser
        ) => {
          if (
            !providerActive
          ) {
            return;
          }

          /*
            Admin authentication is
            handled separately by
            AdminGuard + adminFetch.

            The student AuthContext
            must NEVER validate or
            sign out an administrator.
          */

          if (
            isAdminRoute
          ) {
            setUser(
              null
            );

            setStudentProfile(
              null
            );

            setLoading(
              false
            );

            return;
          }

          setLoading(
            true
          );

          try {
            if (
              !firebaseUser
            ) {
              setUser(
                null
              );

              setStudentProfile(
                null
              );

              return;
            }

            /*
              Firebase authentication
              alone is not enough to
              consider a student
              authenticated inside
              the application.

              The matching Firestore
              student profile must
              also be valid.
            */

            const studentReference =
              doc(
                db,
                "students",
                firebaseUser.uid
              );

            const studentSnapshot =
              await getDoc(
                studentReference
              );

            /*
              The auth state may have
              changed while Firestore
              was loading.

              Do not apply stale
              profile data to a newer
              authentication session.
            */

            if (
              !providerActive ||
              auth.currentUser
                ?.uid !==
                firebaseUser.uid
            ) {
              return;
            }

            if (
              !studentSnapshot.exists()
            ) {
              setUser(
                null
              );

              setStudentProfile(
                null
              );

              await signOut(
                auth
              );

              return;
            }

            const studentData =
              studentSnapshot.data();

            const youthId =
              typeof studentData
                .youthId ===
              "string"
                ? studentData
                    .youthId
                    .trim()
                : "";

            const expectedInternalEmail =
              youthId
                ? `${youthId.toLowerCase()}@youthinitiative.local`
                : "";

            const firebaseEmail =
              typeof firebaseUser
                .email ===
              "string"
                ? firebaseUser
                    .email
                    .trim()
                    .toLowerCase()
                : "";

            const youthIdIsValid =
              Boolean(
                youthId
              ) &&
              firebaseEmail ===
                expectedInternalEmail;

            const uidMatches =
              studentData
                .firebaseUid ===
              firebaseUser.uid;

            const accountIsActive =
              studentData
                .accountStatus ===
              "active";

            const studentRoleIsValid =
              studentData.role ===
              "student";

            const parentalConsentIsValid =
              studentData
                .requiresParentalConsent !==
                true ||
              studentData
                .consentStatus ===
                "approved";

            /*
              Restored student
              sessions must pass the
              same important checks
              used during normal
              student login.
            */

            if (
              !youthIdIsValid ||
              !uidMatches ||
              !accountIsActive ||
              !studentRoleIsValid ||
              !parentalConsentIsValid
            ) {
              setUser(
                null
              );

              setStudentProfile(
                null
              );

              await signOut(
                auth
              );

              return;
            }

            setUser(
              firebaseUser
            );

            setStudentProfile(
              {
                id:
                  studentSnapshot.id,

                ...studentData,
              }
            );
          } catch (
            error
          ) {
            console.error(
              "Error loading student profile:",
              error
            );

            if (
              !providerActive
            ) {
              return;
            }

            setUser(
              null
            );

            setStudentProfile(
              null
            );

            /*
              Only student routes
              should fail closed.

              Admin routes already
              returned above and are
              handled by AdminGuard.
            */

            try {
              if (
                auth.currentUser
                  ?.uid ===
                firebaseUser
                  ?.uid
              ) {
                await signOut(
                  auth
                );
              }
            } catch (
              signOutError
            ) {
              console.error(
                "Error signing out invalid student session:",
                signOutError
              );
            }
          } finally {
            if (
              providerActive &&
              !isAdminRoute
            ) {
              setLoading(
                false
              );
            }
          }
        }
      );

    return () => {
      providerActive =
        false;

      unsubscribe();
    };
  }, [
    isAdminRoute,
  ]);

  const value = {
    user,
    studentProfile,
    loading,

    isAuthenticated:
      Boolean(
        user &&
        studentProfile
      ),
  };

  return (
    <AuthContext.Provider
      value={
        value
      }
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(
      AuthContext
    );

  if (
    !context
  ) {
    throw new Error(
      "useAuth must be used inside AuthProvider."
    );
  }

  return context;
}