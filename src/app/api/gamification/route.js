import {
  adminAuth,
  adminDb,
} from "@/services/firebaseAdmin";

import {
  requireActiveStudent,
  studentAccessResponse,
} from "@/services/studentAccess";

export const runtime = "nodejs";

async function getStudentId(request) {
  const authorization =
    request.headers.get("authorization");

  if (
    !authorization ||
    !authorization.startsWith("Bearer ")
  ) {
    throw new Error("UNAUTHORIZED");
  }

  const token = authorization.replace(
    "Bearer ",
    ""
  );

  const decodedToken =
    await adminAuth.verifyIdToken(token);

  return decodedToken.uid;
}

function getLevelInformation(totalXp) {
  const levels = [
    {
      level: 1,
      name: "New Explorer",
      minimumXp: 0,
      nextXp: 100,
    },

    {
      level: 2,
      name: "Skill Starter",
      minimumXp: 100,
      nextXp: 250,
    },

    {
      level: 3,
      name: "Future Creator",
      minimumXp: 250,
      nextXp: 450,
    },

    {
      level: 4,
      name: "Innovation Builder",
      minimumXp: 450,
      nextXp: 700,
    },

    {
      level: 5,
      name: "Pathway Explorer",
      minimumXp: 700,
      nextXp: 1000,
    },

    {
      level: 6,
      name: "Youth Champion",
      minimumXp: 1000,
      nextXp: null,
    },
  ];

  let currentLevel =
    levels[0];

  for (const level of levels) {
    if (
      totalXp >= level.minimumXp
    ) {
      currentLevel = level;
    }
  }

  let progressPercentage = 100;

  if (currentLevel.nextXp) {
    const levelRange =
      currentLevel.nextXp -
      currentLevel.minimumXp;

    const levelProgress =
      totalXp -
      currentLevel.minimumXp;

    progressPercentage = Math.min(
      100,
      Math.round(
        (levelProgress /
          levelRange) *
          100
      )
    );
  }

  return {
    ...currentLevel,
    progressPercentage,
  };
}

function createQuestData({
  completedCount,
  categoryCount,
  technologyCount,
}) {
  return [
    {
      id: "first-steps",
      title: "First Steps",
      description:
        "Complete your first workshop",
      current: completedCount,
      target: 1,
      completed:
        completedCount >= 1,
      reward: 50,
      icon: "rocket",
    },

    {
      id: "skill-builder",
      title: "Skill Builder",
      description:
        "Complete 3 workshops",
      current: Math.min(
        completedCount,
        3
      ),
      target: 3,
      completed:
        completedCount >= 3,
      reward: 100,
      icon: "hammer",
    },

    {
      id: "curious-explorer",
      title: "Curious Explorer",
      description:
        "Explore 3 different skill areas",
      current: Math.min(
        categoryCount,
        3
      ),
      target: 3,
      completed:
        categoryCount >= 3,
      reward: 150,
      icon: "compass",
    },

    {
      id: "tech-journey",
      title: "Tech Journey",
      description:
        "Complete 3 Technology workshops",
      current: Math.min(
        technologyCount,
        3
      ),
      target: 3,
      completed:
        technologyCount >= 3,
      reward: 150,
      icon: "cpu",
    },

    {
      id: "workshop-champion",
      title: "Workshop Champion",
      description:
        "Complete 5 workshops",
      current: Math.min(
        completedCount,
        5
      ),
      target: 5,
      completed:
        completedCount >= 5,
      reward: 250,
      icon: "trophy",
    },
  ];
}

export async function GET(request) {
  try {
    const {
      uid: studentId,
    } =
      await requireActiveStudent(
        request
      );

    const studentSnapshot =
      await adminDb
        .collection("students")
        .doc(studentId)
        .get();

    if (!studentSnapshot.exists) {
      return Response.json(
        {
          success: false,
          message:
            "Student profile not found.",
        },
        {
          status: 404,
        }
      );
    }

    const student =
      studentSnapshot.data();

    const registrationsSnapshot =
      await adminDb
        .collection("registrations")
        .where(
          "studentId",
          "==",
          studentId
        )
        .where(
          "status",
          "==",
          "completed"
        )
        .get();

    const completedWorkshops = [];

    for (
      const registrationDocument
      of registrationsSnapshot.docs
    ) {
      const registration =
        registrationDocument.data();

      const workshopSnapshot =
        await adminDb
          .collection("workshops")
          .doc(
            registration.workshopId
          )
          .get();

      if (
        workshopSnapshot.exists
      ) {
        completedWorkshops.push({
          id:
            workshopSnapshot.id,

          ...workshopSnapshot.data(),
        });
      }
    }

    const categoryProgress = {};

    completedWorkshops.forEach(
      (workshop) => {
        const category =
          workshop.category ||
          "General";

        if (
          !categoryProgress[
            category
          ]
        ) {
          categoryProgress[
            category
          ] = {
            category,
            completed: 0,
            xp: 0,
          };
        }

        categoryProgress[
          category
        ].completed += 1;

        categoryProgress[
          category
        ].xp +=
          Number(
            workshop.xpReward
          ) || 100;
      }
    );

    const skillTracks =
      Object.values(
        categoryProgress
      ).map((track) => {
        const skillLevel =
          Math.floor(
            track.xp / 300
          ) + 1;

        const xpInsideLevel =
          track.xp % 300;

        return {
          ...track,

          level:
            skillLevel,

          nextLevelXp:
            skillLevel * 300,

          progressPercentage:
            Math.round(
              (xpInsideLevel /
                300) *
                100
            ),
        };
      });

    const technologyCount =
      categoryProgress
        .Technology
        ?.completed || 0;

    const quests =
      createQuestData({
        completedCount:
          completedWorkshops.length,

        categoryCount:
          Object.keys(
            categoryProgress
          ).length,

        technologyCount,
      });

    const badgesSnapshot =
      await adminDb
        .collection(
          "studentBadges"
        )
        .where(
          "studentId",
          "==",
          studentId
        )
        .get();

    const badges =
      badgesSnapshot.docs.map(
        (badgeDocument) => ({
          id:
            badgeDocument.id,

          ...badgeDocument.data(),
        })
      );

    const totalXp =
      Number(student.totalXp) ||
      0;

    const levelInformation =
      getLevelInformation(
        totalXp
      );

    return Response.json({
      success: true,

      gamification: {
        totalXp,

        level:
          levelInformation.level,

        rank:
          levelInformation.name,

        nextLevelXp:
          levelInformation.nextXp,

        levelMinimumXp:
          levelInformation.minimumXp,

        progressPercentage:
          levelInformation.progressPercentage,

        completedWorkshops:
          completedWorkshops.length,

        categoryCount:
          Object.keys(
            categoryProgress
          ).length,

        badgeCount:
          badges.length,

        skillTracks,

        quests,

        badges,
      },
    });
  } catch (error) {
    const accessResponse =
      studentAccessResponse(
        error
      );

    if (accessResponse) {
      return accessResponse;
    }

    console.error(
      "Gamification API error:",
      error
    );

    return Response.json(
      {
        success: false,

        message:
          error.message ===
          "UNAUTHORIZED"
            ? "Please log in."
            : "Gamification progress could not be loaded.",
      },
      {
        status:
          error.message ===
          "UNAUTHORIZED"
            ? 401
            : 500,
      }
    );
  }
}