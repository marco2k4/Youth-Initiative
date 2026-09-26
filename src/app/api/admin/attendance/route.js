import crypto from "crypto";

import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "@/services/firebaseAdmin";

import {
  adminAccessResponse,
  requireActiveAdmin,
} from "@/services/adminAccess";

export const runtime = "nodejs";

const ALLOWED_DURATIONS = [
  5,
  10,
  15,
  30,
];

export async function POST(
  request
) {
  try {
    const admin =
      await requireActiveAdmin(
        request
      );

    const {
      workshopId,
      durationMinutes = 15,
    } = await request.json();

    if (
      typeof workshopId !==
        "string" ||
      !workshopId.trim()
    ) {
      return Response.json(
        {
          success: false,

          message:
            "Workshop ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const duration =
      Number(
        durationMinutes
      );

    if (
      !ALLOWED_DURATIONS.includes(
        duration
      )
    ) {
      return Response.json(
        {
          success: false,

          message:
            "Attendance duration is invalid.",
        },
        {
          status: 400,
        }
      );
    }

    const workshopSnapshot =
      await adminDb
        .collection(
          "workshops"
        )
        .doc(
          workshopId.trim()
        )
        .get();

    if (
      !workshopSnapshot.exists
    ) {
      return Response.json(
        {
          success: false,

          message:
            "Workshop not found.",
        },
        {
          status: 404,
        }
      );
    }

    const attendanceCode =
      crypto
        .randomBytes(24)
        .toString("hex");

    const expiresAt =
      Timestamp.fromDate(
        new Date(
          Date.now() +
            duration *
              60 *
              1000
        )
      );

    const attendanceReference =
      adminDb
        .collection(
          "attendanceSessions"
        )
        .doc();

    await attendanceReference.set({
      workshopId:
        workshopId.trim(),

      code:
        attendanceCode,

      active: true,

      expiresAt,

      createdBy:
        admin.uid,

      createdAt:
        FieldValue.serverTimestamp(),
    });

    return Response.json({
      success: true,

      attendanceSessionId:
        attendanceReference.id,

      code:
        attendanceCode,

      workshop:
        workshopSnapshot.data(),

      expiresAt:
        expiresAt
          .toDate()
          .toISOString(),
    });
  } catch (error) {
    const accessResponse =
      adminAccessResponse(
        error
      );

    if (accessResponse) {
      return accessResponse;
    }

    console.error(
      "Create attendance session error:",
      error
    );

    return Response.json(
      {
        success: false,

        message:
          "Attendance QR could not be created.",
      },
      {
        status: 500,
      }
    );
  }
}