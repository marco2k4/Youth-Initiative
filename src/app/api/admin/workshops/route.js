import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "@/services/firebaseAdmin";

import {
  adminAccessResponse,
  requireActiveAdmin,
} from "@/services/adminAccess";

export const runtime = "nodejs";

const VALID_LEARNING_MODES = [
  "in-person",
  "online",
  "both",
];

const VALID_STATUSES = [
  "active",
  "inactive",
];

function validateWorkshop(
  workshop
) {
  if (
    !workshop?.title?.trim() ||
    !workshop?.programArea?.trim() ||
    !workshop?.grade?.trim()
  ) {
    return "Title, program area and grade are required.";
  }

  if (
    workshop.learningMode &&
    !VALID_LEARNING_MODES.includes(
      workshop.learningMode
    )
  ) {
    return "Learning mode is invalid.";
  }

  if (
    workshop.status &&
    !VALID_STATUSES.includes(
      workshop.status
    )
  ) {
    return "Workshop status is invalid.";
  }

  return null;
}

function buildWorkshopData(
  workshop
) {
  const capacity =
    workshop.capacity === "" ||
    workshop.capacity === null ||
    workshop.capacity === undefined
      ? null
      : Number(
          workshop.capacity
        );

  const xpReward =
    Number(
      workshop.xpReward
    );

  return {
    title:
      workshop.title.trim(),

    programArea:
      workshop.programArea.trim(),

    category:
      workshop.category?.trim() ||
      "General",

    grade:
      workshop.grade.trim(),

    description:
      workshop.description?.trim() ||
      "",

    informationUrl:
      workshop.informationUrl?.trim() ||
      "",

    registrationUrl:
      workshop.registrationUrl?.trim() ||
      "https://saitdigitalyouth.campbrainregistration.com/",

    learningMode:
      workshop.learningMode ||
      "in-person",

    startDate:
      workshop.startDate ||
      null,

    endDate:
      workshop.endDate ||
      null,

    time:
      workshop.time?.trim() ||
      "",

    location:
      workshop.location?.trim() ||
      "",

    capacity:
      Number.isFinite(capacity)
        ? capacity
        : null,

    xpReward:
      Number.isFinite(xpReward) &&
      xpReward >= 0
        ? xpReward
        : 100,

    status:
      workshop.status ||
      "active",
  };
}

export async function GET(
  request
) {
  try {
    await requireActiveAdmin(
      request
    );

    const workshopSnapshot =
      await adminDb
        .collection(
          "workshops"
        )
        .orderBy("title")
        .get();

    const workshops =
      workshopSnapshot.docs.map(
        (
          workshopDocument
        ) => ({
          id:
            workshopDocument.id,

          ...workshopDocument.data(),
        })
      );

    return Response.json({
      success: true,
      workshops,
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
      "Get workshops error:",
      error
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

export async function POST(
  request
) {
  try {
    const admin =
      await requireActiveAdmin(
        request
      );

    const workshopData =
      await request.json();

    const validationError =
      validateWorkshop(
        workshopData
      );

    if (validationError) {
      return Response.json(
        {
          success: false,
          message:
            validationError,
        },
        {
          status: 400,
        }
      );
    }

    const workshopReference =
      await adminDb
        .collection(
          "workshops"
        )
        .add({
          ...buildWorkshopData(
            workshopData
          ),

          createdBy:
            admin.uid,

          createdAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        });

    return Response.json(
      {
        success: true,

        message:
          "Workshop created successfully.",

        workshopId:
          workshopReference.id,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    const accessResponse =
      adminAccessResponse(
        error
      );

    if (accessResponse) {
      return accessResponse;
    }

    console.error(
      "Create workshop error:",
      error
    );

    return Response.json(
      {
        success: false,

        message:
          "Workshop could not be created.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PUT(
  request
) {
  try {
    const admin =
      await requireActiveAdmin(
        request
      );

    const {
      id,
      ...workshopData
    } = await request.json();

    if (!id) {
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

    const validationError =
      validateWorkshop(
        workshopData
      );

    if (validationError) {
      return Response.json(
        {
          success: false,
          message:
            validationError,
        },
        {
          status: 400,
        }
      );
    }

    const reference =
      adminDb
        .collection(
          "workshops"
        )
        .doc(id);

    const snapshot =
      await reference.get();

    if (!snapshot.exists) {
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

    await reference.update({
      ...buildWorkshopData(
        workshopData
      ),

      updatedBy:
        admin.uid,

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    return Response.json({
      success: true,

      message:
        "Workshop updated successfully.",
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
      "Update workshop error:",
      error
    );

    return Response.json(
      {
        success: false,

        message:
          "Workshop could not be updated.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(
  request
) {
  try {
    await requireActiveAdmin(
      request
    );

    const {
      id,
    } = await request.json();

    if (!id) {
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

    const reference =
      adminDb
        .collection(
          "workshops"
        )
        .doc(id);

    const snapshot =
      await reference.get();

    if (!snapshot.exists) {
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

    await reference.delete();

    return Response.json({
      success: true,

      message:
        "Workshop deleted successfully.",
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
      "Delete workshop error:",
      error
    );

    return Response.json(
      {
        success: false,

        message:
          "Workshop could not be deleted.",
      },
      {
        status: 500,
      }
    );
  }
}