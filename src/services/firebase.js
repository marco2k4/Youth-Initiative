import {
  getApp,
  getApps,
  initializeApp,
} from "firebase/app";

import {
  getAuth,
} from "firebase/auth";

import {
  getFirestore,
} from "firebase/firestore";

import {
  getAppCheck,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";

const firebaseConfig = {
  apiKey:
    process.env
      .NEXT_PUBLIC_FIREBASE_API_KEY,

  authDomain:
    process.env
      .NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,

  projectId:
    process.env
      .NEXT_PUBLIC_FIREBASE_PROJECT_ID,

  storageBucket:
    process.env
      .NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,

  messagingSenderId:
    process.env
      .NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,

  appId:
    process.env
      .NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app =
  getApps().length > 0
    ? getApp()
    : initializeApp(
        firebaseConfig
      );

const auth =
  getAuth(app);

const db =
  getFirestore(app);

let appCheck = null;

if (
  typeof window !==
  "undefined"
) {
  const siteKey =
    process.env
      .NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY;

  if (siteKey) {
    /*
      Local development uses Firebase's
      App Check debug provider.

      Never enable debug mode in production.
    */

    if (
      process.env.NODE_ENV ===
      "development"
    ) {
      self.FIREBASE_APPCHECK_DEBUG_TOKEN =
        true;
    }

    try {
      appCheck =
        getAppCheck(app);
    } catch {
      appCheck =
        initializeAppCheck(
          app,
          {
            provider:
              new ReCaptchaEnterpriseProvider(
                siteKey
              ),

            isTokenAutoRefreshEnabled:
              true,
          }
        );
    }
  }
}

export {
  app,
  appCheck,
  auth,
  db,
};