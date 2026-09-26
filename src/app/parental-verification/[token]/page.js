"use client";

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
  CheckCircle2,
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import {
  appCheckFetch,
} from "@/services/appCheckApi";

export default function ParentalVerificationPage() {
  const params =
    useParams();

  const searchParams =
    useSearchParams();

  const router =
    useRouter();

  const requestId =
    typeof params?.token ===
    "string"
      ? params.token
      : "";

  const token =
    searchParams.get(
      "token"
    );

  const linkIncomplete =
    !requestId ||
    !token;

  const [
    status,
    setStatus,
  ] = useState(
    "loading"
  );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    approving,
    setApproving,
  ] = useState(false);

  useEffect(() => {
    if (
      linkIncomplete
    ) {
      return;
    }

    let cancelled =
      false;

    async function checkLink() {
      try {
        /*
          Initial link verification uses
          a normal App Check token.

          Nothing is consumed at this
          stage.
        */

        const response =
          await appCheckFetch(
            "/api/password-reset/verify",
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
                  approve: false,
                }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Verification link could not be validated."
          );
        }

        if (
          !cancelled
        ) {
          setStatus(
            "ready"
          );
        }
      } catch (error) {
        if (
          cancelled
        ) {
          return;
        }

        setErrorMessage(
          error.message ||
            "Verification link could not be validated."
        );

        setStatus(
          "error"
        );
      }
    }

    checkLink();

    return () => {
      cancelled =
        true;
    };
  }, [
    requestId,
    token,
    linkIncomplete,
  ]);

  async function approveReset() {
    try {
      setApproving(
        true
      );

      /*
        Guardian approval creates a new
        password-reset authorization.

        Use a limited-use App Check token.
      */

      const response =
        await appCheckFetch(
          "/api/password-reset/verify",
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
                approve: true,
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
          data.message ||
            "Password reset approval failed."
        );
      }

      if (
        !data.resetToken ||
        typeof data.resetToken !==
          "string"
      ) {
        throw new Error(
          "Password reset authorization could not be created."
        );
      }

      router.push(
        `/reset-password/${encodeURIComponent(
          requestId
        )}?token=${encodeURIComponent(
          data.resetToken
        )}`
      );
    } catch (error) {
      setErrorMessage(
        error.message ||
          "Password reset approval failed."
      );

      setStatus(
        "error"
      );
    } finally {
      setApproving(
        false
      );
    }
  }

  if (
    linkIncomplete
  ) {
    return (
      <main className="password-flow-page">
        <section className="password-flow-card password-status-card">
          <TriangleAlert
            size={45}
            className="password-error-icon"
          />

          <h1>
            Link unavailable
          </h1>

          <p>
            Verification link is incomplete.
          </p>
        </section>
      </main>
    );
  }

  if (
    status ===
    "loading"
  ) {
    return (
      <main className="password-flow-page">
        <section className="password-flow-card password-status-card">
          <LoaderCircle
            size={36}
            className="button-spinner"
          />

          <h1>
            Verifying link...
          </h1>
        </section>
      </main>
    );
  }

  if (
    status ===
    "error"
  ) {
    return (
      <main className="password-flow-page">
        <section className="password-flow-card password-status-card">
          <TriangleAlert
            size={45}
            className="password-error-icon"
          />

          <h1>
            Link unavailable
          </h1>

          <p>
            {errorMessage}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="password-flow-page">
      <section className="password-flow-card">
        <div className="password-flow-icon">
          <ShieldCheck
            size={36}
          />
        </div>

        <span className="password-flow-label">
          PARENT / GUARDIAN
        </span>

        <h1>
          Verify Password Reset
        </h1>

        <p>
          A password reset was requested
          for this Youth Initiative account.
        </p>

        <div className="parent-reset-confirmations">
          <div>
            <CheckCircle2
              size={19}
            />

            I am the student&apos;s
            parent or guardian.
          </div>

          <div>
            <CheckCircle2
              size={19}
            />

            I approve resetting the
            student&apos;s password.
          </div>

          <div>
            <CheckCircle2
              size={19}
            />

            I will create the new password.
          </div>
        </div>

        <button
          type="button"
          className="password-primary-button"
          disabled={
            approving
          }
          onClick={
            approveReset
          }
        >
          {approving ? (
            <>
              <LoaderCircle
                size={19}
                className="button-spinner"
              />

              Verifying...
            </>
          ) : (
            "Yes, Approve Password Reset"
          )}
        </button>

        <p className="password-mvp-note">
          Parent identity verification is
          simulated for the MVP prototype.
        </p>
      </section>
    </main>
  );
}