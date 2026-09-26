import { FieldValue } from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
} from "@/services/firebaseAdmin";

import {
  requireActiveStudent,
  studentAccessResponse,
} from "@/services/studentAccess";

export const runtime = "nodejs";

async function getAuthenticatedStudent(request) {
  const authorizationHeader =
    request.headers.get("authorization");

  if (
    !authorizationHeader ||
    !authorizationHeader.startsWith("Bearer ")
  ) {
    throw new Error("UNAUTHORIZED");
  }

  const idToken = authorizationHeader.replace(
    "Bearer ",
    ""
  );

  const decodedToken =
    await adminAuth.verifyIdToken(idToken);

  const studentSnapshot = await adminDb
    .collection("students")
    .doc(decodedToken.uid)
    .get();

  if (!studentSnapshot.exists) {
    throw new Error("STUDENT_NOT_FOUND");
  }

  return {
    uid: decodedToken.uid,
    student: studentSnapshot.data(),
  };
}

export async function GET(request) {
  try {
    const { uid } =
      await requireActiveStudent(request);

    const registrationsSnapshot = await adminDb
      .collection("registrations")
      .where("studentId", "==", uid)
      .get();

    const registrations = await Promise.all(
      registrationsSnapshot.docs.map(
        async (registrationDocument) => {
          const registration =
            registrationDocument.data();

          const workshopSnapshot = await adminDb
            .collection("workshops")
            .doc(registration.workshopId)
            .get();

          return {
            id: registrationDocument.id,
            ...registration,
            workshop: workshopSnapshot.exists
              ? {
                  id: workshopSnapshot.id,
                  ...workshopSnapshot.data(),
                }
              : null,
          };
        }
      )
    );

    return Response.json({
      success: true,
      registrations,
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
      "Get registrations error:",
      error
    );

    const status =
      error.message === "UNAUTHORIZED"
        ? 401
        : error.message === "STUDENT_NOT_FOUND"
          ? 404
          : 500;

    return Response.json(
      {
        success: false,
        message:
          status === 401
            ? "You must be logged in."
            : "Registrations could not be loaded.",
      },
      {
        status,
      }
    );
  }
}

export async function POST(request) {
  try {
    const { uid } =
      await requireActiveStudent(request);

    const { workshopId } =
      await request.json();

    if (!workshopId) {
      return Response.json(
        {
          success: false,
          message: "Workshop ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const workshopReference = adminDb
      .collection("workshops")
      .doc(workshopId);

    const workshopSnapshot =
      await workshopReference.get();

    if (
      !workshopSnapshot.exists ||
      workshopSnapshot.data().status !== "active"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "This workshop is unavailable.",
        },
        {
          status: 404,
        }
      );
    }

    const existingRegistrationSnapshot =
      await adminDb
        .collection("registrations")
        .where("studentId", "==", uid)
        .where("workshopId", "==", workshopId)
        .limit(1)
        .get();

    if (
      !existingRegistrationSnapshot.empty
    ) {
      const existingRegistration =
        existingRegistrationSnapshot.docs[0];

      return Response.json(
        {
          success: true,
          alreadyRegistered: true,
          registrationId:
            existingRegistration.id,
          message:
            "This workshop is already in your registered workshops.",
        },
        {
          status: 200,
        }
      );
    }

    const registrationReference =
      adminDb
        .collection("registrations")
        .doc();

    await registrationReference.set({
      studentId: uid,
      workshopId,

      status: "upcoming",
      externalRegistrationConfirmed: true,

      attendanceStatus: "pending",
      attendanceSessionId: null,
      attendedAt: null,
      completedAt: null,

      registrationXpAwarded: false,
      completionXpAwarded: false,

      registeredAt:
        FieldValue.serverTimestamp(),

      createdAt:
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    return Response.json(
      {
        success: true,
        alreadyRegistered: false,
        registrationId:
          registrationReference.id,
        message:
          "Workshop added to your upcoming workshops.",
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    const accessResponse =
      studentAccessResponse(
        error
      );

    if (accessResponse) {
      return accessResponse;
    }

    console.error(
      "Create registration error:",
      error
    );

    const status =
      error.message === "UNAUTHORIZED"
        ? 401
        : error.message === "STUDENT_NOT_FOUND"
          ? 404
          : 500;

    return Response.json(
      {
        success: false,
        message:
          status === 401
            ? "Please log in before registering."
            : "The registration could not be saved.",
      },
      {
        status,
      }
    );
  }
}