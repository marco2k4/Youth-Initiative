"use client";

import Image from "next/image";

import {
  useParams,
  useRouter,
  useSearchParams,
} from "next/navigation";

import {
  useEffect,
  useState,
} from "react";

import {
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RefreshCw,
} from "lucide-react";

import {
  appCheckFetch,
} from "@/services/appCheckApi";

const RECOVERABLE_ACTIVATION_ERRORS =
  new Set([
    "activation-token-expired",
    "invalid-activation-token",
  ]);

export default function SetPasswordPage() {
  const params =
    useParams();

  const searchParams =
    useSearchParams();

  const router =
    useRouter();

  const registrationId =
    params.registrationId;

  const token =
    searchParams.get(
      "token"
    );

  const [
    password,
    setPassword,
  ] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    useState("");

  const [
    showPassword,
    setShowPassword,
  ] =
    useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] =
    useState(false);

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    activationErrorCode,
    setActivationErrorCode,
  ] =
    useState("");

  const [
    recoverySending,
    setRecoverySending,
  ] =
    useState(false);

  const [
    recoveryMessage,
    setRecoveryMessage,
  ] =
    useState("");

  const [
    recoveryError,
    setRecoveryError,
  ] =
    useState("");

  const [
    cooldownSeconds,
    setCooldownSeconds,
  ] =
    useState(0);

  useEffect(() => {
    if (
      cooldownSeconds <=
      0
    ) {
      return undefined;
    }

    const timer =
      window.setInterval(
        () => {
          setCooldownSeconds(
            (
              current
            ) =>
              current >
              0
                ? current -
                  1
                : 0
          );
        },
        1000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, [
    cooldownSeconds,
  ]);

  const passwordChecks = {
    length:
      password.length >=
        10 &&
      password.length <=
        64,

    uppercase:
      /[A-Z]/.test(
        password
      ),

    lowercase:
      /[a-z]/.test(
        password
      ),

    number:
      /[0-9]/.test(
        password
      ),

    special:
      /[^A-Za-z0-9]/.test(
        password
      ),

    matching:
      password.length >
        0 &&
      password ===
        confirmPassword,
  };

  const passwordIsValid =
    Object.values(
      passwordChecks
    ).every(
      Boolean
    );

  const recoveryNeeded =
    !token ||
    RECOVERABLE_ACTIVATION_ERRORS.has(
      activationErrorCode
    );

  const handleRecovery =
    async () => {
      if (
        !registrationId ||
        recoverySending
      ) {
        return;
      }

      try {
        setRecoverySending(
          true
        );

        setRecoveryMessage(
          ""
        );

        setRecoveryError(
          ""
        );

        const response =
          await appCheckFetch(
            "/api/account/resend-activation",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  {
                    registrationId,
                  }
                ),
            }
          );

        const responseData =
          await response.json();

        if (
          !response.ok
        ) {
          if (
            responseData
              .retryAfterSeconds
          ) {
            setCooldownSeconds(
              responseData
                .retryAfterSeconds
            );
          }

          throw new Error(
            responseData.message ||
              "We could not send a new account setup link."
          );
        }

        setRecoveryMessage(
          responseData.message ||
            "A new account setup link has been sent."
        );

        setCooldownSeconds(
          responseData
            .retryAfterSeconds ||
            60
        );
      } catch (
        error
      ) {
        console.error(
          "Account setup recovery error:",
          error
        );

        setRecoveryError(
          error?.message ||
            "We could not send a new account setup link. Please try again."
        );
      } finally {
        setRecoverySending(
          false
        );
      }
    };

  const handleSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      if (
        !passwordIsValid
      ) {
        setErrorMessage(
          "Please complete all password requirements."
        );

        return;
      }

      if (
        !token
      ) {
        setActivationErrorCode(
          "invalid-activation-token"
        );

        setErrorMessage(
          "The account setup link is invalid or incomplete."
        );

        return;
      }

      try {
        setSubmitting(
          true
        );

        setErrorMessage(
          ""
        );

        setActivationErrorCode(
          ""
        );

        const response =
          await appCheckFetch(
            "/api/account/activate",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  {
                    registrationId,
                    token,
                    password,
                    confirmPassword,
                  }
                ),
            },
            {
              limitedUse:
                true,
            }
          );

        const responseData =
          await response.json();

        if (
          !response.ok
        ) {
          const activationError =
            new Error(
              responseData.message ||
                "The account could not be activated."
            );

          activationError.code =
            responseData.code ||
            "";

          throw activationError;
        }

        sessionStorage.removeItem(
          "pendingRegistration"
        );

        sessionStorage.removeItem(
          "approvedConsent"
        );

        sessionStorage.setItem(
          "createdAccount",
          JSON.stringify(
            {
              youthId:
                responseData.youthId,

              firstName:
                responseData.firstName,
            }
          )
        );

        router.push(
          "/account-created"
        );
      } catch (
        error
      ) {
        setActivationErrorCode(
          error?.code ||
            ""
        );

        setErrorMessage(
          error?.message ||
            "The account could not be activated."
        );
      } finally {
        setSubmitting(
          false
        );
      }
    };

  if (
    recoveryNeeded
  ) {
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
            <Mail
              size={34}
            />
          </div>

          <h1>
            Account Setup Link Needed
          </h1>

          <p className="set-password-introduction">
            {activationErrorCode ===
            "activation-token-expired"
              ? "Your account setup link has expired. Your email verification or parental consent is still recorded, so you do not need to register again."
              : "This account setup link is no longer valid. You can request a new secure setup link without starting registration again."}
          </p>

          {errorMessage && (
            <div
              className="set-password-error"
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          {recoveryMessage && (
            <div
              style={{
                marginBottom:
                  "16px",

                padding:
                  "14px",

                borderRadius:
                  "8px",

                background:
                  "#eef8f0",

                lineHeight:
                  "1.5",
              }}
              role="status"
            >
              {
                recoveryMessage
              }
            </div>
          )}

          {recoveryError && (
            <div
              className="set-password-error"
              role="alert"
            >
              {
                recoveryError
              }
            </div>
          )}

          <button
            type="button"
            className="set-password-submit"
            onClick={
              handleRecovery
            }
            disabled={
              recoverySending ||
              cooldownSeconds >
                0
            }
          >
            {recoverySending ? (
              <>
                <LoaderCircle
                  size={20}
                  className="button-spinner"
                />

                Sending...
              </>
            ) : cooldownSeconds >
              0 ? (
              <>
                <RefreshCw
                  size={18}
                />

                Resend available in{" "}
                {
                  cooldownSeconds
                }
                s
              </>
            ) : (
              <>
                <Mail
                  size={18}
                />

                Send New Setup Link
              </>
            )}
          </button>

          <p
            style={{
              marginTop:
                "18px",

              fontSize:
                "14px",

              lineHeight:
                "1.6",

              color:
                "#666",

              textAlign:
                "center",
            }}
          >
            For adults, the link is
            sent to the verified
            student email. For
            students under 18, it is
            sent to the approved
            parent or guardian email.
          </p>
        </section>
      </main>
    );
  }

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
          <LockKeyhole
            size={34}
          />
        </div>

        <h1>
          Create Student Password
        </h1>

        <p className="set-password-introduction">
          Create the password the
          student will use with their
          Youth Initiative ID.
        </p>

        <form
          className="set-password-form"
          onSubmit={
            handleSubmit
          }
          noValidate
        >
          <div className="set-password-field">
            <label
              htmlFor="newPassword"
            >
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
                value={
                  password
                }
                maxLength={64}
                autoComplete="new-password"
                onChange={(
                  event
                ) =>
                  setPassword(
                    event
                      .target
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
                    size={23}
                  />
                ) : (
                  <Eye
                    size={23}
                  />
                )}
              </button>
            </div>
          </div>

          <div className="set-password-field">
            <label
              htmlFor="confirmPassword"
            >
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
                value={
                  confirmPassword
                }
                maxLength={64}
                autoComplete="new-password"
                onChange={(
                  event
                ) =>
                  setConfirmPassword(
                    event
                      .target
                      .value
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
                    (
                      currentValue
                    ) =>
                      !currentValue
                  )
                }
              >
                {showConfirmPassword ? (
                  <EyeOff
                    size={23}
                  />
                ) : (
                  <Eye
                    size={23}
                  />
                )}
              </button>
            </div>
          </div>

          <div className="password-requirements">
            <PasswordRequirement
              passed={
                passwordChecks.length
              }
              text="10 to 64 characters"
            />

            <PasswordRequirement
              passed={
                passwordChecks.uppercase
              }
              text="One uppercase letter"
            />

            <PasswordRequirement
              passed={
                passwordChecks.lowercase
              }
              text="One lowercase letter"
            />

            <PasswordRequirement
              passed={
                passwordChecks.number
              }
              text="One number"
            />

            <PasswordRequirement
              passed={
                passwordChecks.special
              }
              text="One special character"
            />

            <PasswordRequirement
              passed={
                passwordChecks.matching
              }
              text="Passwords match"
            />
          </div>

          {errorMessage && (
            <div
              className="set-password-error"
              role="alert"
            >
              {
                errorMessage
              }
            </div>
          )}

          <button
            type="submit"
            className="set-password-submit"
            disabled={
              submitting ||
              !passwordIsValid
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

function PasswordRequirement({
  passed,
  text,
}) {
  return (
    <div
      className={
        passed
          ? "passed"
          : ""
      }
    >
      <span>
        <Check
          size={13}
        />
      </span>

      {text}
    </div>
  );
}