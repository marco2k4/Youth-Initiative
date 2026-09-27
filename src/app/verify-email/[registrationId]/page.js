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
} from "react";

import {
  CircleAlert,
  LoaderCircle,
  MailCheck,
} from "lucide-react";

import {
  appCheckFetch,
} from "@/services/appCheckApi";

export default function VerifyEmailPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const registrationId =
    typeof params?.registrationId ===
    "string"
      ? params.registrationId
      : "";

  const verificationStarted =
    useRef(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    verified,
    setVerified,
  ] =
    useState(false);

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

    if (!token) {
      return;
    }

    verificationStarted.current =
      true;

    /*
      Remove the verification token
      from the browser address bar
      after reading it.

      We already have the token in
      memory for this request.
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
                  The backend consumes
                  this App Check token,
                  so request a
                  limited-use token.
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
            throw new Error(
              responseData.message ||
                "Your email address could not be verified."
            );
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
            Pass the new activation
            token to the EXISTING
            set-password page.

            The original email
            verification token is
            never used for account
            activation.
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

  /*
    The verification token lives
    inside the URL fragment.

    Fragments are only available in
    the browser, so this is derived
    during rendering only after the
    component has mounted.
  */

  const browserHasToken =
    typeof window !==
      "undefined" &&
    new URLSearchParams(
      window.location.hash.slice(
        1
      )
    ).has(
      "token"
    );

  const linkIsIncomplete =
    !registrationId ||
    (
      !browserHasToken &&
      !verificationStarted.current &&
      !verified
    );

  if (
    errorMessage
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
            Email Verification Failed
          </h1>

          <p className="set-password-introduction">
            {errorMessage}
          </p>

          <Link
            href="/register"
            className="set-password-submit"
          >
            Return to Registration
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
            link is incomplete,
            expired, or invalid.
          </p>

          <Link
            href="/register"
            className="set-password-submit"
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