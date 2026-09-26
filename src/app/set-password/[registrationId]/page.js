"use client";

import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  appCheckFetch,
} from "@/services/appCheckApi";

import {
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";

export default function SetPasswordPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const registrationId = params.registrationId;
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const passwordChecks = {
    length:
      password.length >= 10 &&
      password.length <= 64,

    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    matching:
      password.length > 0 &&
      password === confirmPassword,
  };

  const passwordIsValid =
    Object.values(passwordChecks).every(Boolean);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!passwordIsValid) {
      setErrorMessage(
        "Please complete all password requirements."
      );

      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage("");

      const response = await appCheckFetch(
        "/api/account/activate",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            registrationId,
            token,
            password,
            confirmPassword,
          }),
        },
        {
          limitedUse: true,
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(
          responseData.message ||
            "The account could not be activated."
        );
      }

      sessionStorage.removeItem(
        "pendingRegistration"
      );

      sessionStorage.removeItem(
        "approvedConsent"
      );

      sessionStorage.setItem(
        "createdAccount",
        JSON.stringify({
          youthId: responseData.youthId,
          firstName: responseData.firstName,
        })
      );

      router.push("/account-created");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="set-password-page">
      <section className="set-password-card">
        <Image
          src="/images/landing/sait-logo.jpg"
          alt="Southern Alberta Institute of Technology"
          width={245}
          height={80}
          className="set-password-logo"
          priority
        />

        <div className="set-password-icon">
          <LockKeyhole size={34} />
        </div>

        <h1>Create Student Password</h1>

        <p className="set-password-introduction">
          Create the password the student will use with
          their Youth Initiative ID.
        </p>

        <form
          className="set-password-form"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className="set-password-field">
            <label htmlFor="newPassword">
              Password
            </label>

            <div className="set-password-input-wrapper">
              <input
                id="newPassword"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                maxLength={64}
                autoComplete="new-password"
                onChange={(event) =>
                  setPassword(event.target.value)
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
                    (currentValue) =>
                      !currentValue
                  )
                }
              >
                {showPassword ? (
                  <EyeOff size={23} />
                ) : (
                  <Eye size={23} />
                )}
              </button>
            </div>
          </div>

          <div className="set-password-field">
            <label htmlFor="confirmPassword">
              Confirm Password
            </label>

            <div className="set-password-input-wrapper">
              <input
                id="confirmPassword"
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                value={confirmPassword}
                maxLength={64}
                autoComplete="new-password"
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value
                  )
                }
              />

              <button
                type="button"
                aria-label={
                  showConfirmPassword
                    ? "Hide confirmation password"
                    : "Show confirmation password"
                }
                onClick={() =>
                  setShowConfirmPassword(
                    (currentValue) =>
                      !currentValue
                  )
                }
              >
                {showConfirmPassword ? (
                  <EyeOff size={23} />
                ) : (
                  <Eye size={23} />
                )}
              </button>
            </div>
          </div>

          <div className="password-requirements">
            <PasswordRequirement
              passed={passwordChecks.length}
              text="10 to 64 characters"
            />

            <PasswordRequirement
              passed={passwordChecks.uppercase}
              text="One uppercase letter"
            />

            <PasswordRequirement
              passed={passwordChecks.lowercase}
              text="One lowercase letter"
            />

            <PasswordRequirement
              passed={passwordChecks.number}
              text="One number"
            />

            <PasswordRequirement
              passed={passwordChecks.special}
              text="One special character"
            />

            <PasswordRequirement
              passed={passwordChecks.matching}
              text="Passwords match"
            />
          </div>

          {errorMessage && (
            <div
              className="set-password-error"
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            className="set-password-submit"
            disabled={
              submitting || !passwordIsValid
            }
          >
            {submitting ? (
              <>
                <LoaderCircle
                  size={20}
                  className="button-spinner"
                />

                Creating Account...
              </>
            ) : (
              "Set Password and Activate Account"
            )}
          </button>
        </form>
      </section>
    </main>
  );
}

function PasswordRequirement({ passed, text }) {
  return (
    <div className={passed ? "passed" : ""}>
      <span>
        <Check size={13} />
      </span>

      {text}
    </div>
  );
}