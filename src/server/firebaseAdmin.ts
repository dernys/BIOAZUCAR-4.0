import { initializeApp, getApps, App, cert } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import firebaseConfig from "../../firebase-applet-config.json";

export type {
  AdminSdkStatus,
  AdminSdkDiagnostics,
} from "./adminSdkStatus";
export {
  AdminSdkMissingError,
  getAdminSdkStatus,
  getAdminSdkDiagnostics,
  verifyAdminSdkAvailability,
  assertAdminSdkReady,
} from "./adminSdkStatus";

let adminApp: App | null = null;

/**
 * Loads service account credentials securely from:
 * 1. FIREBASE_SERVICE_ACCOUNT (raw JSON string or base64)
 * 2. GOOGLE_APPLICATION_CREDENTIALS (file path)
 * 3. Dedicated server credentials file: src/server/credentials/serviceAccountKey.json
 */
function loadServiceAccountCredentials(): any | null {
  // Option 1: Inline JSON or Base64 in environment
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      const jsonStr = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf-8");
      return JSON.parse(jsonStr);
    } catch (e: any) {
      console.warn("⚠️ [FIREBASE ADMIN] Could not parse FIREBASE_SERVICE_ACCOUNT environment variable:", e.message);
    }
  }

  // Option 2: File path via GOOGLE_APPLICATION_CREDENTIALS
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    try {
      const fileData = fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf-8");
      return JSON.parse(fileData);
    } catch (e: any) {
      console.warn("⚠️ [FIREBASE ADMIN] Could not read GOOGLE_APPLICATION_CREDENTIALS file:", e.message);
    }
  }

  // Option 3: Standard project credentials path in src/server/credentials/serviceAccountKey.json
  const defaultCredsPath = path.resolve(process.cwd(), "src/server/credentials/serviceAccountKey.json");
  if (fs.existsSync(defaultCredsPath)) {
    try {
      const fileData = fs.readFileSync(defaultCredsPath, "utf-8");
      return JSON.parse(fileData);
    } catch (e: any) {
      console.warn("⚠️ [FIREBASE ADMIN] Could not read default serviceAccountKey.json file:", e.message);
    }
  }

  return null;
}

export function getFirebaseAdminApp(): App {
  if (!adminApp) {
    const existing = getApps();
    if (existing.length > 0) {
      adminApp = existing[0];
    } else {
      const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
      const serviceAccount = loadServiceAccountCredentials();

      if (serviceAccount && serviceAccount.private_key && serviceAccount.client_email) {
        adminApp = initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id || projectId,
        });
        console.log("🔐 [FIREBASE ADMIN] Initialized with Service Account credentials for project:", serviceAccount.project_id || projectId);
      } else {
        adminApp = initializeApp({
          projectId,
        });
        console.log("ℹ️ [FIREBASE ADMIN] Initialized with project ID (ADC / Sandbox mode):", projectId);
      }
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
