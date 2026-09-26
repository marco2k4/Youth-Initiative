"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import {
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import {
  auth,
} from "@/services/firebase";

import {
  adminFetch,
} from "@/services/adminApi";

export default function AdminLoginPage() {
  const router =
    useRouter();

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function handleLogin(
    event
  ) {
    event.preventDefault();

    try {
      setLoading(
        true
      );

      setErrorMessage(
        ""
      );

      /*
        Step 1:
        Authenticate through Firebase Auth.
      */

      await signInWithEmailAndPassword(
        auth,
        email
          .trim()
          .toLowerCase(),
        password
      );

      /*
        Step 2:
        Verify that the Firebase user is
        actually an active administrator.

        adminFetch automatically sends:

        Authorization:
        Bearer <Firebase ID token>

        X-Firebase-AppCheck:
        <App Check token>
      */

      const response =
        await adminFetch(
          "/api/admin/auth/verify",
          {
            method: "POST",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        await signOut(
          auth
        );

        throw new Error(
          data.message ||
            "Administrator access could not be verified."
        );
      }

      /*
        This is UI convenience only.

        Server authorization does not trust
        this sessionStorage value.
      */

      sessionStorage.setItem(
        "adminSession",
        JSON.stringify(
          data.admin
        )
      );

      router.replace(
        "/admin"
      );
    } catch (error) {
      console.error(
        "Admin login error:",
        error
      );

      /*
        Make sure a Firebase user that failed
        administrator verification does not
        remain signed in.
      */

      if (
        auth.currentUser
      ) {
        try {
          await signOut(
            auth
          );
        } catch {
          // Ignore sign-out cleanup errors.
        }
      }

      setErrorMessage(
        error.message ||
          "Invalid admin credentials."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <div className="admin-login-icon">
          <ShieldCheck
            size={38}
          />
        </div>

        <span className="admin-login-label">
          SAIT YOUTH INITIATIVE
        </span>

        <h1>
          Administrator Login
        </h1>

        <p>
          Sign in with your authorized
          administrator account.
        </p>

        <form
          className="admin-login-form"
          onSubmit={
            handleLogin
          }
        >
          <label>
            Admin Email

            <input
              type="email"
              value={
                email
              }
              required
              autoComplete="email"
              onChange={(
                event
              ) =>
                setEmail(
                  event.target
                    .value
                )
              }
            />
          </label>

          <label>
            Password

            <div className="admin-password-input">
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={
                  password
                }
                required
                autoComplete="current-password"
                onChange={(
                  event
                ) =>
                  setPassword(
                    event.target
                      .value
                  )
                }
              />

              <button
                type="button"
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
                onClick={() =>
                  setShowPassword(
                    (
                      currentValue
                    ) =>
                      !currentValue
                  )
                }
              >
                {showPassword ? (
                  <EyeOff
                    size={20}
                  />
                ) : (
                  <Eye
                    size={20}
                  />
                )}
              </button>
            </div>
          </label>

          {errorMessage && (
            <div
              className="admin-login-error"
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={
              loading
            }
          >
            {loading ? (
              <>
                <LoaderCircle
                  size={19}
                  className="button-spinner"
                />

                Signing in...
              </>
            ) : (
              <>
                <LockKeyhole
                  size={18}
                />

                Login to Admin Portal
              </>
            )}
          </button>
        </form>
      </section>
    </main>
  );
}