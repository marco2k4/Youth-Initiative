"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BookOpen,
  CalendarDays,
  Clock,
  Home,
  LoaderCircle,
  Map,
  MapPin,
  QrCode,
  Search,
  Trophy,
  UserRound,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { getWorkshopImage } from "@/utils/getWorkshopImage";

import {
  studentFetch,
} from "@/services/studentApi";

export default function RegisteredWorkshopsPage() {
  const {
    user,
    loading: authLoading,
  } = useAuth();

  const [registrations, setRegistrations] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [searchText, setSearchText] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    if (
      authLoading ||
      !user
    ) {
      return;
    }

    let cancelled = false;

    async function loadRegistrations() {
      try {
        const response =
          await studentFetch(
            "/api/registrations"
          );

        const responseData =
          await response.json();

        if (!response.ok) {
          throw new Error(
            responseData.message
          );
        }

        const upcomingRegistrations =
          responseData.registrations.filter(
            (registration) =>
              registration.status ===
                "upcoming" &&
              registration.workshop
          );

        if (!cancelled) {
          setRegistrations(
            upcomingRegistrations
          );
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error.message ||
              "Registered workshops could not be loaded."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRegistrations();

    return () => {
      cancelled = true;
    };
  }, [
    user,
    authLoading,
  ]);

  const filteredRegistrations =
    useMemo(() => {
      const searchValue =
        searchText
          .trim()
          .toLowerCase();

      return registrations.filter(
        (registration) => {
          const workshop =
            registration.workshop;

          return (
            !searchValue ||
            workshop.title
              ?.toLowerCase()
              .includes(searchValue) ||
            workshop.category
              ?.toLowerCase()
              .includes(searchValue)
          );
        }
      );
    }, [
      registrations,
      searchText,
    ]);

  if (
    !authLoading &&
    !user
  ) {
    return (
      <main className="registered-workshops-status">
        <h1>
          Login Required
        </h1>

        <p>
          Log in to view your registered
          workshops.
        </p>

        <Link href="/login">
          Go to Login
        </Link>
      </main>
    );
  }

  return (
    <main className="registered-workshops-page">
      <header className="student-app-header">
        <div className="student-app-header-content">
          <Link href="/dashboard">
            <Image
              src="/images/landing/sait-logo.jpg"
              alt="SAIT"
              width={170}
              height={60}
              className="student-header-logo"
            />
          </Link>

          <nav className="student-desktop-navigation">
            <Link href="/dashboard">
              Home
            </Link>

            <Link
              href="/workshops"
              className="active"
            >
              Workshops
            </Link>

            <Link href="/journey">
              Journey
            </Link>

            <Link href="/badges">
              Badges
            </Link>

            <Link href="/profile">
              Profile
            </Link>
          </nav>
        </div>
      </header>

      <section className="registered-workshops-hero">
        <div className="student-content-container">
          <span>
            My Learning
          </span>

          <h1>
            Upcoming Workshops
          </h1>

          <p>
            View workshops you have registered
            for and scan the attendance QR code
            when the workshop begins.
          </p>
        </div>
      </section>

      <section className="student-content-container registered-workshops-content">
        <div className="registered-workshop-tabs">
          <Link
            href="/registered-workshops"
            className="active"
          >
            Upcoming
          </Link>

          <Link href="/completed-workshops">
            Completed
          </Link>
        </div>

        <div className="registered-workshop-search">
          <Search size={19} />

          <input
            type="search"
            placeholder="Search registered workshops..."
            value={searchText}
            onChange={(event) =>
              setSearchText(
                event.target.value
              )
            }
          />
        </div>

        {loading ? (
          <div className="registered-workshops-status">
            <LoaderCircle
              size={34}
              className="button-spinner"
            />

            <p>
              Loading upcoming workshops...
            </p>
          </div>
        ) : errorMessage ? (
          <div className="student-workshop-error">
            {errorMessage}
          </div>
        ) : filteredRegistrations.length ===
          0 ? (
          <div className="registered-workshops-empty">
            <BookOpen size={50} />

            <h2>
              No Upcoming Workshops
            </h2>

            <p>
              Browse available workshops and
              register for an experience that
              interests you.
            </p>

            <Link href="/workshops">
              Explore Workshops
            </Link>
          </div>
        ) : (
          <div className="registered-workshops-grid">
            {filteredRegistrations.map(
              (registration) => (
                <RegisteredWorkshopCard
                  key={registration.id}
                  registration={
                    registration
                  }
                />
              )
            )}
          </div>
        )}
      </section>

      <nav className="student-bottom-navigation">
        <Link href="/dashboard">
          <Home size={20} />
          <span>Home</span>
        </Link>

        <Link
          href="/workshops"
          className="active"
        >
          <BookOpen size={20} />
          <span>Workshops</span>
        </Link>

        <Link href="/journey">
          <Map size={20} />
          <span>Journey</span>
        </Link>

        <Link href="/badges">
          <Trophy size={20} />
          <span>Badges</span>
        </Link>

        <Link href="/profile">
          <UserRound size={20} />
          <span>Profile</span>
        </Link>
      </nav>
    </main>
  );
}

function RegisteredWorkshopCard({
  registration,
}) {
  const workshop =
    registration.workshop;

  const workshopImage =
    workshop.image ||
    getWorkshopImage(
      workshop.category
    );

  return (
    <article className="registered-workshop-card">
      <div className="registered-workshop-image-wrapper">
        <Image
          src={workshopImage}
          alt={workshop.title}
          fill
          sizes="(max-width: 700px) 100vw, 420px"
          className="registered-workshop-image"
        />

        <span>
          Registered
        </span>
      </div>

      <div className="registered-workshop-card-content">
        <small>
          {workshop.category ||
            workshop.programArea}
        </small>

        <h2>
          {workshop.title}
        </h2>

        <div className="registered-workshop-information">
          <div>
            <CalendarDays size={17} />

            {workshop.startDate ||
              "Date to be announced"}
          </div>

          <div>
            <Clock size={17} />

            {workshop.time ||
              "Time to be announced"}
          </div>

          <div>
            <MapPin size={17} />

            {workshop.location ||
              (workshop.learningMode ===
              "online"
                ? "Online"
                : "SAIT Campus")}
          </div>
        </div>

        <div className="registered-workshop-actions">
          <Link
            href={`/workshops/${workshop.id}`}
          >
            View Details
          </Link>

          <Link
            href={`/scan-attendance?workshopId=${workshop.id}`}
            className="scan-attendance-button"
          >
            <QrCode size={18} />
            Scan Attendance
          </Link>
        </div>
      </div>
    </article>
  );
}