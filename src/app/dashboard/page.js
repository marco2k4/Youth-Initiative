"use client";

import Link from "next/link";
import Image from "next/image";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Compass,
  Flame,
  Home,
  LoaderCircle,
  Map,
  MapPin,
  QrCode,
  Rocket,
  Sparkles,
  Star,
  Target,
  Trophy,
  UserRound,
  Zap,
} from "lucide-react";

import {
  useAuth,
} from "@/contexts/AuthContext";

import {
  studentFetch,
} from "@/services/studentApi";

import {
  getWorkshopImage,
} from "@/utils/getWorkshopImage";

export default function DashboardPage() {
  const {
    user,
    student,
    loading: authLoading,
  } = useAuth();

  const [
    gameData,
    setGameData,
  ] = useState(null);

  const [
    registrations,
    setRegistrations,
  ] = useState([]);

  const [
    workshops,
    setWorkshops,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    if (
      authLoading ||
      !user
    ) {
      return;
    }

    let cancelled =
      false;

    async function loadDashboard() {
      try {
        setLoading(true);
        setErrorMessage("");

        /*
          studentFetch automatically adds:

          Authorization:
          Bearer <Firebase ID token>

          X-Firebase-AppCheck:
          <App Check token>
        */

        const [
          gameResponse,
          registrationResponse,
          workshopResponse,
        ] = await Promise.all([
          studentFetch(
            "/api/gamification"
          ),

          studentFetch(
            "/api/registrations"
          ),

          studentFetch(
            "/api/workshops"
          ),
        ]);

        const gameResult =
          await gameResponse.json();

        const registrationResult =
          await registrationResponse.json();

        const workshopResult =
          await workshopResponse.json();

        if (!gameResponse.ok) {
          throw new Error(
            gameResult.message ||
              "Could not load your progress."
          );
        }

        if (
          !registrationResponse.ok
        ) {
          throw new Error(
            registrationResult.message ||
              "Could not load your registrations."
          );
        }

        if (
          !workshopResponse.ok
        ) {
          throw new Error(
            workshopResult.message ||
              "Could not load workshops."
          );
        }

        if (
          cancelled
        ) {
          return;
        }

        setGameData(
          gameResult.gamification
        );

        setRegistrations(
          registrationResult.registrations ||
            []
        );

        setWorkshops(
          workshopResult.workshops ||
            []
        );
      } catch (error) {
        console.error(
          "Dashboard loading error:",
          error
        );

        if (
          !cancelled
        ) {
          setErrorMessage(
            error.message ||
              "Your dashboard could not be loaded."
          );
        }
      } finally {
        if (
          !cancelled
        ) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled =
        true;
    };
  }, [
    user,
    authLoading,
  ]);

  const upcomingRegistrations =
    useMemo(() => {
      return registrations.filter(
        (registration) =>
          registration.status !==
            "completed" &&
          registration.workshop
      );
    }, [
      registrations,
    ]);

  const nextWorkshop =
    upcomingRegistrations[0] ||
    null;

  const activeQuest =
    useMemo(() => {
      if (
        !gameData?.quests
      ) {
        return null;
      }

      return (
        gameData.quests.find(
          (quest) =>
            !quest.completed
        ) ||
        gameData.quests[
          gameData.quests.length -
            1
        ]
      );
    }, [
      gameData,
    ]);

  const recommendedWorkshops =
    useMemo(() => {
      const registeredIds =
        new Set(
          registrations.map(
            (registration) =>
              registration.workshopId
          )
        );

      const interests =
        student?.interests ||
        [];

      const normalizedInterests =
        interests.map(
          (interest) =>
            String(
              interest
            ).toLowerCase()
        );

      const scored =
        workshops
          .filter(
            (workshop) =>
              !registeredIds.has(
                workshop.id
              )
          )
          .map(
            (workshop) => {
              const searchableText =
                [
                  workshop.title,
                  workshop.category,
                  workshop.programArea,
                  workshop.description,
                ]
                  .filter(
                    Boolean
                  )
                  .join(" ")
                  .toLowerCase();

              let score = 0;

              normalizedInterests.forEach(
                (
                  interest
                ) => {
                  if (
                    searchableText.includes(
                      interest
                    )
                  ) {
                    score += 1;
                  }
                }
              );

              return {
                ...workshop,
                recommendationScore:
                  score,
              };
            }
          )
          .sort(
            (a, b) =>
              b.recommendationScore -
              a.recommendationScore
          );

      return scored.slice(
        0,
        3
      );
    }, [
      workshops,
      registrations,
      student,
    ]);

  if (
    authLoading ||
    (
      user &&
      loading
    )
  ) {
    return (
      <main className="dashboard-state-page">
        <div className="dashboard-loading-orb">
          <LoaderCircle
            size={34}
            className="button-spinner"
          />
        </div>

        <h2>
          Loading your journey...
        </h2>

        <p>
          Getting your workshops,
          XP and achievements ready.
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="dashboard-state-page">
        <h1>
          Login Required
        </h1>

        <p>
          Log in to continue your
          Youth Initiative journey.
        </p>

        <Link href="/login">
          Go to Login
        </Link>
      </main>
    );
  }

  if (
    !gameData ||
    errorMessage
  ) {
    return (
      <main className="dashboard-state-page">
        <h1>
          Dashboard unavailable
        </h1>

        <p>
          {errorMessage}
        </p>
      </main>
    );
  }

  const firstName =
    student?.firstName ||
    user?.displayName?.split(
      " "
    )[0] ||
    "Explorer";

  const questProgress =
    activeQuest
      ? Math.min(
          100,
          Math.round(
            (activeQuest.current /
              activeQuest.target) *
              100
          )
        )
      : 0;

  return (
    <main className="student-dashboard">
      {/* DESKTOP HEADER */}

      <header className="student-app-header">
        <div className="student-app-header-content">
          <Link
            href="/dashboard"
            className="student-brand"
          >
            <Image
              src="/images/landing/sait-logo.jpg"
              alt="SAIT"
              width={145}
              height={52}
              priority
              className="student-header-logo"
            />

            <div className="student-brand-divider" />

            <div className="student-brand-text">
              <strong>
                Youth Initiative
              </strong>

              <span>
                Skill Quest
              </span>
            </div>
          </Link>

          <nav className="student-desktop-navigation">
            <Link
              href="/dashboard"
              className="active"
            >
              Home
            </Link>

            <Link href="/workshops">
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

          <Link
            href="/profile"
            className="dashboard-profile-button"
          >
            <div>
              {firstName
                .charAt(0)
                .toUpperCase()}
            </div>

            <span>
              {firstName}
            </span>
          </Link>
        </div>
      </header>

      {/* HERO / PLAYER PROFILE */}

      <section className="dashboard-game-hero">
        <div className="dashboard-hero-orb dashboard-orb-one" />
        <div className="dashboard-hero-orb dashboard-orb-two" />

        <div className="student-content-container dashboard-hero-content">
          <div className="dashboard-welcome">
            <span className="dashboard-eyebrow">
              <Sparkles
                size={14}
              />

              YOUR SKILL QUEST
            </span>

            <h1>
              Welcome back,{" "}
              <strong>
                {firstName}.
              </strong>
            </h1>

            <p>
              Keep exploring,
              building skills and
              discovering where your
              interests can take you.
            </p>
          </div>

          <div className="dashboard-player-panel">
            <div className="dashboard-level-emblem">
              <span>
                LEVEL
              </span>

              <strong>
                {gameData.level}
              </strong>
            </div>

            <div className="dashboard-player-progress">
              <div className="dashboard-rank-line">
                <div>
                  <span>
                    CURRENT RANK
                  </span>

                  <h2>
                    {gameData.rank}
                  </h2>
                </div>

                <div className="dashboard-total-xp">
                  <Star
                    size={17}
                  />

                  <strong>
                    {
                      gameData.totalXp
                    }
                  </strong>

                  <span>
                    XP
                  </span>
                </div>
              </div>

              <div className="dashboard-progress-labels">
                <span>
                  Level{" "}
                  {
                    gameData.level
                  }
                </span>

                {gameData.nextLevelXp ? (
                  <span>
                    {
                      gameData.nextLevelXp
                    }{" "}
                    XP
                  </span>
                ) : (
                  <span>
                    MAX LEVEL
                  </span>
                )}
              </div>

              <div className="dashboard-xp-track">
                <div
                  className="dashboard-xp-fill"
                  style={{
                    width:
                      `${gameData.progressPercentage}%`,
                  }}
                >
                  <span />
                </div>
              </div>

              {gameData.nextLevelXp ? (
                <p>
                  <strong>
                    {gameData.nextLevelXp -
                      gameData.totalXp}
                  </strong>{" "}
                  XP until your next
                  level
                </p>
              ) : (
                <p>
                  You reached the
                  highest current Skill
                  Quest level.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT */}

      <section className="student-content-container dashboard-main">
        {/* PLAYER STATS */}

        <div className="dashboard-stat-grid">
          <DashboardStat
            icon={
              CheckCircle2
            }
            value={
              gameData.completedWorkshops
            }
            label="Completed"
            detail="Workshops"
          />

          <DashboardStat
            icon={Trophy}
            value={
              gameData.badgeCount
            }
            label="Badges"
            detail="Unlocked"
          />

          <DashboardStat
            icon={Compass}
            value={
              gameData.categoryCount
            }
            label="Skill Areas"
            detail="Explored"
          />

          <DashboardStat
            icon={Zap}
            value={
              gameData.totalXp
            }
            label="Total XP"
            detail="Earned"
          />
        </div>

        {/* NEXT WORKSHOP + QUEST */}

        <div className="dashboard-focus-grid">
          <section className="dashboard-section">
            <div className="dashboard-section-heading">
              <div>
                <span>
                  UP NEXT
                </span>

                <h2>
                  Continue Your
                  Journey
                </h2>
              </div>

              <Link href="/registered-workshops">
                View all
                <ChevronRight
                  size={16}
                />
              </Link>
            </div>

            {nextWorkshop ? (
              <NextWorkshopCard
                registration={
                  nextWorkshop
                }
              />
            ) : (
              <div className="dashboard-empty-workshop">
                <div>
                  <Rocket
                    size={31}
                  />
                </div>

                <section>
                  <span>
                    READY FOR YOUR NEXT
                    QUEST?
                  </span>

                  <h3>
                    Find a workshop
                    that interests you.
                  </h3>

                  <p>
                    Register for a
                    workshop and start
                    earning XP, badges
                    and skill progress.
                  </p>

                  <Link href="/workshops">
                    Explore Workshops
                    <ChevronRight
                      size={16}
                    />
                  </Link>
                </section>
              </div>
            )}
          </section>

          <section className="dashboard-section">
            <div className="dashboard-section-heading">
              <div>
                <span>
                  ACTIVE QUEST
                </span>

                <h2>
                  Your Challenge
                </h2>
              </div>

              <Link href="/journey">
                All quests
                <ChevronRight
                  size={16}
                />
              </Link>
            </div>

            {activeQuest && (
              <article
                className={`dashboard-quest-card ${
                  activeQuest.completed
                    ? "completed"
                    : ""
                }`}
              >
                <div className="dashboard-quest-top">
                  <div className="dashboard-quest-icon">
                    {activeQuest.completed ? (
                      <CheckCircle2
                        size={27}
                      />
                    ) : (
                      <Target
                        size={27}
                      />
                    )}
                  </div>

                  <div className="dashboard-quest-reward">
                    <Star
                      size={14}
                    />
                    +
                    {
                      activeQuest.reward
                    }
                    {" XP"}
                  </div>
                </div>

                <span className="dashboard-quest-label">
                  {activeQuest.completed
                    ? "QUEST COMPLETE"
                    : "IN PROGRESS"}
                </span>

                <h3>
                  {
                    activeQuest.title
                  }
                </h3>

                <p>
                  {
                    activeQuest.description
                  }
                </p>

                <div className="dashboard-quest-progress-heading">
                  <span>
                    Quest Progress
                  </span>

                  <strong>
                    {
                      activeQuest.current
                    }
                    {" / "}
                    {
                      activeQuest.target
                    }
                  </strong>
                </div>

                <div className="dashboard-quest-progress">
                  <div
                    style={{
                      width:
                        `${questProgress}%`,
                    }}
                  />
                </div>

                <div className="dashboard-quest-footer">
                  <span>
                    {questProgress}%
                    complete
                  </span>

                  <Link href="/journey">
                    View Skill Quest
                    <ChevronRight
                      size={14}
                    />
                  </Link>
                </div>
              </article>
            )}
          </section>
        </div>

        {/* SKILL TRACKS */}

        <section className="dashboard-section dashboard-skills-section">
          <div className="dashboard-section-heading">
            <div>
              <span>
                YOUR PROGRESS
              </span>

              <h2>
                Skill Tracks
              </h2>
            </div>

            <Link href="/journey">
              Full journey
              <ChevronRight
                size={16}
              />
            </Link>
          </div>

          {gameData.skillTracks
            .length > 0 ? (
            <div className="dashboard-skill-grid">
              {gameData.skillTracks
                .slice(0, 3)
                .map(
                  (track) => (
                    <article
                      className="dashboard-skill-card"
                      key={
                        track.category
                      }
                    >
                      <div className="dashboard-skill-header">
                        <div className="dashboard-skill-icon">
                          <Zap
                            size={20}
                          />
                        </div>

                        <span>
                          LVL{" "}
                          {
                            track.level
                          }
                        </span>
                      </div>

                      <h3>
                        {
                          track.category
                        }
                      </h3>

                      <p>
                        {
                          track.completed
                        }{" "}
                        workshop
                        {track.completed !==
                        1
                          ? "s"
                          : ""}{" "}
                        completed
                      </p>

                      <div className="dashboard-skill-progress">
                        <div
                          style={{
                            width:
                              `${track.progressPercentage}%`,
                          }}
                        />
                      </div>

                      <footer>
                        <span>
                          {track.xp} Skill
                          XP
                        </span>

                        <strong>
                          {
                            track.progressPercentage
                          }
                          %
                        </strong>
                      </footer>
                    </article>
                  )
                )}
            </div>
          ) : (
            <div className="dashboard-no-skills">
              <Compass
                size={31}
              />

              <div>
                <strong>
                  No skill tracks yet
                </strong>

                <span>
                  Complete your first
                  workshop to start
                  building your skills.
                </span>
              </div>
            </div>
          )}
        </section>

        {/* RECOMMENDATIONS */}

        <section className="dashboard-section dashboard-recommendation-section">
          <div className="dashboard-section-heading">
            <div>
              <span>
                RECOMMENDED FOR YOU
              </span>

              <h2>
                Discover What&apos;s
                Next
              </h2>
            </div>

            <Link href="/workshops">
              Browse all
              <ChevronRight
                size={16}
              />
            </Link>
          </div>

          <div className="dashboard-recommendation-grid">
            {recommendedWorkshops.map(
              (workshop) => (
                <RecommendedWorkshop
                  key={
                    workshop.id
                  }
                  workshop={
                    workshop
                  }
                />
              )
            )}
          </div>
        </section>

        {/* CTA */}

        <section className="dashboard-journey-cta">
          <div className="dashboard-cta-icon">
            <Trophy
              size={33}
            />
          </div>

          <div>
            <span>
              YOUR JOURNEY IS GROWING
            </span>

            <h2>
              Every workshop gets
              you closer to your
              future.
            </h2>

            <p>
              Build skills, unlock
              achievements and
              discover pathways that
              match what you&apos;re
              interested in.
            </p>
          </div>

          <Link href="/journey">
            View My Journey
            <ChevronRight
              size={16}
            />
          </Link>
        </section>
      </section>

      {/* MOBILE NAVIGATION */}

      <nav className="student-bottom-navigation">
        <Link
          href="/dashboard"
          className="active"
        >
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

        <Link href="/profile">
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

function DashboardStat({
  icon: Icon,
  value,
  label,
  detail,
}) {
  return (
    <article className="dashboard-stat-card">
      <div className="dashboard-stat-icon">
        <Icon
          size={21}
        />
      </div>

      <div>
        <strong>
          {value}
        </strong>

        <span>
          {label}
        </span>

        <small>
          {detail}
        </small>
      </div>
    </article>
  );
}

function NextWorkshopCard({
  registration,
}) {
  const workshop =
    registration.workshop;

  const image =
    workshop.image ||
    getWorkshopImage(
      workshop.category
    );

  return (
    <article className="dashboard-next-workshop">
      <div className="dashboard-next-image">
        <Image
          src={image}
          alt={
            workshop.title
          }
          fill
          sizes="(max-width: 700px) 100vw, 500px"
        />

        <span>
          UPCOMING
        </span>
      </div>

      <div className="dashboard-next-content">
        <small>
          {workshop.category ||
            workshop.programArea ||
            "Youth Program"}
        </small>

        <h3>
          {workshop.title}
        </h3>

        <div className="dashboard-next-details">
          <div>
            <CalendarDays
              size={16}
            />

            {workshop.date ||
              "Workshop date"}
          </div>

          <div>
            <MapPin
              size={16}
            />

            {workshop.location ||
              "SAIT Campus"}
          </div>
        </div>

        <div className="dashboard-next-actions">
          <Link
            href={`/workshops/${workshop.id}`}
          >
            View Details
          </Link>

          <Link
            href={`/scan-attendance?workshopId=${workshop.id}`}
            className="dashboard-scan-button"
          >
            <QrCode
              size={16}
            />

            Scan Attendance
          </Link>
        </div>
      </div>
    </article>
  );
}

function RecommendedWorkshop({
  workshop,
}) {
  const image =
    workshop.image ||
    getWorkshopImage(
      workshop.category
    );

  return (
    <Link
      href={`/workshops/${workshop.id}`}
      className="dashboard-recommendation-card"
    >
      <div className="dashboard-recommendation-image">
        <Image
          src={image}
          alt={
            workshop.title
          }
          fill
          sizes="(max-width: 700px) 100vw, 350px"
        />

        {workshop.recommendationScore >
          0 && (
          <span>
            <Sparkles
              size={12}
            />

            MATCHED TO YOU
          </span>
        )}
      </div>

      <div className="dashboard-recommendation-content">
        <small>
          {workshop.category ||
            workshop.programArea ||
            "Youth Program"}
        </small>

        <h3>
          {workshop.title}
        </h3>

        <div>
          <span>
            Explore Workshop
          </span>

          <ChevronRight
            size={17}
          />
        </div>
      </div>
    </Link>
  );
}