import {
  adminDb,
} from "@/services/firebaseAdmin";

import {
  requireActiveStudent,
  studentAccessResponse,
} from "@/services/studentAccess";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    await requireActiveStudent(
      request
    );

    const workshopsSnapshot =
      await adminDb
        .collection(
          "workshops"
        )
        .where(
          "status",
          "==",
          "active"
        )
        .get();

    const workshops =
      workshopsSnapshot.docs
        .map(
          (
            workshopDocument
          ) => ({
            id:
              workshopDocument.id,

            ...workshopDocument.data(),
          })
        )
        .sort(
          (
            firstWorkshop,
            secondWorkshop
          ) =>
            firstWorkshop.title.localeCompare(
              secondWorkshop.title
            )
        );

    return Response.json({
      success: true,
      workshops,
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
      "Load workshops error:",
      error?.message
    );

    return Response.json(
      {
        success: false,

        message:
          "Workshops could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }
}