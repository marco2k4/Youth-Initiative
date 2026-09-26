"use client";

import Image from "next/image";
import {
  useParams,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useEffect, useState } from "react";
import {
  appCheckFetch,
} from "@/services/appCheckApi";

import {
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

export default function ConsentPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const registrationId = params.registrationId;
  const token = searchParams.get("token");

  const [registration, setRegistration] =
    useState(null);

  const [pageStatus, setPageStatus] =
    useState("loading");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [
    guardianConfirmed,
    setGuardianConfirmed,
  ] = useState(false);

  const [
    termsAccepted,
    setTermsAccepted,
  ] = useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [submitError, setSubmitError] =
    useState("");

  useEffect(() => {
    async function verifyConsentLink() {
      try {
        if (!registrationId || !token) {
          throw new Error(
            "The consent link is incomplete."
          );
        }

        const response = await appCheckFetch(
          "/api/consent/verify",
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({
              registrationId,
              token,
              guardianConfirmed,
              termsAccepted,
            }),
          },
          {
            limitedUse: true,
          }
        );

        const responseData =
          await response.json();

        if (!response.ok) {
          throw new Error(
            responseData.message ||
              "The consent link is invalid."
          );
        }

        setRegistration(
          responseData.registration
        );

        setPageStatus("ready");
      } catch (error) {
        setErrorMessage(error.message);
        setPageStatus("error");
      }
    }

    verifyConsentLink();
  }, [registrationId, token]);

  const handleProvideConsent = async () => {
    if (
      !guardianConfirmed ||
      !termsAccepted ||
      isSubmitting
    ) {
      return;
    }

    try {
      setSubmitError("");
      setIsSubmitting(true);

      const response = await fetch(
        "/api/consent/approve",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            registrationId,
            token,
            guardianConfirmed,
            termsAccepted,
          }),
        }
      );

      const responseData =
        await response.json();

      if (!response.ok) {
        throw new Error(
          responseData.message ||
            "Consent could not be recorded."
        );
      }

      if (!responseData.activationToken) {
        throw new Error(
          "Account setup could not be started."
        );
      }

      router.push(
        `/set-password/${encodeURIComponent(
          registrationId
        )}?token=${encodeURIComponent(
          responseData.activationToken
        )}`
      );
    } catch (error) {
      console.error(
        "Consent approval error:",
        error
      );

      setSubmitError(
        error.message ||
          "We could not record your consent. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pageStatus === "loading") {
    return (
      <main className="consent-action-page">
        <div className="consent-action-card consent-status-card">
          <LoaderCircle
            className="button-spinner"
            size={38}
          />

          <h1>Verifying consent link</h1>

          <p>
            Please wait while we check this
            request.
          </p>
        </div>
      </main>
    );
  }

  if (pageStatus === "error") {
    return (
      <main className="consent-action-page">
        <div className="consent-action-card consent-status-card">
          <TriangleAlert
            size={48}
            className="consent-error-icon"
          />

          <h1>Link unavailable</h1>

          <p>{errorMessage}</p>

          <button
            type="button"
            className="consent-primary-button"
            onClick={() =>
              router.push("/register")
            }
          >
            Return to Registration
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="consent-action-page">
      <section className="consent-action-card">
        <Image
          src="/images/landing/sait-logo.jpg"
          alt="Southern Alberta Institute of Technology"
          width={250}
          height={80}
          className="consent-action-logo"
          priority
        />

        <div className="consent-shield-icon">
          <ShieldCheck size={38} />
        </div>

        <span className="consent-page-label">
          Parent / Guardian
        </span>

        <h1>Parental Consent Request</h1>

        <p className="consent-action-introduction">
          <strong>
            {registration.firstName}{" "}
            {registration.lastName}
          </strong>{" "}
          has requested access to the SAIT
          Youth Initiative student platform.
        </p>

        <div className="consent-review-box">
          <h2>
            Please review and confirm:
          </h2>

          <div>
            <input
              id="guardianConfirmed"
              type="checkbox"
              checked={guardianConfirmed}
              disabled={isSubmitting}
              onChange={(event) =>
                setGuardianConfirmed(
                  event.target.checked
                )
              }
            />

            <label htmlFor="guardianConfirmed">
              I confirm that I am the
              student&apos;s parent or legal
              guardian.
            </label>
          </div>

          <div>
            <input
              id="termsAccepted"
              type="checkbox"
              checked={termsAccepted}
              disabled={isSubmitting}
              onChange={(event) =>
                setTermsAccepted(
                  event.target.checked
                )
              }
            />

            <label htmlFor="termsAccepted">
              I consent to the creation and use
              of this student account for the
              SAIT Youth Initiative application
              and agree to the applicable terms
              and privacy requirements.
            </label>
          </div>
        </div>

        {submitError && (
          <p
            className="auth-error-message"
            role="alert"
          >
            {submitError}
          </p>
        )}

        <button
          type="button"
          className="consent-primary-button"
          onClick={handleProvideConsent}
          disabled={
            !guardianConfirmed ||
            !termsAccepted ||
            isSubmitting
          }
        >
          {isSubmitting ? (
            <>
              <LoaderCircle
                size={19}
                className="button-spinner"
              />
              Recording Consent...
            </>
          ) : (
            "Provide Consent and Set Password"
          )}
        </button>
      </section>
    </main>
  );
}