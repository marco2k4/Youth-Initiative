import {
  adminAccessResponse,
  requireActiveAdmin,
} from "@/services/adminAccess";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const admin =
      await requireActiveAdmin(
        request
      );

    return Response.json({
      success: true,

      admin: {
        uid: admin.uid,

        email:
          admin.email,

        firstName:
          admin.adminData
            .firstName ||
          "",

        lastName:
          admin.adminData
            .lastName ||
          "",

        role:
          admin.adminData.role,

        status:
          admin.adminData.status,
      },
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
      "Admin verification error:",
      error?.message
    );

    return Response.json(
      {
        success: false,

        message:
          "Administrator authentication could not be verified.",
      },
      {
        status: 500,
      }
    );
  }
}