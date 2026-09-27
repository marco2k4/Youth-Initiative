"use client";

import Image from "next/image";
import Link from "next/link";

import {
  useRouter,
} from "next/navigation";

import {
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  Mail,
  RefreshCw,
} from "lucide-react";

import {
  appCheckFetch,
} from "@/services/appCheckApi";

const PENDING_REGISTRATION_EVENT =
  "pending-registration-change";

function subscribeToPendingRegistration(
  callback
) {
  window.addEventListener(
    PENDING_REGISTRATION_EVENT,
    callback
  );

  window.addEventListener(
    "storage",
    callback
  );

  return () => {
    window.removeEventListener(
      PENDING_REGISTRATION_EVENT,
      callback
    );

    window.removeEventListener(
      "storage",
      callback
    );
  };
}

function getPendingRegistrationSnapshot() {
  return (
    sessionStorage.getItem(
      "pendingRegistration"
    ) || ""
  );
}

function getPendingRegistrationServerSnapshot() {
  return "";
}

function parsePendingRegistration(
  value
) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(
      value
    );
  } catch {
    return null;
  }
}

function savePendingRegistration(
  registration
) {
  sessionStorage.setItem(
    "pendingRegistration",
    JSON.stringify(
      registration
    )
  );

  window.dispatchEvent(
    new Event(
      PENDING_REGISTRATION_EVENT
    )
  );
}

export default function ConsentPendingPage() {
  const router =
    useRouter();

  /*
    Read sessionStorage as an
    external browser store.

    This avoids calling setState
    synchronously inside an effect,
    which React 19's lint rules
    reject.
  */

  const registrationSnapshot =
    useSyncExternalStore(
      subscribeToPendingRegistration,
      getPendingRegistrationSnapshot,
      getPendingRegistrationServerSnapshot
    );

  const registration =
    useMemo(
      () =>
        parsePendingRegistration(
          registrationSnapshot
        ),
      [
        registrationSnapshot,
      ]
    );

  const [
    resendStatus,
    setResendStatus,
  ] =
    useState("");

  const [
    resendMessage,
    setResendMessage,
  ] =
    useState("");

  const [
    isResending,
    setIsResending,
  ] =
    useState(false);

  const [
    restartAvailable,
    setRestartAvailable,
  ] =
    useState(false);

  const [
    isRestarting,
    setIsRestarting,
  ] =
    useState(false);

  const parentEmail =
    registration
      ?.parentEmailMasked ||
    "the parent or guardian email address";

  const firstName =
    registration
      ?.firstName ||
    "the student";

  const handleResend =
    async () => {
      if (
        isResending ||
        !registration
          ?.registrationId ||
        !registration
          ?.resendToken
      ) {
        return;
      }

      try {
        setIsResending(
          true
        );

        setResendStatus(
          ""
        );

        setResendMessage(
          ""
        );

        setRestartAvailable(
          false
        );

        const response =
          await appCheckFetch(
            "/api/consent/resend",
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
                    registrationId:
                      registration
                        .registrationId,

                    resendToken:
                      registration
                        .resendToken,
                  }
                ),
            }
          );

        const responseData =
          await response.json();

        if (
          !response.ok
        ) {
          /*
            HTTP 410 means the
            consent resend
            authorization has
            expired.

            The stale registration
            can then be explicitly
            closed before starting
            registration again.
          */

          if (
            response.status ===
            410
          ) {
            setRestartAvailable(
              true
            );
          }

          throw new Error(
            responseData.message ||
              "The email could not be resent."
          );
        }

        setResendStatus(
          "success"
        );

        setResendMessage(
          "A new consent email has been sent successfully."
        );

        /*
          Preserve all existing
          registration information
          and only update the email
          delivery state.
        */

        const updatedRegistration =
          {
            ...registration,

            emailSent:
              true,
          };

        savePendingRegistration(
          updatedRegistration
        );
      } catch (
        error
      ) {
        console.error(
          "Consent resend error:",
          error
        );

        setResendStatus(
          "error"
        );

        setResendMessage(
          error?.message ||
            "The email could not be resent. Please try again."
        );
      } finally {
        setIsResending(
          false
        );
      }
    };

  const handleRestart =
    async () => {
      if (
        isRestarting ||
        !registration
          ?.registrationId ||
        !registration
          ?.resendToken
      ) {
        return;
      }

      try {
        setIsRestarting(
          true
        );

        setResendStatus(
          ""
        );

        setResendMessage(
          ""
        );

        const response =
          await appCheckFetch(
            "/api/consent/restart",
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
                    registrationId:
                      registration
                        .registrationId,

                    resendToken:
                      registration
                        .resendToken,
                  }
                ),
            }
          );

        const responseData =
          await response.json();

        if (
          !response.ok
        ) {
          throw new Error(
            responseData.message ||
              "The registration could not be restarted."
          );
        }

        /*
          The stale pending
          registration has now
          been safely marked
          expired by the server.

          Remove its browser
          state before beginning
          registration again.
        */

        sessionStorage.removeItem(
          "pendingRegistration"
        );

        sessionStorage.removeItem(
          "approvedConsent"
        );

        window.dispatchEvent(
          new Event(
            PENDING_REGISTRATION_EVENT
          )
        );

        router.push(
          "/register"
        );
      } catch (
        error
      ) {
        console.error(
          "Registration restart error:",
          error
        );

        setResendStatus(
          "error"
        );

        setResendMessage(
          error?.message ||
            "The registration could not be restarted. Please try again."
        );
      } finally {
        setIsRestarting(
          false
        );
      }
    };

  return (
    <main className="consent-pending-page">
      <section className="consent-pending-card">
        <Link
          href="/register"
          className="consent-back-link"
        >
          <ArrowLeft
            size={20}
          />

          Back
        </Link>

        <Image
          src="/images/landing/sait-logo.jpg"
          alt="Southern Alberta Institute of Technology"
          width={245}
          height={80}
          className="consent-logo"
          priority
        />

        <div className="consent-mail-icon">
          <Mail
            size={37}
          />
        </div>

        <h1>
          Parent / Guardian Consent
        </h1>

        <p className="consent-introduction">
          Since {firstName} is under
          18, we need consent from a
          parent or guardian.
        </p>

        <p className="consent-email-label">
          Parent / guardian email:
        </p>

        <strong className="consent-email">
          {parentEmail}
        </strong>

        <Link
          href="/register"
          className="change-email-link"
        >
          Change Email
        </Link>

        <div className="consent-information-box">
          <CheckCircle2
            size={25}
          />

          <p>
            {registration
              ?.emailSent ===
            false
              ? "We could not deliver the first consent email. Please use the resend button below."
              : `An email has been sent with instructions to approve ${firstName}'s account. The link expires in 30 minutes.`}
          </p>
        </div>

        {resendMessage && (
          <p
            className={
              resendStatus ===
              "error"
                ? "auth-error-message"
                : "consent-email-label"
            }
            role="status"
          >
            {
              resendMessage
            }
          </p>
        )}

        <div className="consent-pending-actions">
          {!restartAvailable &&
            registration
              ?.resendToken && (
              <button
                type="button"
                className="consent-login-button"
                disabled={
                  isResending
                }
                onClick={
                  handleResend
                }
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
                  : "Resend Consent Email"}
              </button>
            )}

          {restartAvailable && (
            <button
              type="button"
              className="consent-login-button"
              disabled={
                isRestarting
              }
              onClick={
                handleRestart
              }
            >
              {isRestarting ? (
                <>
                  <LoaderCircle
                    size={18}
                    className="button-spinner"
                  />

                  Restarting...
                </>
              ) : (
                <>
                  <RefreshCw
                    size={18}
                  />

                  Start Registration Again
                </>
              )}
            </button>
          )}

          <Link
            href="/login"
            className="consent-login-button"
          >
            Return to Login
          </Link>

          <p>
            {restartAvailable
              ? "Your previous registration session has expired. Start again to create a fresh parental consent request."
              : "Check the parent or guardian's inbox and spam folder before requesting another email."}
          </p>
        </div>
      </section>
    </main>
  );
}