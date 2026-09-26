import {
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";

import {
  getAuth,
} from "firebase-admin/auth";

import {
  getFirestore,
} from "firebase-admin/firestore";

import {
  getAppCheck,
} from "firebase-admin/app-check";

function getFirebaseAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId =
    process.env
      .FIREBASE_ADMIN_PROJECT_ID;

  const clientEmail =
    process.env
      .FIREBASE_ADMIN_CLIENT_EMAIL;

  const privateKey =
    process.env
      .FIREBASE_ADMIN_PRIVATE_KEY
      ?.replace(
        /\\n/g,
        "\n"
      );

  if (
    !projectId ||
    !clientEmail ||
    !privateKey
  ) {
    throw new Error(
      "Firebase Admin environment variables are missing."
    );
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const firebaseAdminApp =
  getFirebaseAdminApp();

const adminDb =
  getFirestore(
    firebaseAdminApp
  );

const adminAuth =
  getAuth(
    firebaseAdminApp
  );

const adminAppCheck =
  getAppCheck(
    firebaseAdminApp
  );

export {
  adminAppCheck,
  adminAuth,
  adminDb,
};