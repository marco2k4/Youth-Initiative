"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Clock,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Monitor,
  Star,
  Users,
} from "lucide-react";

import { getWorkshopImage } from "@/utils/getWorkshopImage";

import {
  studentFetch,
} from "@/services/studentApi";

export default function WorkshopDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const [workshop, setWorkshop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    async function loadWorkshop() {
      try {
        const response = await studentFetch(
          `/api/workshops/${encodeURIComponent(params.id)}`
        );

        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(responseData.message);
        }

        setWorkshop(responseData.workshop);
      } catch (error) {
        setErrorMessage(
          error.message ||
            "Workshop details could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      loadWorkshop();
    }
  }, [params.id]);

  if (loading) {
    return (
      <main className="workshop-details-status">
        <LoaderCircle
          size={38}
          className="button-spinner"
        />
        <p>Loading workshop...</p>
      </main>
    );
  }

  if (errorMessage || !workshop) {
    return (
      <main className="workshop-details-status">
        <BookOpen size={48} />

        <h1>Workshop unavailable</h1>
        <p>{errorMessage}</p>

        <Link href="/workshops">
          Return to Workshops
        </Link>
      </main>
    );
  }

  const workshopImage =
    workshop.image ||
    getWorkshopImage(workshop.category);

  const registrationUrl =
    workshop.registrationUrl ||
    "https://saitdigitalyouth.campbrainregistration.com/";

  return (
    <main className="workshop-details-page">
      <header className="workshop-details-header">
        <div className="student-content-container">
          <button
            type="button"
            onClick={() => router.back()}
          >
            <ArrowLeft size={22} />
            Back to Workshops
          </button>
        </div>
      </header>

      <div className="student-content-container workshop-details-layout">
        <section className="workshop-details-main">
          <div className="workshop-details-image-wrapper">
            <Image
              src={workshopImage}
              alt={workshop.title}
              fill
              sizes="(max-width: 900px) 100vw, 65vw"
              className="workshop-details-image"
              priority
            />

            <span className="workshop-details-mode">
              {workshop.learningMode === "online" ? (
                <Monitor size={16} />
              ) : (
                <MapPin size={16} />
              )}

              {workshop.learningMode === "online"
                ? "Online"
                : workshop.learningMode === "both"
                  ? "Online & In Person"
                  : "In Person"}
            </span>
          </div>

          <div className="workshop-details-content">
            <span className="workshop-category-label">
              {workshop.category ||
                workshop.programArea}
            </span>

            <h1>{workshop.title}</h1>

            <p className="workshop-details-description">
              {workshop.description}
            </p>

            <div className="workshop-information-grid">
              <InformationItem
                icon={Users}
                label="Grade"
                value={workshop.grade}
              />

              <InformationItem
                icon={CalendarDays}
                label="Date"
                value={
                  workshop.startDate ||
                  "To be announced"
                }
              />

              <InformationItem
                icon={Clock}
                label="Time"
                value={
                  workshop.time ||
                  "To be announced"
                }
              />

              <InformationItem
                icon={MapPin}
                label="Location"
                value={
                  workshop.location ||
                  (workshop.learningMode === "online"
                    ? "Online"
                    : "SAIT Campus")
                }
              />
            </div>

            {workshop.informationUrl && (
              <a
                href={workshop.informationUrl}
                target="_blank"
                rel="noreferrer"
                className="official-workshop-link"
              >
                View Official Workshop Information
                <ExternalLink size={17} />
              </a>
            )}
          </div>
        </section>

        <aside className="workshop-registration-card">
          <div className="workshop-xp-card">
            <Star size={25} />

            <div>
              <span>Workshop Reward</span>
              <strong>
                +{workshop.xpReward || 100} XP
              </strong>
            </div>
          </div>

          <h2>Ready to register?</h2>

          <p>
            Registration is completed through the official
            SAIT Youth Programs registration portal.
          </p>

          <a
            href={registrationUrl}
            target="_blank"
            rel="noreferrer"
            className="workshop-register-button"
          >
            Register Now
            <ExternalLink size={18} />
          </a>

          <Link
            href={`/registration-success/${workshop.id}`}
            className="registration-confirmation-link"
          >
            I completed registration
          </Link>

          <div className="workshop-registration-note">
            After registering on the official portal,
            return here and confirm your registration.
          </div>
        </aside>
      </div>
    </main>
  );
}

function InformationItem({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="workshop-information-item">
      <span>
        <Icon size={20} />
      </span>

      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}