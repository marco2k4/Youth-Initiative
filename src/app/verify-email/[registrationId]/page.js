"use client";

import Image from "next/image";
import Link from "next/link";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  CircleAlert,
  LoaderCircle,
  MailCheck,
  RefreshCw,
} from "lucide-react";

import {
  appCheckFetch,
} from "@/services/appCheckApi";

const RESENDABLE_ERROR_CODES =
  new Set([
    "verification-token-expired",
    "invalid-verification-token",
    "invalid-verification-link",
  ]);

function subscribe() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export default function VerifyEmailPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const isClient =
    useSyncExternalStore(
      subscribe,
      getClientSnapshot,
      getServerSnapshot
    );

  const registrationId =
    typeof params?.registrationId ===
    "string"
      ? params.registrationId
      : "";

  /*
    This ref is only used inside
    the verification effect.

    It prevents duplicate
    verification requests.

    It is never used to decide
    what should render.
  */

  const verificationStarted =
    useRef(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    errorCode,
    setErrorCode,
  ] =
    useState("");

  const [
    verified,
    setVerified,
  ] =
    useState(false);

  const [
    isResending,
    setIsResending,
  ] =
    useState(false);

  const [
    resendMessage,
    setResendMessage,
  ] =
    useState("");

  const [
    resendError,
    setResendError,
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

  useEffect(() => {
    if (
      !registrationId ||
      verificationStarted.current
    ) {
      return;
    }

    const hashParameters =
      new URLSearchParams(
        window.location.hash.slice(
          1
        )
      );

    const token =
      hashParameters.get(
        "token"
      );

    if (
      !token
    ) {
      return;
    }

    verificationStarted.current =
      true;

    /*
      Remove the token from the
      browser address bar after it
      has been read.

      The token remains available
      in memory for the API request.
    */

    window.history.replaceState(
      null,
      "",
      window.location.pathname
    );

    const verifyEmail =
      async () => {
        try {
          const response =
            await appCheckFetch(
              "/api/email-verification/verify",
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
                    }
                  ),
              },
              {
                /*
                  Verification is a
                  sensitive one-time
                  operation.

                  Request a
                  limited-use App
                  Check token.
                */

                limitedUse:
                  true,
              }
            );

          const responseData =
            await response.json();

          if (
            !response.ok
          ) {
            const verificationError =
              new Error(
                responseData.message ||
                  "Your email address could not be verified."
              );

            verificationError.code =
              responseData.code ||
              "";

            throw verificationError;
          }

          if (
            !responseData
              .activationToken
          ) {
            throw new Error(
              "Email verification succeeded, but account setup could not be started."
            );
          }

          setVerified(
            true
          );

          /*
            Email verification and
            account activation use
            separate tokens.

            Continue using the
            activation token
            returned by the backend.
          */

          router.replace(
            `/set-password/${encodeURIComponent(
              registrationId
            )}?token=${encodeURIComponent(
              responseData.activationToken
            )}`
          );
        } catch (
          error
        ) {
          console.error(
            "Email verification error:",
            error
          );

          setErrorCode(
            error?.code ||
              ""
          );

          setErrorMessage(
            error?.message ||
              "Your email address could not be verified."
          );
        }
      };

    verifyEmail();
  }, [
    registrationId,
    router,
  ]);

  const handleResend =
    async () => {
      if (
        !registrationId ||
        isResending
      ) {
        return;
      }

      try {
        setIsResending(
          true
        );

        setResendMessage(
          ""
        );

        setResendError(
          ""
        );

        const response =
          await appCheckFetch(
            "/api/email-verification/resend",
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
              "We could not resend the verification email."
          );
        }

        setResendMessage(
          responseData.message ||
            "A new verification email has been sent."
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
          "Verification resend error:",
          error
        );

        setResendError(
          error?.message ||
            "We could not resend the verification email. Please try again."
        );
      } finally {
        setIsResending(
          false
        );
      }
    };

  /*
    During server prerender we
    cannot safely inspect
    window.location.

    Render the loading state until
    the browser takes over.
  */

  if (
    !isClient
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
            <MailCheck
              size={34}
            />
          </div>

          <h1>
            Verifying Your Email
          </h1>

          <p className="set-password-introduction">
            Please wait while we
            securely verify your
            email address.
          </p>

          <LoaderCircle
            size={30}
            className="button-spinner"
            aria-label="Verifying email"
          />
        </section>
      </main>
    );
  }

  const hashParameters =
    new URLSearchParams(
      window.location.hash.slice(
        1
      )
    );

  const browserHasToken =
    hashParameters.has(
      "token"
    );

  /*
    Do NOT use
    verificationStarted.current
    here.

    React refs must not be read
    during render.

    verified covers the short
    period between successful
    verification and Next.js
    navigation.
  */

  const linkIsIncomplete =
    !registrationId ||
    (
      !browserHasToken &&
      !verified &&
      !errorMessage
    );

  const resendButton =
    registrationId
      ? (
          <button
            type="button"
            className="set-password-submit"
            onClick={
              handleResend
            }
            disabled={
              isResending ||
              cooldownSeconds >
                0
            }
            style={{
              width:
                "100%",
              border:
                "none",

              cursor:
                isResending ||
                cooldownSeconds >
                  0
                  ? "not-allowed"
                  : "pointer",

              opacity:
                isResending ||
                cooldownSeconds >
                  0
                  ? 0.65
                  : 1,

              marginBottom:
                "12px",
            }}
          >
            <span
              style={{
                display:
                  "inline-flex",

                alignItems:
                  "center",

                justifyContent:
                  "center",

                gap:
                  "8px",
              }}
            >
              <RefreshCw
                size={18}
                className={
                  isResending
                    ? "button-spinner"
                    : ""
                }
              />

              {isResending
                ? "Sending..."
                : cooldownSeconds >
                    0
                  ? `Resend available in ${cooldownSeconds}s`
                  : "Send a New Verification Email"}
            </span>
          </button>
        )
      : null;

  const resendFeedback =
    (
      <>
        {resendMessage && (
          <div
            role="status"
            style={{
              marginBottom:
                "14px",

              padding:
                "12px 14px",

              borderRadius:
                "8px",

              background:
                "#eef8f0",

              lineHeight:
                "1.5",

              fontSize:
                "14px",
            }}
          >
            {resendMessage}
          </div>
        )}

        {resendError && (
          <div
            role="alert"
            style={{
              marginBottom:
                "14px",

              padding:
                "12px 14px",

              borderRadius:
                "8px",

              background:
                "#fff1f1",

              lineHeight:
                "1.5",

              fontSize:
                "14px",
            }}
          >
            {resendError}
          </div>
        )}
      </>
    );

  if (
    errorMessage
  ) {
    const canResend =
      RESENDABLE_ERROR_CODES.has(
        errorCode
      );

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
            <CircleAlert
              size={34}
            />
          </div>

          <h1>
            Email Verification Failed
          </h1>

          <p className="set-password-introduction">
            {errorMessage}
          </p>

          {canResend &&
            resendFeedback}

          {canResend &&
            resendButton}

          <Link
            href="/login"
            className="set-password-submit"
            style={{
              display:
                "block",

              textAlign:
                "center",

              background:
                "transparent",

              color:
                "inherit",

              border:
                "1px solid #d7dce1",
            }}
          >
            Return to Login
          </Link>
        </section>
      </main>
    );
  }

  if (
    linkIsIncomplete
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
            <CircleAlert
              size={34}
            />
          </div>

          <h1>
            Invalid Verification Link
          </h1>

          <p className="set-password-introduction">
            This email verification
            link is incomplete or no
            longer contains a usable
            verification token. You
            can request a new
            verification email
            below.
          </p>

          {resendFeedback}

          {resendButton}

          <Link
            href="/register"
            className="set-password-submit"
            style={{
              display:
                "block",

              textAlign:
                "center",

              background:
                "transparent",

              color:
                "inherit",

              border:
                "1px solid #d7dce1",
            }}
          >
            Return to Registration
          </Link>
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
          <MailCheck
            size={34}
          />
        </div>

        <h1>
          Verifying Your Email
        </h1>

        <p className="set-password-introduction">
          Please wait while we
          securely verify your email
          address.
        </p>

        <LoaderCircle
          size={30}
          className="button-spinner"
          aria-label="Verifying email"
        />
      </section>
    </main>
  );
}