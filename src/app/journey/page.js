"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

import {
  Award,
  BookOpen,
  Check,
  Compass,
  Cpu,
  Flame,
  Hammer,
  Home,
  LoaderCircle,
  Lock,
  Map,
  Rocket,
  Sparkles,
  Star,
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

export default function JourneyPage() {
  const {
    user,
    loading: authLoading,
  } = useAuth();

  const [gameData, setGameData] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    async function loadGameProgress() {
      try {
        if (!user) {
          return;
        }

        const response =
          await studentFetch(
            "/api/gamification"
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message
          );
        }

        setGameData(
          data.gamification
        );
      } catch (error) {
        setErrorMessage(
          error.message ||
            "Progress could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      if (user) {
        loadGameProgress();
      } else {
        setLoading(false);
      }
    }
  }, [
    user,
    authLoading,
  ]);

  if (
    loading ||
    authLoading
  ) {
    return (
      <main className="game-loading">
        <LoaderCircle
          className="button-spinner"
          size={36}
        />

        Loading your journey...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="game-loading">
        <h1>Login Required</h1>

        <Link href="/login">
          Login
        </Link>
      </main>
    );
  }

  if (
    errorMessage ||
    !gameData
  ) {
    return (
      <main className="game-loading">
        <h1>
          Journey unavailable
        </h1>

        <p>{errorMessage}</p>
      </main>
    );
  }

  return (
    <main className="journey-game-page">

      <section className="journey-game-hero">
        <div className="journey-game-glow journey-game-glow-one" />
        <div className="journey-game-glow journey-game-glow-two" />

        <div className="student-content-container">

          <span className="journey-game-label">
            <Sparkles size={15} />
            MY SKILL QUEST
          </span>

          <div className="journey-player-card">

            <div className="journey-level-circle">
              <span>
                LEVEL
              </span>

              <strong>
                {gameData.level}
              </strong>
            </div>

            <div className="journey-player-info">

              <span>
                Current Rank
              </span>

              <h1>
                {gameData.rank}
              </h1>

              <div className="journey-level-progress">

                <div className="journey-level-progress-heading">
                  <span>
                    {gameData.totalXp} XP
                  </span>

                  {gameData.nextLevelXp && (
                    <span>
                      {gameData.nextLevelXp} XP
                    </span>
                  )}
                </div>

                <div className="journey-progress-track">
                  <div
                    className="journey-progress-value"
                    style={{
                      width:
                        `${gameData.progressPercentage}%`,
                    }}
                  />
                </div>

                {gameData.nextLevelXp ? (
                  <p>
                    {gameData.nextLevelXp -
                      gameData.totalXp}{" "}
                    XP until your next level
                  </p>
                ) : (
                  <p>
                    Maximum level achieved!
                  </p>
                )}
              </div>
            </div>

            <div className="journey-xp-display">
              <Star size={24} />

              <strong>
                {gameData.totalXp}
              </strong>

              <span>
                Total XP
              </span>
            </div>

          </div>

        </div>
      </section>


      <section className="student-content-container journey-game-content">

        <div className="journey-game-stats">

          <GameStat
            icon={BookOpen}
            value={
              gameData.completedWorkshops
            }
            label="Completed"
          />

          <GameStat
            icon={Award}
            value={
              gameData.badgeCount
            }
            label="Badges"
          />

          <GameStat
            icon={Compass}
            value={
              gameData.categoryCount
            }
            label="Skills Explored"
          />

          <GameStat
            icon={Zap}
            value={
              gameData.level
            }
            label="Level"
          />

        </div>


        <section className="skill-track-section">

          <div className="game-section-heading">

            <div>
              <span>
                SKILL PROGRESSION
              </span>

              <h2>
                Your Skill Tracks
              </h2>
            </div>

            <p>
              Each workshop strengthens a
              different skill pathway.
            </p>

          </div>

          {gameData.skillTracks.length ===
          0 ? (
            <div className="game-empty-card">
              <Compass size={42} />

              <h3>
                Your skill journey starts here
              </h3>

              <p>
                Complete workshops to start
                building your skill tracks.
              </p>

              <Link href="/workshops">
                Explore Workshops
              </Link>
            </div>
          ) : (
            <div className="skill-track-grid">

              {gameData.skillTracks.map(
                (track) => (
                  <SkillTrackCard
                    key={
                      track.category
                    }
                    track={track}
                  />
                )
              )}

            </div>
          )}

        </section>


        <section className="quest-section">

          <div className="game-section-heading">

            <div>
              <span>
                ACTIVE CHALLENGES
              </span>

              <h2>
                Skill Quests
              </h2>
            </div>

            <p>
              Complete challenges as you
              explore more of SAIT.
            </p>

          </div>

          <div className="quest-grid">

            {gameData.quests.map(
              (quest) => (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                />
              )
            )}

          </div>

        </section>


        <section className="journey-achievement-section">

          <div className="journey-achievement-icon">
            <Trophy size={35} />
          </div>

          <div>
            <span>
              YOUR NEXT MILESTONE
            </span>

            <h2>
              Keep building your journey.
            </h2>

            <p>
              Every verified workshop gives
              you XP, builds a skill track
              and brings you closer to your
              next achievement.
            </p>
          </div>

          <Link href="/workshops">
            Find My Next Workshop
          </Link>

        </section>

      </section>


      <nav className="student-bottom-navigation">

        <Link href="/dashboard">
          <Home size={20} />
          <span>Home</span>
        </Link>

        <Link href="/workshops">
          <BookOpen size={20} />
          <span>Workshops</span>
        </Link>

        <Link
          href="/journey"
          className="active"
        >
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


function GameStat({
  icon: Icon,
  value,
  label,
}) {
  return (
    <div className="journey-stat-card">
      <Icon size={23} />

      <strong>
        {value}
      </strong>

      <span>
        {label}
      </span>
    </div>
  );
}


function SkillTrackCard({
  track,
}) {
  return (
    <article className="skill-track-card">

      <div className="skill-track-top">

        <div className="skill-track-icon">
          <Cpu size={22} />
        </div>

        <span>
          Level {track.level}
        </span>

      </div>

      <h3>
        {track.category}
      </h3>

      <p>
        {track.completed} workshop
        {track.completed !== 1
          ? "s"
          : ""}{" "}
        completed
      </p>

      <div className="skill-track-progress">
        <div
          style={{
            width:
              `${track.progressPercentage}%`,
          }}
        />
      </div>

      <div className="skill-track-footer">
        <span>
          {track.xp} Skill XP
        </span>

        <span>
          {track.progressPercentage}%
        </span>
      </div>

    </article>
  );
}


function QuestCard({
  quest,
}) {
  const Icon =
    quest.icon === "rocket"
      ? Rocket
      : quest.icon === "hammer"
        ? Hammer
        : quest.icon === "compass"
          ? Compass
          : quest.icon === "cpu"
            ? Cpu
            : Trophy;

  const progress =
    Math.min(
      100,
      Math.round(
        (quest.current /
          quest.target) *
          100
      )
    );

  return (
    <article
      className={`quest-card ${
        quest.completed
          ? "completed"
          : ""
      }`}
    >

      <div className="quest-icon">
        {quest.completed ? (
          <Check size={24} />
        ) : (
          <Icon size={24} />
        )}
      </div>

      <div className="quest-content">

        <div className="quest-title-row">
          <h3>
            {quest.title}
          </h3>

          <span>
            +{quest.reward} XP
          </span>
        </div>

        <p>
          {quest.description}
        </p>

        <div className="quest-progress-track">
          <div
            style={{
              width:
                `${progress}%`,
            }}
          />
        </div>

        <div className="quest-footer">
          <span>
            {quest.current} /{" "}
            {quest.target}
          </span>

          <span>
            {quest.completed
              ? "Quest Complete"
              : `${progress}%`}
          </span>
        </div>

      </div>

    </article>
  );
}