import { initializeApp, getApps, getApp, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

let adminApp: App | null = null;

export function getFirebaseAdminApp(): App {
  if (!adminApp) {
    const existing = getApps();
    if (existing.length > 0) {
      adminApp = existing[0];
    } else {
      const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
      adminApp = initializeApp({
        projectId,
      });
    }
  }
  return adminApp;
}

export function getAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminFirestore(): Firestore {
  const databaseId =
    process.env.FIRESTORE_DATABASE_ID ||
    (firebaseConfig as any).firestoreDatabaseId ||
    "(default)";
  return getFirestore(getFirebaseAdminApp(), databaseId);
}
