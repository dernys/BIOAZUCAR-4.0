import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore, getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import firebaseConfigJson from "../../firebase-applet-config.json";

export const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
  measurementId: firebaseConfigJson.measurementId,
};

// Initialize Firebase App instance safely (singleton pattern)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);

// Initialize Firestore with specific provisioned database ID
// Uses experimentalForceLongPolling to eliminate 10s backend connection timeouts in preview/proxy environments
const firestoreDbId = firebaseConfigJson.firestoreDatabaseId || "(default)";

function initFirestore(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
        ignoreUndefinedProperties: true,
      },
      firestoreDbId
    );
  } catch (_err) {
    return getFirestore(app, firestoreDbId);
  }
}

export const db: Firestore = initFirestore();
