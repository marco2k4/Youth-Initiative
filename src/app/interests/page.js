"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  doc,
  updateDoc,
} from "firebase/firestore";

import {
  Bot,
  BriefcaseBusiness,
  Check,
  Code2,
  Cpu,
  Hammer,
  HeartPulse,
  LoaderCircle,
  Palette,
  Plane,
  Utensils,
} from "lucide-react";

import {
  db,
} from "@/services/firebase";

import {
  useAuth,
} from "@/contexts/AuthContext";

const interestOptions = [
  {
    id: "coding",
    title: "Coding",
    icon: Code2,
  },
  {
    id: "artificial intelligence",
    title: "AI",
    icon: Bot,
  },
  {
    id: "robotics",
    title: "Robotics",
    icon: Cpu,
  },
  {
    id: "skilled trades",
    title: "Skilled Trades",
    icon: Hammer,
  },
  {
    id: "business",
    title: "Business",
    icon: BriefcaseBusiness,
  },
  {
    id: "design",
    title: "Design & Creativity",
    icon: Palette,
  },
  {
    id: "health",
    title: "Health",
    icon: HeartPulse,
  },
  {
    id: "aviation",
    title: "Aviation",
    icon: Plane,
  },
  {
    id: "culinary",
    title: "Culinary",
    icon: Utensils,
  },
];

export default function InterestsPage() {
  const router =
    useRouter();

  const {
    user,
    studentProfile: student,
    loading: authLoading,
  } = useAuth();

  if (authLoading) {
    return (
      <main className="onboarding-status">
        <LoaderCircle
          className="button-spinner"
          size={36}
        />
      </main>
    );
  }

  if (
    !user ||
    !student
  ) {
    return (
      <main className="onboarding-status">
        <p>
          Account information could not be loaded.
        </p>
      </main>
    );
  }

  return (
    <InterestsForm
      user={user}
      student={student}
      router={router}
    />
  );
}

function InterestsForm({
  user,
  student,
  router,
}) {
  const [
    selectedInterests,
    setSelectedInterests,
  ] = useState(
    Array.isArray(
      student.interests
    )
      ? student.interests
      : []
  );

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  function toggleInterest(
    interestId
  ) {
    setSelectedInterests(
      (
        currentInterests
      ) => {
        if (
          currentInterests.includes(
            interestId
          )
        ) {
          return currentInterests.filter(
            (interest) =>
              interest !==
              interestId
          );
        }

        if (
          currentInterests.length >=
          5
        ) {
          return currentInterests;
        }

        return [
          ...currentInterests,
          interestId,
        ];
      }
    );
  }

  async function completeOnboarding() {
    try {
      setSaving(true);
      setErrorMessage("");

      await updateDoc(
        doc(
          db,
          "students",
          user.uid
        ),
        {
          interests:
            selectedInterests,

          onboardingCompleted:
            true,
        }
      );

      router.replace(
        "/dashboard"
      );
    } catch (error) {
      console.error(
        "Save interests error:",
        error
      );

      setErrorMessage(
        "Your interests could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  async function skipInterests() {
    try {
      setSaving(true);
      setErrorMessage("");

      await updateDoc(
        doc(
          db,
          "students",
          user.uid
        ),
        {
          interests: [],

          onboardingCompleted:
            true,
        }
      );

      router.replace(
        "/dashboard"
      );
    } catch (error) {
      console.error(
        "Skip interests error:",
        error
      );

      setErrorMessage(
        "Onboarding could not be completed."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="onboarding-page">
      <section className="onboarding-card interests-card">
        <div className="onboarding-progress">
          <div className="active" />
          <div className="active" />
        </div>

        <span className="onboarding-step">
          STEP 2 OF 2
        </span>

        <h1>
          What are you interested in?
        </h1>

        <p className="onboarding-description">
          Select up to five areas
          you want to explore.
        </p>

        <span className="interest-counter">
          {
            selectedInterests.length
          }{" "}
          / 5 selected
        </span>

        <div className="interest-grid">
          {interestOptions.map(
            (interest) => {
              const Icon =
                interest.icon;

              const selected =
                selectedInterests.includes(
                  interest.id
                );

              return (
                <button
                  key={
                    interest.id
                  }
                  type="button"
                  className={`interest-card ${
                    selected
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    toggleInterest(
                      interest.id
                    )
                  }
                >
                  <div className="interest-icon">
                    <Icon
                      size={25}
                    />
                  </div>

                  <strong>
                    {
                      interest.title
                    }
                  </strong>

                  <div className="interest-check">
                    {selected && (
                      <Check
                        size={14}
                      />
                    )}
                  </div>
                </button>
              );
            }
          )}
        </div>

        {errorMessage && (
          <div className="onboarding-error">
            {
              errorMessage
            }
          </div>
        )}

        <button
          type="button"
          className="onboarding-primary-button"
          disabled={
            saving
          }
          onClick={
            completeOnboarding
          }
        >
          {saving ? (
            <>
              <LoaderCircle
                size={19}
                className="button-spinner"
              />

              Saving...
            </>
          ) : (
            "Start My Journey"
          )}
        </button>

        <button
          type="button"
          className="onboarding-skip"
          disabled={
            saving
          }
          onClick={
            skipInterests
          }
        >
          Skip for now
        </button>
      </section>
    </main>
  );
}