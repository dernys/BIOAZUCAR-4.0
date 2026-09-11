import { getAdminFirestore } from "./firebaseAdmin";
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

export async function bootstrapDatabaseWithAdminSdk(): Promise<{ success: boolean; message: string }> {
  try {
    const timeoutPromise = new Promise<{ success: boolean; message: string }>((_, reject) =>
      setTimeout(() => reject(new Error("Admin SDK bootstrap check timed out")), 3500)
    );

    const runBootstrap = async (): Promise<{ success: boolean; message: string }> => {
      const firestore = getAdminFirestore();

      // Check if tenants exist
      const tenantsSnap = await firestore.collection("tenants").limit(1).get();
      if (!tenantsSnap.empty) {
        return { success: true, message: "Database already initialized." };
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
      return { success: true, message: "Bootstrap completed successfully." };
    };

    return await Promise.race([runBootstrap(), timeoutPromise]);
  } catch (err: any) {
    console.warn("⚠️ [SERVER BOOTSTRAP] Skipped or offline:", err.message);
    return { success: false, message: err.message };
  }
}
