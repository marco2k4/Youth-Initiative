"use client";

import Link from "next/link";
import {
  useRouter,
} from "next/navigation";

import {
  Award,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Edit3,
  Home,
  LogOut,
  Mail,
  Map,
  Monitor,
  ShieldCheck,
  Trophy,
  UserRound,
  Zap,
} from "lucide-react";

import {
  signOut,
} from "firebase/auth";

import {
  auth,
} from "@/services/firebase";

import {
  useAuth,
} from "@/contexts/AuthContext";

export default function ProfilePage() {
  const router =
    useRouter();

  const {
    user,
    student,
    loading,
  } = useAuth();

  async function handleLogout() {
    await signOut(
      auth
    );

    router.replace(
      "/login"
    );
  }

  if (loading) {
    return (
      <main className="profile-state">
        Loading profile...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="profile-state">
        <h1>
          Login Required
        </h1>

        <Link href="/login">
          Login
        </Link>
      </main>
    );
  }

  const fullName =
    student?.fullName ||
    `${student?.firstName || ""} ${
      student?.lastName || ""
    }`.trim();

  const initials =
    `${
      student?.firstName?.[0] || ""
    }${
      student?.lastName?.[0] || ""
    }`.toUpperCase();

  return (
    <main className="student-profile-page">

      <section className="profile-hero">

        <div className="student-content-container">

          <span className="profile-eyebrow">
            MY PROFILE
          </span>

          <div className="profile-identity">

            <div className="profile-avatar">
              {initials || "YI"}
            </div>

            <div>
              <h1>
                {fullName}
              </h1>

              <p>
                SAIT Youth Initiative
                Student
              </p>

              <span>
                <ShieldCheck
                  size={14}
                />

                Active Account
              </span>
            </div>

            <Link
              href="/edit-profile"
              className="profile-edit-button"
            >
              <Edit3
                size={16}
              />

              Edit Profile
            </Link>

          </div>

        </div>

      </section>


      <section className="student-content-container profile-content">

        <div className="profile-game-stats">

          <ProfileStat
            icon={Zap}
            value={
              student?.totalXp ||
              0
            }
            label="Total XP"
          />

          <ProfileStat
            icon={Trophy}
            value={
              student?.level ||
              1
            }
            label="Level"
          />

          <ProfileStat
            icon={Award}
            value={
              student?.badgeCount ||
              0
            }
            label="Badges"
          />

          <ProfileStat
            icon={BookOpen}
            value={
              student
                ?.completedWorkshopCount ||
              0
            }
            label="Completed"
          />

        </div>


        <div className="profile-layout">

          <section className="profile-section-card">

            <div className="profile-section-heading">
              <div>
                <span>
                  ACCOUNT
                </span>

                <h2>
                  Student Information
                </h2>
              </div>
            </div>


            <ProfileInformation
              icon={UserRound}
              label="Youth Initiative ID"
              value={
                student?.youthId ||
                "Not available"
              }
              highlight
            />

            <ProfileInformation
              icon={Mail}
              label="Email"
              value={
                student?.contactEmail ||
                "Not available"
              }
            />

            <ProfileInformation
              icon={CalendarDays}
              label="Date of Birth"
              value={
                student?.dateOfBirth ||
                "Not available"
              }
            />

            <ProfileInformation
              icon={Monitor}
              label="Learning Preference"
              value={
                formatLearningMode(
                  student?.learningMode
                )
              }
            />

          </section>


          <section className="profile-section-card">

            <div className="profile-section-heading">

              <div>
                <span>
                  INTERESTS
                </span>

                <h2>
                  What I&apos;m Exploring
                </h2>
              </div>

              <Link
                href="/edit-profile"
              >
                Edit
              </Link>

            </div>


            {student?.interests?.length >
            0 ? (
              <div className="profile-interest-list">

                {student.interests.map(
                  (interest) => (
                    <span
                      key={interest}
                    >
                      {formatInterest(
                        interest
                      )}
                    </span>
                  )
                )}

              </div>
            ) : (
              <div className="profile-empty-interests">

                <p>
                  No interests selected
                  yet.
                </p>

                <Link href="/edit-profile">
                  Add Interests
                </Link>

              </div>
            )}


            <Link
              href="/journey"
              className="profile-journey-link"
            >
              <div>
                <Trophy
                  size={20}
                />

                <span>
                  View Skill Quest
                </span>
              </div>

              <ChevronRight
                size={17}
              />
            </Link>

            <Link
              href="/completed-workshops"
              className="profile-journey-link"
            >
              <div>
                <BookOpen
                  size={20}
                />

                <span>
                  Completed Workshops
                </span>
              </div>

              <ChevronRight
                size={17}
              />
            </Link>

          </section>

        </div>


        <button
          type="button"
          className="profile-logout-button"
          onClick={
            handleLogout
          }
        >
          <LogOut
            size={17}
          />

          Log Out
        </button>

      </section>


      <nav className="student-bottom-navigation">

        <Link href="/dashboard">
          <Home
            size={20}
          />

          <span>
            Home
          </span>
        </Link>

        <Link href="/workshops">
          <BookOpen
            size={20}
          />

          <span>
            Workshops
          </span>
        </Link>

        <Link href="/journey">
          <Map
            size={20}
          />

          <span>
            Journey
          </span>
        </Link>

        <Link href="/badges">
          <Trophy
            size={20}
          />

          <span>
            Badges
          </span>
        </Link>

        <Link
          href="/profile"
          className="active"
        >
          <UserRound
            size={20}
          />

          <span>
            Profile
          </span>
        </Link>

      </nav>

    </main>
  );
}


function ProfileStat({
  icon: Icon,
  value,
  label,
}) {
  return (
    <div className="profile-stat-card">
      <Icon
        size={21}
      />

      <strong>
        {value}
      </strong>

      <span>
        {label}
      </span>
    </div>
  );
}


function ProfileInformation({
  icon: Icon,
  label,
  value,
  highlight = false,
}) {
  return (
    <div className="profile-information-row">

      <div className="profile-information-icon">
        <Icon
          size={18}
        />
      </div>

      <div>
        <span>
          {label}
        </span>

        <strong
          className={
            highlight
              ? "profile-highlight-value"
              : ""
          }
        >
          {value}
        </strong>
      </div>

    </div>
  );
}


function formatLearningMode(
  mode
) {
  if (
    mode ===
    "in-person"
  ) {
    return "In Person";
  }

  if (
    mode ===
    "online"
  ) {
    return "Online";
  }

  if (
    mode ===
    "both"
  ) {
    return "Online & In Person";
  }

  return "Not selected";
}


function formatInterest(
  interest
) {
  return interest
    .split(" ")
    .map(
      (word) =>
        word
          .charAt(0)
          .toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}