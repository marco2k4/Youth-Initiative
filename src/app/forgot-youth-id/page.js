"use client";

import Link from "next/link";

import {
  useState,
} from "react";

import {
  ArrowLeft,
  BadgeHelp,
  LoaderCircle,
  Mail,
  ShieldCheck,
} from "lucide-react";

import {
  appCheckFetch,
} from "@/services/appCheckApi";

export default function ForgotYouthIdPage() {
  const [
    email,
    setEmail,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    requestSent,
    setRequestSent,
  ] =
    useState(false);

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    try {
      const cleanedEmail =
        email
          .trim()
          .toLowerCase();

      if (
        !cleanedEmail
      ) {
        setErrorMessage(
          "Email address is required."
        );

        return;
      }

      setLoading(
        true
      );

      setErrorMessage(
        ""
      );

      const response =
        await appCheckFetch(
          "/api/youth-id-recovery/request",
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
                  email:
                    cleanedEmail,
                }
              ),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.message ||
            "Youth ID recovery could not be started."
        );
      }

      setRequestSent(
        true
      );
    } catch (
      error
    ) {
      setErrorMessage(
        error?.message ||
          "Youth ID recovery could not be started."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  if (
    requestSent
  ) {
    return (
      <main className="password-flow-page">
        <section className="password-flow-card">
          <Link
            href="/login"
            className="password-flow-back"
          >
            <ArrowLeft
              size={18}
            />

            Back to Login
          </Link>

          <div className="password-flow-icon">
            <Mail
              size={35}
            />
          </div>

          <span className="password-flow-label">
            ACCOUNT RECOVERY
          </span>

          <h1>
            Check your email
          </h1>

          <p>
            If this email is
            associated with an
            eligible Youth Initiative
            account, the Youth ID has
            been sent.
          </p>

          <div className="password-security-note">
            <ShieldCheck
              size={20}
            />

            <span>
              For privacy, we
              don&apos;t confirm
              whether an account is
              registered with the
              email address you
              entered.
            </span>
          </div>

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

  return (
    <main className="password-flow-page">
      <section className="password-flow-card">
        <Link
          href="/login"
          className="password-flow-back"
        >
          <ArrowLeft
            size={18}
          />

          Back to Login
        </Link>

        <div className="password-flow-icon">
          <BadgeHelp
            size={35}
          />
        </div>

        <span className="password-flow-label">
          ACCOUNT RECOVERY
        </span>

        <h1>
          Forgot your Youth ID?
        </h1>

        <p>
          Enter the email associated
          with the Youth Initiative
          account. If the account is
          eligible, we&apos;ll send
          the Youth ID to the
          appropriate registered
          email.
        </p>

        <div className="password-security-note">
          <ShieldCheck
            size={20}
          />

          <span>
            Adult students receive
            the Youth ID at their
            verified contact email.
            For students under 18,
            recovery is sent to the
            approved parent or
            guardian email.
          </span>
        </div>

        <form
          onSubmit={
            handleSubmit
          }
          className="password-flow-form"
        >
          <label>
            Registered Email

            <input
              type="email"
              value={
                email
              }
              maxLength={254}
              autoComplete="email"
              placeholder="Enter your email address"
              onChange={(
                event
              ) =>
                setEmail(
                  event
                    .target
                    .value
                )
              }
            />
          </label>

          {errorMessage && (
            <div className="password-flow-error">
              {
                errorMessage
              }
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

                Sending...
              </>
            ) : (
              <>
                <Mail
                  size={18}
                />

                Recover Youth ID
              </>
            )}
          </button>
        </form>
      </section>
    </main>
  );
}