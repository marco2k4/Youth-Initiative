"use client";

import Link from "next/link";

import {
  Award,
  CheckCircle2,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";

import {
  useMemo,
  useSyncExternalStore,
} from "react";

function subscribe() {
  return () => {};
}

function getServerSnapshot() {
  return null;
}

function getClientSnapshot() {
  return sessionStorage.getItem(
    "latestReward"
  );
}

export default function RewardPage() {
  const savedReward =
    useSyncExternalStore(
      subscribe,
      getClientSnapshot,
      getServerSnapshot
    );

  const rewardData =
    useMemo(() => {
      if (!savedReward) {
        return null;
      }

      try {
        return JSON.parse(
          savedReward
        );
      } catch {
        return null;
      }
    }, [
      savedReward,
    ]);

  if (!rewardData) {
    return (
      <main className="reward-page">
        <section className="reward-card">
          <h1>
            No New Reward
          </h1>

          <Link href="/workshops">
            Explore Workshops
          </Link>
        </section>
      </main>
    );
  }

  const {
    workshop,
    reward,
  } = rewardData;

  return (
    <main className="reward-page">
      <div className="reward-glow reward-glow-one" />
      <div className="reward-glow reward-glow-two" />

      <section className="reward-card">
        <div className="reward-success-icon">
          <CheckCircle2
            size={54}
          />
        </div>

        <span className="reward-label">
          WORKSHOP COMPLETED
        </span>

        <h1>
          Nice work!
        </h1>

        <p>
          You successfully completed
          <strong>
            {" "}
            {workshop.title}
          </strong>
          .
        </p>

        <div className="reward-xp">
          <Sparkles
            size={30}
          />

          <div>
            <span>
              XP EARNED
            </span>

            <strong>
              +{reward.xpEarned} XP
            </strong>
          </div>
        </div>

        <div className="reward-progress-summary">
          <div>
            <Star
              size={21}
            />

            <span>
              Total XP
            </span>

            <strong>
              {reward.totalXp}
            </strong>
          </div>

          <div>
            <Trophy
              size={21}
            />

            <span>
              Level
            </span>

            <strong>
              {reward.level}
            </strong>
          </div>

          <div>
            <Award
              size={21}
            />

            <span>
              Rank
            </span>

            <strong>
              {reward.levelName}
            </strong>
          </div>
        </div>

        {reward.newBadges.length >
          0 && (
          <div className="new-badge-section">
            <span>
              NEW BADGE
            </span>

            {reward.newBadges.map(
              (badge) => (
                <div
                  key={badge.id}
                  className="new-badge-card"
                >
                  <Award
                    size={30}
                  />

                  <strong>
                    {badge.name}
                  </strong>

                  <small>
                    Badge Unlocked!
                  </small>
                </div>
              )
            )}
          </div>
        )}

        <div className="reward-actions">
          <Link href="/completed-workshops">
            View Completed Workshops
          </Link>

          <Link href="/journey">
            View My Journey
          </Link>
        </div>
      </section>
    </main>
  );
}