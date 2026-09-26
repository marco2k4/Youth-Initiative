import {
  adminDb,
} from "@/services/firebaseAdmin";

import {
  requireActiveStudent,
  studentAccessResponse,
} from "@/services/studentAccess";

export const runtime = "nodejs";

export async function GET(
  request,
  context
) {
  try {
    await requireActiveStudent(
      request
    );

    const {
      id,
    } =
      await context.params;

    if (
      typeof id !== "string" ||
      !id.trim()
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

    const workshopSnapshot =
      await adminDb
        .collection(
          "workshops"
        )
        .doc(id.trim())
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

    const workshop = {
      id:
        workshopSnapshot.id,

      ...workshopSnapshot.data(),
    };

    if (
      workshop.status !==
      "active"
    ) {
      return Response.json(
        {
          success: false,

          message:
            "This workshop is currently unavailable.",
        },
        {
          status: 404,
        }
      );
    }

    return Response.json({
      success: true,
      workshop,
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
      "Load workshop details error:",
      error?.message
    );

    return Response.json(
      {
        success: false,

        message:
          "Workshop details could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }
}