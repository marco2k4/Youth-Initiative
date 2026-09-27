"use client";

import Image from "next/image";
import Link from "next/link";

import {
  MailCheck,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import {
  appCheckFetch,
} from "@/services/appCheckApi";

const STORAGE_KEY =
  "pendingRegistration";

function subscribe() {
  return () => {};
}

function getServerStorageSnapshot() {
  return null;
}

function getClientStorageSnapshot() {
  return sessionStorage.getItem(
    STORAGE_KEY
  );
}

function getServerRegistrationIdSnapshot() {
  return "";
}

function getClientRegistrationIdSnapshot() {
  return (
    new URLSearchParams(
      window.location.search
    ).get(
      "registrationId"
    ) || ""
  );
}

export default function EmailVerificationPendingPage() {
  const savedRegistration =
    useSyncExternalStore(
      subscribe,
      getClientStorageSnapshot,
      getServerStorageSnapshot
    );

  const registrationIdFromUrl =
    useSyncExternalStore(
      subscribe,
      getClientRegistrationIdSnapshot,
      getServerRegistrationIdSnapshot
    );

  const registration =
    useMemo(() => {
      if (
        !savedRegistration
      ) {
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

  const firstName =
    registration?.firstName ||
    "";

  const email =
    registration?.email ||
    "";

  const registrationId =
    registration?.registrationId ||
    registrationIdFromUrl ||
    "";

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
            size={36}
          />
        </div>

        <h1>
          Check Your Email
        </h1>

        <p className="set-password-introduction">
          {firstName
            ? `Hi ${firstName}, we sent a verification link to your email address.`
            : "We sent a verification link to your email address."}
        </p>

        {email && (
          <div
            style={{
              margin:
                "18px 0",
              padding:
                "14px 18px",
              background:
                "#f5f6f7",
              borderRadius:
                "8px",
              fontWeight:
                "700",
              wordBreak:
                "break-word",
              textAlign:
                "center",
            }}
          >
            {email}
          </div>
        )}

        <div
          style={{
            display:
              "flex",
            alignItems:
              "flex-start",
            gap:
              "12px",
            margin:
              "22px 0",
            padding:
              "16px",
            border:
              "1px solid #e1e5ea",
            borderRadius:
              "10px",
            textAlign:
              "left",
          }}
        >
          <ShieldCheck
            size={24}
            style={{
              flexShrink:
                0,
              marginTop:
                "2px",
            }}
          />

          <div>
            <strong>
              Verify your email
            </strong>

            <p
              style={{
                margin:
                  "6px 0 0",
                lineHeight:
                  "1.5",
              }}
            >
              Open the email and
              select{" "}
              <strong>
                Verify Email
              </strong>
              . After verification,
              you&apos;ll be taken
              to create your
              password.
            </p>
          </div>
        </div>

        <p
          style={{
            fontSize:
              "14px",
            lineHeight:
              "1.6",
            color:
              "#666",
            marginBottom:
              "16px",
          }}
        >
          The verification link
          expires in 30 minutes.
          Check your spam or junk
          folder if you don&apos;t
          see the email.
        </p>

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

        <button
          type="button"
          className="set-password-submit"
          onClick={
            handleResend
          }
          disabled={
            !registrationId ||
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
              !registrationId ||
              isResending ||
              cooldownSeconds >
                0
                ? "not-allowed"
                : "pointer",
            opacity:
              !registrationId ||
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
                : "Resend Verification Email"}
          </span>
        </button>

        {!registrationId && (
          <p
            style={{
              color:
                "#8a1c1c",
              fontSize:
                "13px",
              lineHeight:
                "1.5",
              margin:
                "0 0 14px",
            }}
          >
            This browser no longer
            has your pending
            registration details.
            Use the verification
            link from your email, or
            return to registration.
          </p>
        )}

        <Link
          href="/login"
          className="set-password-submit"
        >
          Return to Login
        </Link>
      </section>
    </main>
  );
}