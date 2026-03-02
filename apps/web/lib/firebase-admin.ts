import { applicationDefault, getApps, getApp, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

// Lazy initialization — avoids running at build time when env vars aren't present
// Uses Application Default Credentials (works automatically on Cloud Run)
function getAdminApp() {
  if (getApps().length) return getApp();
  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
