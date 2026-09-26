"use client";

import Image from "next/image";
import Link from "next/link";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  useEffect,
  useState,
} from "react";

import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";

import {
  useAuth,
} from "@/contexts/AuthContext";

import {
  studentFetch,
} from "@/services/studentApi";

export default function RegistrationSuccessPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const {
    user,
    loading:
      authLoading,
  } = useAuth();

  const [
    workshop,
    setWorkshop,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  useEffect(() => {
    async function loadWorkshop() {
      try {
        setLoading(true);
        setErrorMessage("");

        const response =
          await studentFetch(
            `/api/workshops/${encodeURIComponent(
              params.id
            )}`
          );

        const responseData =
          await response.json();

        if (!response.ok) {
          throw new Error(
            responseData.message ||
              "Workshop could not be loaded."
          );
        }

        setWorkshop(
          responseData.workshop
        );
      } catch (error) {
        setErrorMessage(
          error.message ||
            "Workshop could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    }

    if (authLoading) {
      return;
    }

    if (!user) {
      setLoading(false);

      router.replace(
        "/login"
      );

      return;
    }

    if (params.id) {
      loadWorkshop();
    }
  }, [
    params.id,
    user,
    authLoading,
    router,
  ]);

  async function confirmRegistration() {
    try {
      if (!user) {
        router.push(
          "/login"
        );

        return;
      }

      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const response =
        await studentFetch(
          "/api/registrations",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                workshopId:
                  params.id,
              }),
          }
        );

      const responseData =
        await response.json();

      if (!response.ok) {
        throw new Error(
          responseData.message ||
            "Registration could not be confirmed."
        );
      }

      setSuccessMessage(
        responseData.message
      );

      setTimeout(() => {
        router.push(
          "/registered-workshops"
        );
      }, 1200);
    } catch (error) {
      setErrorMessage(
        error.message ||
          "Registration could not be confirmed."
      );
    } finally {
      setSaving(false);
    }
  }

  if (
    loading ||
    authLoading
  ) {
    return (
      <main className="registration-confirm-page">
        <section className="registration-confirm-card">
          <LoaderCircle
            className="button-spinner"
            size={38}
          />

          <p>
            Loading registration...
          </p>
        </section>
      </main>
    );
  }

  if (!workshop) {
    return (
      <main className="registration-confirm-page">
        <section className="registration-confirm-card">
          <TriangleAlert
            size={48}
          />

          <h1>
            Workshop unavailable
          </h1>

          <p>
            {errorMessage}
          </p>

          <Link href="/workshops">
            Return to Workshops
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="registration-confirm-page">
      <section className="registration-confirm-card">
        <button
          type="button"
          className="registration-back-button"
          onClick={() =>
            router.back()
          }
        >
          <ArrowLeft
            size={20}
          />

          Back
        </button>

        <Image
          src="/images/landing/sait-logo.jpg"
          alt="SAIT"
          width={220}
          height={70}
          className="registration-confirm-logo"
        />

        <div className="registration-check-icon">
          <CheckCircle2
            size={45}
          />
        </div>

        <span className="registration-confirm-label">
          Registration
          Confirmation
        </span>

        <h1>
          Did you complete your
          registration?
        </h1>

        <p>
          Confirm that you
          completed the official
          SAIT registration process
          for:
        </p>

        <div className="registration-workshop-summary">
          <span>
            {workshop.category ||
              workshop.programArea}
          </span>

          <strong>
            {workshop.title}
          </strong>

          <small>
            {workshop.grade}
            {" · "}
            {workshop.learningMode ===
            "online"
              ? "Online"
              : "In Person"}
          </small>
        </div>

        {errorMessage && (
          <div className="registration-confirm-error">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="registration-confirm-success">
            <CheckCircle2
              size={19}
            />

            {successMessage}
          </div>
        )}

        <button
          type="button"
          className="registration-confirm-button"
          disabled={
            saving ||
            Boolean(
              successMessage
            )
          }
          onClick={
            confirmRegistration
          }
        >
          {saving ? (
            <>
              <LoaderCircle
                size={20}
                className="button-spinner"
              />

              Saving Registration...
            </>
          ) : (
            "Yes, I Completed Registration"
          )}
        </button>

        <a
          href={
            workshop.registrationUrl ||
            "https://saitdigitalyouth.campbrainregistration.com/"
          }
          target="_blank"
          rel="noreferrer"
          className="registration-portal-link"
        >
          Return to Official
          Registration

          <ExternalLink
            size={17}
          />
        </a>

        <p className="registration-confirm-note">
          For this MVP, external
          registration is confirmed
          by the student. Future
          versions can integrate
          directly with the official
          registration platform.
        </p>
      </section>
    </main>
  );
}