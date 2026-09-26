"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  studentFetch,
} from "@/services/studentApi";

import {
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Home,
  LoaderCircle,
  Map,
  MapPin,
  Search,
  Star,
  Trophy,
  UserRound,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { getWorkshopImage } from "@/utils/getWorkshopImage";

export default function CompletedWorkshopsPage() {
  const { user, loading: authLoading } = useAuth();

  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadCompletedWorkshops() {
      try {
        if (!user) {
          return;
        }

        const response = 
          await studentFetch(
            "/api/registrations"
          );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Completed workshops could not be loaded."
          );
        }

        const completed = data.registrations.filter(
          (registration) =>
            registration.status === "completed" &&
            registration.workshop
        );

        setRegistrations(completed);
      } catch (error) {
        console.error(
          "Load completed workshops error:",
          error
        );

        setErrorMessage(
          error.message ||
            "Completed workshops could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      if (user) {
        loadCompletedWorkshops();
      } else {
        setLoading(false);
      }
    }
  }, [user, authLoading]);

  const filteredRegistrations = useMemo(() => {
    const searchValue = searchText
      .trim()
      .toLowerCase();

    return registrations.filter((registration) => {
      const workshop = registration.workshop;

      return (
        !searchValue ||
        workshop.title
          ?.toLowerCase()
          .includes(searchValue) ||
        workshop.category
          ?.toLowerCase()
          .includes(searchValue) ||
        workshop.programArea
          ?.toLowerCase()
          .includes(searchValue)
      );
    });
  }, [registrations, searchText]);

  if (!authLoading && !user) {
    return (
      <main className="completed-workshops-status">
        <h1>Login Required</h1>

        <p>
          Log in to view your completed workshops.
        </p>

        <Link href="/login">
          Go to Login
        </Link>
      </main>
    );
  }

  return (
    <main className="completed-workshops-page">
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

      <section className="completed-workshops-hero">
        <div className="student-content-container completed-workshops-hero-content">
          <div>
            <span>
              MY LEARNING JOURNEY
            </span>

            <h1>
              Completed Workshops
            </h1>

            <p>
              Every completed workshop builds your skills,
              XP and achievement collection.
            </p>
          </div>

          <div className="completed-summary-card">
            <CheckCircle2 size={25} />

            <div>
              <strong>
                {registrations.length}
              </strong>

              <span>
                Completed
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="student-content-container completed-workshops-content">
        <div className="registered-workshop-tabs">
          <Link href="/registered-workshops">
            Upcoming
          </Link>

          <Link
            href="/completed-workshops"
            className="active"
          >
            Completed
          </Link>
        </div>

        <div className="registered-workshop-search">
          <Search size={19} />

          <input
            type="search"
            placeholder="Search completed workshops..."
            value={searchText}
            onChange={(event) =>
              setSearchText(event.target.value)
            }
          />
        </div>

        {loading ? (
          <div className="completed-workshops-status">
            <LoaderCircle
              size={35}
              className="button-spinner"
            />

            <p>
              Loading completed workshops...
            </p>
          </div>
        ) : errorMessage ? (
          <div className="student-workshop-error">
            {errorMessage}
          </div>
        ) : filteredRegistrations.length === 0 ? (
          <div className="completed-workshops-empty">
            <Trophy size={52} />

            <h2>
              Your journey is just beginning
            </h2>

            <p>
              Complete your first registered workshop
              and scan the attendance QR to unlock XP
              and badges.
            </p>

            <Link href="/workshops">
              Explore Workshops
            </Link>
          </div>
        ) : (
          <div className="completed-workshops-grid">
            {filteredRegistrations.map(
              (registration) => (
                <CompletedWorkshopCard
                  key={registration.id}
                  registration={registration}
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

function CompletedWorkshopCard({
  registration,
}) {
  const workshop = registration.workshop;

  const workshopImage =
    workshop.image ||
    getWorkshopImage(workshop.category);

  const completedDate =
    registration.completedAt?._seconds
      ? new Date(
          registration.completedAt._seconds * 1000
        ).toLocaleDateString()
      : "Completed";

  return (
    <article className="completed-workshop-card">
      <div className="completed-workshop-image-wrapper">
        <Image
          src={workshopImage}
          alt={workshop.title}
          fill
          sizes="(max-width: 700px) 100vw, 420px"
          className="completed-workshop-image"
        />

        <div className="completed-workshop-overlay" />

        <span className="completed-status-badge">
          <CheckCircle2 size={14} />
          Completed
        </span>

        <div className="completed-card-xp">
          <Star size={16} />
          +{workshop.xpReward || 100} XP
        </div>
      </div>

      <div className="completed-workshop-card-content">
        <small>
          {workshop.category ||
            workshop.programArea}
        </small>

        <h2>
          {workshop.title}
        </h2>

        <div className="completed-workshop-information">
          <div>
            <CalendarDays size={17} />

            Completed {completedDate}
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

        <div className="completed-workshop-footer">
          <div>
            <Award size={18} />

            <span>
              Achievement earned
            </span>
          </div>

          <Link
            href={`/workshops/${workshop.id}`}
          >
            View Workshop
          </Link>
        </div>
      </div>
    </article>
  );
}