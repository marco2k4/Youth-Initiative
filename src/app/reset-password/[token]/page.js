"use client";

import Link from "next/link";

import {
  useParams,
  useSearchParams,
} from "next/navigation";

import {
  useState,
} from "react";

import {
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";

import {
  appCheckFetch,
} from "@/services/appCheckApi";

export default function ResetPasswordPage() {
  const params =
    useParams();

  const searchParams =
    useSearchParams();

  const requestId =
    params.token;

  const token =
    searchParams.get("token");


  const [password, setPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [loading, setLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [success, setSuccess] =
    useState(false);


  const checks = {
    length:
      password.length >= 10 &&
      password.length <= 64,

    uppercase:
      /[A-Z]/.test(password),

    lowercase:
      /[a-z]/.test(password),

    number:
      /[0-9]/.test(password),

    special:
      /[^A-Za-z0-9]/.test(
        password
      ),

    matches:
      password.length > 0 &&
      password ===
        confirmPassword,
  };


  const valid =
    Object.values(
      checks
    ).every(Boolean);


  async function resetPassword(
    event
  ) {
    event.preventDefault();

    try {
      if (!valid) {
        setErrorMessage(
          "Please complete all password requirements."
        );

        return;
      }

      setLoading(true);
      setErrorMessage("");

      const response =
        await appCheckFetch(
          "/api/password-reset/complete",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                requestId,
                token,
                password,
                confirmPassword,
              }),
          },
          {
            limitedUse: true,
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message
        );
      }

      setSuccess(true);
    } catch (error) {
      setErrorMessage(
        error.message ||
          "Password could not be updated."
      );
    } finally {
      setLoading(false);
    }
  }


  if (success) {
    return (
      <main className="password-flow-page">

        <section className="password-flow-card password-status-card">

          <div className="password-success-icon">
            <CheckCircle2
              size={46}
            />
          </div>

          <span className="password-flow-label">
            PASSWORD UPDATED
          </span>

          <h1>
            Password reset successfully!
          </h1>

          <p>
            The student can now log in
            using their existing Youth ID
            and the new password.
          </p>

          <Link
            href="/login"
            className="password-login-link"
          >
            Return to Login
          </Link>

        </section>

      </main>
    );
  }


  return (
    <main className="password-flow-page">

      <section className="password-flow-card">

        <div className="password-flow-icon">
          <LockKeyhole
            size={35}
          />
        </div>

        <span className="password-flow-label">
          CREATE NEW PASSWORD
        </span>

        <h1>
          Set a new password
        </h1>

        <p>
          Create the new password the
          student will use with their
          Youth Initiative ID.
        </p>


        <form
          className="password-flow-form"
          onSubmit={resetPassword}
        >

          <label>
            New Password

            <div className="password-reset-input">

              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                maxLength={64}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    !showPassword
                  )
                }
              >
                {showPassword ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>

            </div>

          </label>


          <label>
            Confirm Password

            <input
              type="password"
              value={
                confirmPassword
              }
              maxLength={64}
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value
                )
              }
            />
          </label>


          <div className="password-check-list">

            <Requirement
              good={checks.length}
              text="10–64 characters"
            />

            <Requirement
              good={
                checks.uppercase
              }
              text="Uppercase letter"
            />

            <Requirement
              good={
                checks.lowercase
              }
              text="Lowercase letter"
            />

            <Requirement
              good={
                checks.number
              }
              text="Number"
            />

            <Requirement
              good={
                checks.special
              }
              text="Special character"
            />

            <Requirement
              good={
                checks.matches
              }
              text="Passwords match"
            />

          </div>


          {errorMessage && (
            <div className="password-flow-error">
              {errorMessage}
            </div>
          )}


          <button
            type="submit"
            disabled={
              loading ||
              !valid
            }
          >
            {loading ? (
              <>
                <LoaderCircle
                  size={19}
                  className="button-spinner"
                />

                Updating...
              </>
            ) : (
              "Set New Password"
            )}
          </button>

        </form>

      </section>

    </main>
  );
}


function Requirement({
  good,
  text,
}) {
  return (
    <div
      className={
        good
          ? "complete"
          : ""
      }
    >
      <span>
        <Check size={12} />
      </span>

      {text}
    </div>
  );
}