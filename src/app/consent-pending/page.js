"use client";

import Image from "next/image";
import Link from "next/link";

import {
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import {
  ArrowLeft,
  CheckCircle2,
  Mail,
  RefreshCw,
} from "lucide-react";

import {
  appCheckFetch,
} from "@/services/appCheckApi";

const STORAGE_KEY =
  "pendingRegistration";

const STORAGE_UPDATE_EVENT =
  "pending-registration-updated";

function subscribe(callback) {
  window.addEventListener(
    "storage",
    callback
  );

  window.addEventListener(
    STORAGE_UPDATE_EVENT,
    callback
  );

  return () => {
    window.removeEventListener(
      "storage",
      callback
    );

    window.removeEventListener(
      STORAGE_UPDATE_EVENT,
      callback
    );
  };
}

function getClientSnapshot() {
  return window.sessionStorage.getItem(
    STORAGE_KEY
  );
}

function getServerSnapshot() {
  return null;
}

export default function ConsentPendingPage() {
  const savedRegistration =
    useSyncExternalStore(
      subscribe,
      getClientSnapshot,
      getServerSnapshot
    );

  const [
    resendStatus,
    setResendStatus,
  ] = useState("");

  const [
    resendMessage,
    setResendMessage,
  ] = useState("");

  const [
    isResending,
    setIsResending,
  ] = useState(false);

  const registration =
    useMemo(() => {
      if (!savedRegistration) {
        return null;
      }

      try {
        return JSON.parse(
          savedRegistration
        );
      } catch {
        return null;
      }
    }, [
      savedRegistration,
    ]);

  const parentEmail =
    registration
      ?.parentEmailMasked ||
    "the parent or guardian email address";

  const firstName =
    registration?.firstName ||
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
        setIsResending(true);

        setResendStatus("");
        setResendMessage("");

        const response =
          await appCheckFetch(
            "/api/consent/resend",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  registrationId:
                    registration
                      .registrationId,

                  resendToken:
                    registration
                      .resendToken,
                }),
            }
          );

        const responseData =
          await response.json();

        if (!response.ok) {
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

        const updatedRegistration =
          {
            ...registration,
            emailSent: true,
          };

        window.sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(
            updatedRegistration
          )
        );

        window.dispatchEvent(
          new Event(
            STORAGE_UPDATE_EVENT
          )
        );
      } catch (error) {
        console.error(
          "Consent resend error:",
          error
        );

        setResendStatus(
          "error"
        );

        setResendMessage(
          error.message ||
            "The email could not be resent. Please try again."
        );
      } finally {
        setIsResending(false);
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
          Since {firstName} is under 18,
          we need consent from a parent or
          guardian.
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
              ?.emailSent === false
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
            {resendMessage}
          </p>
        )}

        <div className="consent-pending-actions">
          {registration
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

          <Link
            href="/login"
            className="consent-login-button"
          >
            Return to Login
          </Link>

          <p>
            Check the parent or guardian&apos;s
            inbox and spam folder before
            requesting another email.
          </p>
        </div>
      </section>
    </main>
  );
}