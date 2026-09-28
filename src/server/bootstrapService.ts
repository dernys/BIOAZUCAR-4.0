import {
  getAdminFirestore,
  verifyAdminSdkAvailability,
  getAdminSdkStatus,
  AdminSdkStatus,
  AdminSdkMissingError,
} from "./firebaseAdmin";
import { INITIAL_TENANTS } from "../services/dbService";
import { PREDEFINED_USERS, INITIAL_SYSTEM_CONFIGS } from "../services/authService";
import { DEFAULT_ROLES } from "../services/rbacService";
import {
  initialTelemetry,
  INITIAL_EQUIPMENT,
  INITIAL_BATCHES,
  INITIAL_WORK_ORDERS,
  INITIAL_ALARMS,
  INITIAL_AUDIT_LOGS,
} from "../data/mockIndustrialData";
import { MembershipService } from "./membershipService";

export interface BootstrapResult {
  success: boolean;
  status: AdminSdkStatus;
  message: string;
}

export async function bootstrapDatabaseWithAdminSdk(): Promise<BootstrapResult> {
  const isProduction =
    process.env.INDUSTRIAL_RUNTIME_PROFILE === "PRODUCTION" ||
    process.env.NODE_ENV === "production";

  // Step 1: Explicit Admin SDK credential verification
  const adminStatus = await verifyAdminSdkAvailability();

  if (adminStatus === "ADMIN_SDK_MISSING") {
    if (isProduction) {
      console.error(
        "❌ [SERVER BOOTSTRAP] PRODUCTION FAIL-CLOSED: Server-side Admin SDK credentials not provisioned in container (ADMIN_SDK_MISSING). Privileged database bootstrap aborted."
      );
      return {
        success: false,
        status: "ADMIN_SDK_MISSING",
        message: "Server-side Admin SDK credentials not provisioned in container; production fail-closed enforced.",
      };
    } else {
      console.info(
        "ℹ️ [SERVER BOOTSTRAP] Server-side Admin SDK credentials not provisioned in container; utilizing client-side authenticated Firestore persistence."
      );
      return {
        success: false,
        status: "ADMIN_SDK_MISSING",
        message: "Server-side Admin SDK credentials not provisioned in container; utilizing client-side authenticated Firestore persistence in sandbox.",
      };
    }
  }

  try {
    const timeoutPromise = new Promise<BootstrapResult>((_, reject) =>
      setTimeout(() => reject(new Error("Admin SDK bootstrap check timed out")), 3500)
    );

    const runBootstrap = async (): Promise<BootstrapResult> => {
      const firestore = getAdminFirestore();

      // Check if tenants exist
      const tenantsSnap = await firestore.collection("tenants").limit(1).get();
      if (!tenantsSnap.empty) {
        return { success: true, status: "ADMIN_SDK_READY", message: "Database already initialized." };
      }

      console.log("⚡ [SERVER BOOTSTRAP] Privileged Admin SDK initialization starting...");

      const batch = firestore.batch();

    // 1. Initial Tenants
    INITIAL_TENANTS.forEach((t) => {
      const docRef = firestore.collection("tenants").doc(t.id);
      batch.set(docRef, t);
    });

    // 2. Initial Users
    PREDEFINED_USERS.forEach((u) => {
      const docRef = firestore.collection("users").doc(u.id);
      batch.set(docRef, {
        ...u,
        tenantId: u.isSuperAdmin ? "GLOBAL" : "BIOAZUCAR-DEMO",
        isActive: true,
      });
    });

    // 3. Initial Roles
    DEFAULT_ROLES.forEach((r) => {
      const roleId = r.id || `role-${r.role}`;
      const docRef = firestore.collection("roles").doc(roleId);
      batch.set(docRef, {
        ...r,
        id: roleId,
        tenantId: "GLOBAL",
        isSystem: true,
      });
    });

    // 4. Initial System Configs
    INITIAL_SYSTEM_CONFIGS.forEach((c) => {
      const docRef = firestore.collection("system_configs").doc(c.id);
      batch.set(docRef, {
        ...c,
        tenantId: "GLOBAL",
      });
    });

    // 5. Initial Tenant Memberships (SEC-4)
    MembershipService.getAllCachedMemberships().forEach((m) => {
      const docRef = firestore.collection("tenant_memberships").doc(m.id);
      batch.set(docRef, m);
    });

    // 6. Initial Telemetry Snapshots
    INITIAL_TENANTS.forEach((t) => {
      const docRef = firestore.collection("telemetry").doc(`snapshot_${t.id}`);
      const factor = (t.nominalTch || 450) / 450;
      batch.set(docRef, {
        ...initialTelemetry,
        tenantId: t.id,
        tch: Number((initialTelemetry.tch * factor).toFixed(1)),
        powerGeneratedMW: Number((initialTelemetry.powerGeneratedMW * factor).toFixed(1)),
        powerExportGridMW: Number((initialTelemetry.powerExportGridMW * factor).toFixed(1)),
        boilerPressureHP: t.boilerPressureBar,
        lastUpdated: new Date().toISOString(),
      });
    });

    // 7. Initial Equipment
    INITIAL_EQUIPMENT.forEach((eq) => {
      const docRef = firestore.collection("equipment").doc(eq.id);
      batch.set(docRef, {
        ...eq,
        tenantId: "tenant-bioazucar-01",
      });
    });

    // 8. Initial Alarms
    INITIAL_ALARMS.forEach((al) => {
      const docRef = firestore.collection("alarms").doc(al.id);
      batch.set(docRef, {
        ...al,
        tenantId: "tenant-bioazucar-01",
      });
    });

    // 9. Initial Batches
    INITIAL_BATCHES.forEach((b) => {
      const docRef = firestore.collection("cane_batches").doc(b.id);
      batch.set(docRef, {
        ...b,
        tenantId: "tenant-bioazucar-01",
      });
    });

    // 10. Initial Work Orders
    INITIAL_WORK_ORDERS.forEach((wo) => {
      const docRef = firestore.collection("work_orders").doc(wo.id);
      batch.set(docRef, {
        ...wo,
        tenantId: "tenant-bioazucar-01",
      });
    });

    // 11. Initial Audit Logs
    INITIAL_AUDIT_LOGS.forEach((aud) => {
      const docRef = firestore.collection("audit_logs").doc(aud.id);
      batch.set(docRef, {
        ...aud,
        tenantId: "tenant-bioazucar-01",
      });
    });

      await batch.commit();
      console.log("✅ [SERVER BOOTSTRAP] Privileged Firestore seed completed successfully.");
      return { success: true, status: "ADMIN_SDK_READY", message: "Bootstrap completed successfully." };
    };

    return await Promise.race([runBootstrap(), timeoutPromise]);
  } catch (err: any) {
    if (err?.message?.includes("PERMISSION_DENIED") || err?.code === 7) {
      console.info("ℹ️ [SERVER BOOTSTRAP] Server-side Admin SDK credentials not provisioned in container; utilizing client-side authenticated Firestore persistence.");
    } else {
      console.warn("⚠️ [SERVER BOOTSTRAP] Skipped or offline:", err?.message || err);
    }
    return { success: false, status: "ADMIN_SDK_MISSING", message: err?.message || String(err) };
  }
}
