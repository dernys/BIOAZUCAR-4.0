/**
 * BioAzúcar 4.0 — Server-Side Admin SDK Explicit State Machine & Governance
 * 
 * IEC 62443-4-2 SL3 / ISA-95 Compliance Mandate:
 * 1. Establishes explicit state tracking: ADMIN_SDK_READY vs ADMIN_SDK_MISSING.
 * 2. In PRODUCTION profile (INDUSTRIAL_RUNTIME_PROFILE === 'PRODUCTION' or NODE_ENV === 'production'):
 *    Administrative and server-authoritative operations MUST FAIL-CLOSED if Admin SDK credentials
 *    are not provisioned in the container. Silent degradation to client persistence is strictly forbidden.
 * 3. In development/sandbox environments, explicitly flags ADMIN_SDK_MISSING while logging that
 *    client-authenticated persistence is utilized as an operational fallback.
 */

import { getAdminFirestore } from "./firebaseAdmin";

export type AdminSdkStatus = "ADMIN_SDK_READY" | "ADMIN_SDK_MISSING";

export interface AdminSdkDiagnostics {
  status: AdminSdkStatus;
  isProduction: boolean;
  checkedAt: string;
  error: string | null;
  operationalMode: "SERVER_AUTHORITATIVE_ENFORCED" | "FAIL_CLOSED_ACTIVE" | "SANDBOX_CLIENT_PERSISTENCE";
}

let currentAdminSdkStatus: AdminSdkStatus = "ADMIN_SDK_MISSING";
let lastCheckError: string | null = null;
let lastCheckedAt: string = new Date().toISOString();
let checkInProgress: Promise<AdminSdkStatus> | null = null;

/**
 * Custom Error for Production Fail-Closed Enforcements
 */
export class AdminSdkMissingError extends Error {
  public readonly code = "ADMIN_SDK_MISSING_ERROR";
  public readonly statusCode = 503;

  constructor(operation: string, details?: string) {
    super(
      `[FAIL-CLOSED] Administrative operation '${operation}' aborted: Server-side Admin SDK credentials not provisioned (ADMIN_SDK_MISSING). In PRODUCTION mode, silent degradation to client persistence is strictly prohibited under IEC 62443 SL3 server-authoritative mandates. ${details || ""}`.trim()
    );
    this.name = "AdminSdkMissingError";
  }
}

/**
 * Returns the current cached Admin SDK status synchronously.
 */
export function getAdminSdkStatus(): AdminSdkStatus {
  return currentAdminSdkStatus;
}

/**
 * Returns detailed diagnostics on the Admin SDK state.
 */
export function getAdminSdkDiagnostics(): AdminSdkDiagnostics {
  const isProduction =
    process.env.INDUSTRIAL_RUNTIME_PROFILE === "PRODUCTION" ||
    process.env.NODE_ENV === "production";

  let operationalMode: AdminSdkDiagnostics["operationalMode"];
  if (currentAdminSdkStatus === "ADMIN_SDK_READY") {
    operationalMode = "SERVER_AUTHORITATIVE_ENFORCED";
  } else if (isProduction) {
    operationalMode = "FAIL_CLOSED_ACTIVE";
  } else {
    operationalMode = "SANDBOX_CLIENT_PERSISTENCE";
  }

  return {
    status: currentAdminSdkStatus,
    isProduction,
    checkedAt: lastCheckedAt,
    error: lastCheckError,
    operationalMode,
  };
}

/**
 * Verifies live connectivity with Firestore using privileged Admin SDK credentials.
 * Updates currentAdminSdkStatus atomically.
 */
export async function verifyAdminSdkAvailability(): Promise<AdminSdkStatus> {
  if (checkInProgress) {
    return checkInProgress;
  }

  checkInProgress = (async (): Promise<AdminSdkStatus> => {
    try {
      const db = getAdminFirestore();
      // Lightweight read check with a strict 3000ms timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Admin SDK credential verification timeout (3000ms)")), 3000)
      );

      await Promise.race([
        db.collection("tenants").limit(1).get(),
        timeoutPromise,
      ]);

      currentAdminSdkStatus = "ADMIN_SDK_READY";
      lastCheckError = null;
      lastCheckedAt = new Date().toISOString();
      return "ADMIN_SDK_READY";
    } catch (err: any) {
      currentAdminSdkStatus = "ADMIN_SDK_MISSING";
      lastCheckError = err?.message || String(err);
      lastCheckedAt = new Date().toISOString();
      return "ADMIN_SDK_MISSING";
    } finally {
      checkInProgress = null;
    }
  })();

  return checkInProgress;
}

/**
 * Manual override for testing purposes only
 */
export function setAdminSdkStatusForTesting(status: AdminSdkStatus, error: string | null = null): void {
  currentAdminSdkStatus = status;
  lastCheckError = error;
  lastCheckedAt = new Date().toISOString();
}

/**
 * Assert that the Admin SDK is ready before executing a privileged server-authoritative operation.
 * In PRODUCTION: Throws AdminSdkMissingError (FAIL-CLOSED).
 * In DEV/SANDBOX: Logs a warning and returns false, permitting non-destructive fallback if applicable.
 */
export function assertAdminSdkReady(operation: string): void {
  const isProduction =
    process.env.INDUSTRIAL_RUNTIME_PROFILE === "PRODUCTION" ||
    process.env.NODE_ENV === "production";

  if (currentAdminSdkStatus !== "ADMIN_SDK_READY") {
    if (isProduction) {
      throw new AdminSdkMissingError(operation, lastCheckError || undefined);
    } else {
      console.warn(
        `⚠️ [ADMIN_SDK] Non-production notice: Operation '${operation}' running under ADMIN_SDK_MISSING. Sandbox client persistence active.`
      );
    }
  }
}
