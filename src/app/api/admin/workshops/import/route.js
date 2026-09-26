import crypto from "crypto";

import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/services/firebaseAdmin";
import {
  adminAccessResponse,
  requireActiveAdmin,
} from "@/services/adminAccess";

export const runtime = "nodejs";

function createWorkshopId(title, programArea) {
  const normalizedText = `${programArea}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  const shortHash = crypto
    .createHash("sha256")
    .update(`${programArea}-${title}`)
    .digest("hex")
    .slice(0, 8);

  return `${normalizedText}-${shortHash}`;
}

function getCategory(title, programArea, description) {
  const combinedText =
    `${title} ${programArea} ${description}`.toLowerCase();

  if (
    combinedText.includes("coding") ||
    combinedText.includes("digital") ||
    combinedText.includes("robot") ||
    combinedText.includes("artificial intelligence") ||
    combinedText.includes("3d printing") ||
    combinedText.includes("cyber")
  ) {
    return "Technology";
  }

  if (
    combinedText.includes("welding") ||
    combinedText.includes("carpentry") ||
    combinedText.includes("construction") ||
    combinedText.includes("trades")
  ) {
    return "Trades";
  }

  if (
    combinedText.includes("business") ||
    combinedText.includes("leadership") ||
    combinedText.includes("investment")
  ) {
    return "Business & Leadership";
  }

  if (
    combinedText.includes("culinary") ||
    combinedText.includes("baking") ||
    combinedText.includes("hospitality")
  ) {
    return "Culinary & Hospitality";
  }

  if (
    combinedText.includes("design") ||
    combinedText.includes("creative") ||
    combinedText.includes("media")
  ) {
    return "Design & Creativity";
  }

  return "General";
}

export async function POST(request) {
  try {
    const admin =
      await requireActiveAdmin(request);

    const { workshops } =
      await request.json();

    if (!Array.isArray(workshops)) {
      return Response.json(
        {
          success: false,
          message: "Workshop data is invalid.",
        },
        {
          status: 400,
        }
      );
    }

    const validWorkshops = workshops.filter(
      (workshop) =>
        workshop.title &&
        workshop.programArea &&
        workshop.grade
    );

    if (validWorkshops.length === 0) {
      return Response.json(
        {
          success: false,
          message:
            "No valid workshops were found in the Excel file.",
        },
        {
          status: 400,
        }
      );
    }

    const batchSize = 400;
    let importedCount = 0;

    for (
      let startIndex = 0;
      startIndex < validWorkshops.length;
      startIndex += batchSize
    ) {
      const batch = adminDb.batch();

      const currentWorkshops =
        validWorkshops.slice(
          startIndex,
          startIndex + batchSize
        );

      currentWorkshops.forEach((workshop) => {
        const workshopId = createWorkshopId(
          workshop.title,
          workshop.programArea
        );

        const workshopReference = adminDb
          .collection("workshops")
          .doc(workshopId);

        const learningMode =
          workshop.programArea
            .toLowerCase()
            .includes("online")
            ? "online"
            : "in-person";

        batch.set(
          workshopReference,
          {
            title: workshop.title.trim(),

            programArea:
              workshop.programArea.trim(),

            category: getCategory(
              workshop.title,
              workshop.programArea,
              workshop.description || ""
            ),

            grade: workshop.grade.trim(),

            description:
              workshop.description?.trim() || "",

            informationUrl:
              workshop.informationUrl?.trim() || "",

            registrationUrl:
              "https://saitdigitalyouth.campbrainregistration.com/",

            learningMode,

            startDate: null,
            endDate: null,
            time: "",

            location:
              learningMode === "online"
                ? "Online"
                : "SAIT Campus",

            capacity: null,
            xpReward: 100,
            status: "active",

            importedFromExcel: true,
            importedBy: admin.uid,

            updatedAt:
              FieldValue.serverTimestamp(),

            createdAt:
              FieldValue.serverTimestamp(),
          },
          {
            merge: true,
          }
        );

        importedCount += 1;
      });

      await batch.commit();
    }

    return Response.json({
      success: true,
      message: `${importedCount} workshops imported successfully.`,
      importedCount,
    });
  } catch (error) {
    const accessResponse =
      adminAccessResponse(error);

    if (accessResponse) {
      return accessResponse;
    }

    console.error(
      "Excel import error:",
      error
    );

    return Response.json(
      {
        success: false,
        message:
          "The Excel file could not be imported.",
      },
      {
        status: 500,
      }
    );
  }
}