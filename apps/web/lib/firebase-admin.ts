import { cert, getApps, getApp, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

// Lazy initialization — avoids running at build time when env vars aren't present
function getAdminApp() {
  if (getApps().length) return getApp();
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
