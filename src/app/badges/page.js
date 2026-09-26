"use client";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Award,
  BookOpen,
  CheckCircle2,
  Cpu,
  Home,
  LoaderCircle,
  Lock,
  Map,
  Medal,
  Sparkles,
  Star,
  Trophy,
  UserRound,
} from "lucide-react";

import {
  useAuth,
} from "@/contexts/AuthContext";

import {
  studentFetch,
} from "@/services/studentApi";

const badgeCatalog = [
  {
    id: "first-step",
    name: "First Step",
    description:
      "Complete your first workshop.",
    icon: Award,
    type: "completed",
    target: 1,
  },
  {
    id: "tech-explorer",
    name: "Tech Explorer",
    description:
      "Complete a Technology workshop.",
    icon: Cpu,
    type: "technology",
    target: 1,
  },
  {
    id: "skill-builder",
    name: "Skill Builder",
    description:
      "Complete 3 workshops.",
    icon: Medal,
    type: "completed",
    target: 3,
  },
  {
    id: "curious-learner",
    name: "Curious Learner",
    description:
      "Explore 3 different skill areas.",
    icon: Sparkles,
    type: "categories",
    target: 3,
  },
  {
    id: "workshop-champion",
    name: "Workshop Champion",
    description:
      "Complete 5 workshops.",
    icon: Trophy,
    type: "completed",
    target: 5,
  },
];

export default function BadgesPage() {
  const {
    user,
    loading: authLoading,
  } = useAuth();

  const [
    gameData,
    setGameData,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    async function loadBadges() {
      try {
        if (!user) {
          return;
        }

        setErrorMessage("");

        const response =
          await studentFetch(
            "/api/gamification"
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Badge progress could not be loaded."
          );
        }

        setGameData(
          data.gamification
        );
      } catch (error) {
        console.error(
          "Load badges error:",
          error
        );

        setErrorMessage(
          error.message ||
            "Badge progress could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      if (user) {
        loadBadges();
      } else {
        setLoading(false);
      }
    }
  }, [
    user,
    authLoading,
  ]);

  const earnedBadgeIds =
    useMemo(() => {
      if (
        !gameData?.badges
      ) {
        return new Set();
      }

      const ids =
        gameData.badges.map(
          (badge) => {
            if (
              badge.badgeId
            ) {
              return badge.badgeId;
            }

            const firestoreId =
              badge.id || "";

            const parts =
              firestoreId.split(
                "_"
              );

            return parts[
              parts.length -
                1
            ];
          }
        );

      return new Set(
        ids
      );
    }, [
      gameData,
    ]);

  function getBadgeProgress(
    badge
  ) {
    if (!gameData) {
      return {
        current: 0,
        target:
          badge.target,
      };
    }

    if (
      badge.type ===
      "completed"
    ) {
      return {
        current:
          Math.min(
            gameData.completedWorkshops,
            badge.target
          ),

        target:
          badge.target,
      };
    }

    if (
      badge.type ===
      "categories"
    ) {
      return {
        current:
          Math.min(
            gameData.categoryCount,
            badge.target
          ),

        target:
          badge.target,
      };
    }

    if (
      badge.type ===
      "technology"
    ) {
      const technologyTrack =
        gameData.skillTracks.find(
          (track) =>
            track.category ===
            "Technology"
        );

      return {
        current:
          Math.min(
            technologyTrack?.completed ||
              0,
            badge.target
          ),

        target:
          badge.target,
      };
    }

    return {
      current: 0,
      target:
        badge.target,
    };
  }

  if (
    loading ||
    authLoading
  ) {
    return (
      <main className="badges-status-page">
        <LoaderCircle
          size={36}
          className="button-spinner"
        />

        <p>
          Loading your
          achievements...
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="badges-status-page">
        <h1>
          Login Required
        </h1>

        <p>
          Log in to view your
          badges and progress.
        </p>

        <Link href="/login">
          Login
        </Link>
      </main>
    );
  }

  if (
    !gameData ||
    errorMessage
  ) {
    return (
      <main className="badges-status-page">
        <h1>
          Badges unavailable
        </h1>

        <p>
          {errorMessage}
        </p>
      </main>
    );
  }

  const unlockedCount =
    badgeCatalog.filter(
      (badge) =>
        earnedBadgeIds.has(
          badge.id
        )
    ).length;

  return (
    <main className="badges-page">
      <section className="badges-hero">
        <div className="student-content-container badges-hero-content">
          <div>
            <span className="badges-label">
              <Sparkles
                size={15}
              />

              ACHIEVEMENTS
            </span>

            <h1>
              My Badges
            </h1>

            <p>
              Complete workshops,
              explore new skill areas
              and unlock achievements
              as your journey grows.
            </p>
          </div>

          <div className="badges-hero-summary">
            <div>
              <Trophy
                size={23}
              />

              <strong>
                {
                  unlockedCount
                }
              </strong>

              <span>
                Unlocked
              </span>
            </div>

            <div>
              <Star
                size={23}
              />

              <strong>
                {
                  gameData.totalXp
                }
              </strong>

              <span>
                Total XP
              </span>
            </div>

            <div>
              <Award
                size={23}
              />

              <strong>
                {
                  gameData.level
                }
              </strong>

              <span>
                Level
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="student-content-container badges-content">
        <div className="badges-section-heading">
          <div>
            <span>
              BADGE COLLECTION
            </span>

            <h2>
              Unlock Your
              Achievements
            </h2>
          </div>

          <p>
            {unlockedCount} of{" "}
            {
              badgeCatalog.length
            }{" "}
            badges unlocked
          </p>
        </div>

        <div className="badges-grid">
          {badgeCatalog.map(
            (badge) => {
              const unlocked =
                earnedBadgeIds.has(
                  badge.id
                );

              const progress =
                getBadgeProgress(
                  badge
                );

              const progressPercentage =
                Math.min(
                  100,
                  Math.round(
                    (progress.current /
                      progress.target) *
                      100
                  )
                );

              const Icon =
                badge.icon;

              return (
                <article
                  key={
                    badge.id
                  }
                  className={`badge-card ${
                    unlocked
                      ? "badge-unlocked"
                      : "badge-locked"
                  }`}
                >
                  <div className="badge-medal-wrapper">
                    <div className="badge-medal-ring">
                      <Icon
                        size={37}
                      />
                    </div>

                    {unlocked ? (
                      <span className="badge-unlocked-indicator">
                        <CheckCircle2
                          size={17}
                        />
                      </span>
                    ) : (
                      <span className="badge-lock-indicator">
                        <Lock
                          size={15}
                        />
                      </span>
                    )}
                  </div>

                  <span className="badge-state-label">
                    {unlocked
                      ? "ACHIEVEMENT UNLOCKED"
                      : "LOCKED"}
                  </span>

                  <h3>
                    {
                      badge.name
                    }
                  </h3>

                  <p>
                    {
                      badge.description
                    }
                  </p>

                  {unlocked ? (
                    <div className="badge-complete-message">
                      <CheckCircle2
                        size={16}
                      />

                      Badge earned
                    </div>
                  ) : (
                    <div className="badge-progress-area">
                      <div className="badge-progress-heading">
                        <span>
                          Progress
                        </span>

                        <strong>
                          {
                            progress.current
                          }
                          {" / "}
                          {
                            progress.target
                          }
                        </strong>
                      </div>

                      <div className="badge-progress-track">
                        <div
                          className="badge-progress-value"
                          style={{
                            width:
                              `${progressPercentage}%`,
                          }}
                        />
                      </div>

                      <small>
                        {
                          progressPercentage
                        }
                        % complete
                      </small>
                    </div>
                  )}
                </article>
              );
            }
          )}
        </div>

        <section className="badges-next-goal">
          <div className="badges-next-goal-icon">
            <Trophy
              size={31}
            />
          </div>

          <div>
            <span>
              KEEP GOING
            </span>

            <h2>
              Your next badge is
              waiting.
            </h2>

            <p>
              Explore another
              workshop, build a new
              skill and continue your
              Skill Quest.
            </p>
          </div>

          <Link href="/workshops">
            Explore Workshops
          </Link>
        </section>
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

        <Link
          href="/badges"
          className="active"
        >
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