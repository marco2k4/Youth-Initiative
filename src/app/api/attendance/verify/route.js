import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
} from "@/services/firebaseAdmin";

import {
  processWorkshopCompletion,
} from "@/services/gamificationAdmin";

import {
  requireActiveStudent,
  studentAccessResponse,
} from "@/services/studentAccess";

export const runtime = "nodejs";

async function getStudent(request) {
  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    !authorization?.startsWith(
      "Bearer "
    )
  ) {
    throw new Error(
      "UNAUTHORIZED"
    );
  }

  const token =
    authorization.replace(
      "Bearer ",
      ""
    );

  const decodedToken =
    await adminAuth.verifyIdToken(
      token
    );

  return decodedToken.uid;
}

export async function POST(request) {
  try {
    const {
      uid: studentId,
    } =
      await requireActiveStudent(
        request,
        {
          consumeAppCheck:
            true,
        }
      );

    const {
      attendanceSessionId,
      code,
    } = await request.json();

    if (
      !attendanceSessionId ||
      !code
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Invalid attendance QR code.",
        },
        {
          status: 400,
        }
      );
    }

    const sessionReference =
      adminDb
        .collection(
          "attendanceSessions"
        )
        .doc(
          attendanceSessionId
        );

    const sessionSnapshot =
      await sessionReference.get();

    if (!sessionSnapshot.exists) {
      return Response.json(
        {
          success: false,
          message:
            "Attendance session not found.",
        },
        {
          status: 404,
        }
      );
    }

    const session =
      sessionSnapshot.data();

    if (!session.active) {
      return Response.json(
        {
          success: false,
          message:
            "This attendance QR is no longer active.",
        },
        {
          status: 410,
        }
      );
    }

    if (session.code !== code) {
      return Response.json(
        {
          success: false,
          message:
            "Invalid attendance code.",
        },
        {
          status: 401,
        }
      );
    }

    const expiryDate =
      session.expiresAt.toDate();

    if (
      expiryDate.getTime() <
      Date.now()
    ) {
      return Response.json(
        {
          success: false,
          message:
            "This attendance QR has expired.",
        },
        {
          status: 410,
        }
      );
    }

    const registrationSnapshot =
      await adminDb
        .collection(
          "registrations"
        )
        .where(
          "studentId",
          "==",
          studentId
        )
        .where(
          "workshopId",
          "==",
          session.workshopId
        )
        .limit(1)
        .get();

    if (
      registrationSnapshot.empty
    ) {
      return Response.json(
        {
          success: false,
          message:
            "You are not registered for this workshop.",
        },
        {
          status: 403,
        }
      );
    }

    const registrationDocument =
      registrationSnapshot.docs[0];

    const registration =
      registrationDocument.data();

    if (
      registration.status ===
      "completed"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Attendance has already been recorded.",
        },
        {
          status: 409,
        }
      );
    }

    const workshopSnapshot =
      await adminDb
        .collection("workshops")
        .doc(
          session.workshopId
        )
        .get();

    if (!workshopSnapshot.exists) {
      return Response.json(
        {
          success: false,
          message:
            "Workshop could not be found.",
        },
        {
          status: 404,
        }
      );
    }

    const workshop =
      workshopSnapshot.data();

    await registrationDocument
      .ref
      .update({
        status:
          "completed",

        attendanceStatus:
          "verified",

        attendanceSessionId,

        attendedAt:
          FieldValue.serverTimestamp(),

        completedAt:
          FieldValue.serverTimestamp(),

        completionXpAwarded:
          true,

        updatedAt:
          FieldValue.serverTimestamp(),
      });

    const reward =
      await processWorkshopCompletion({
        studentId,

        workshopId:
          session.workshopId,

        workshop,
      });

    return Response.json({
      success: true,

      message:
        "Attendance verified successfully!",

      workshop: {
        id:
          session.workshopId,

        title:
          workshop.title,

        category:
          workshop.category,
      },

      reward,
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
      "Attendance verification error:",
      error
    );

    return Response.json(
      {
        success: false,
        message:
          error.message ===
          "UNAUTHORIZED"
            ? "Please log in first."
            : "Attendance could not be verified.",
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