import { TenantMembership, UserRole } from "../types";
import { getAdminFirestore } from "./firebaseAdmin";

// Authorized pre-seeded enterprise memberships mapped by UID / Email pattern
const INITIAL_MEMBERSHIPS: TenantMembership[] = [
  {
    id: "mem-superadmin-01",
    userId: "usr-superadmin-01",
    tenantId: "GLOBAL",
    role: "superadmin",
    permissions: [
      "ROOT_ACCESS",
      "MANAGE_TENANTS",
      "MANAGE_USERS",
      "VIEW_ALL_TENANTS",
      "MODIFY_SETPOINTS",
      "MODIFY_PLANT_PARAMS",
      "ACKNOWLEDGE_ALARM",
      "SHELVE_ALARM",
      "CLEAR_ALARM",
      "RESET_DATABASE",
      "EXPORT_HISTORIAN",
    ],
    securityLevel: 5,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00Z",
    assignedBy: "SYSTEM_INITIALIZER",
  },
  {
    id: "mem-admin-01",
    userId: "usr-admin-01",
    tenantId: "BIOAZUCAR-DEMO",
    role: "administrador",
    permissions: [
      "MANAGE_USERS",
      "MODIFY_SETPOINTS",
      "MODIFY_PLANT_PARAMS",
      "ACKNOWLEDGE_ALARM",
      "SHELVE_ALARM",
      "CLEAR_ALARM",
      "ADD_WORK_ORDER",
      "APPROVE_WORK_ORDER",
      "EXPORT_HISTORIAN",
      "VIEW_TELEMETRY",
    ],
    securityLevel: 4,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00Z",
    assignedBy: "SYSTEM_INITIALIZER",
  },
  {
    id: "mem-maint-01",
    userId: "usr-maint-01",
    tenantId: "BIOAZUCAR-DEMO",
    role: "mantenimiento",
    permissions: [
      "ADD_WORK_ORDER",
      "UPDATE_WORK_ORDER",
      "ACKNOWLEDGE_ALARM",
      "EXPORT_HISTORIAN",
      "VIEW_TELEMETRY",
    ],
    securityLevel: 3,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00Z",
    assignedBy: "usr-admin-01",
  },
  {
    id: "mem-op-01",
    userId: "usr-op-01",
    tenantId: "BIOAZUCAR-DEMO",
    role: "operador",
    permissions: [
      "ACKNOWLEDGE_ALARM",
      "ADD_CANE_BATCH",
      "VIEW_TELEMETRY",
    ],
    securityLevel: 2,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00Z",
    assignedBy: "usr-admin-01",
  },
  {
    id: "mem-obs-01",
    userId: "usr-obs-01",
    tenantId: "BIOAZUCAR-DEMO",
    role: "observador",
    permissions: [
      "VIEW_TELEMETRY",
      "VIEW_DOCS",
    ],
    securityLevel: 1,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00Z",
    assignedBy: "usr-admin-01",
  },
];

// In-memory membership cache with synchronization to Firestore
const membershipCache = new Map<string, TenantMembership>();
INITIAL_MEMBERSHIPS.forEach((m) => {
  membershipCache.set(m.userId, m);
});

export class MembershipService {
  /**
   * Resolves effective tenant membership strictly from verified identity (UID / Email).
   * Does NOT trust any client-supplied role or tenantId.
   */
  public static async getEffectiveMembership(
    uid: string,
    email?: string
  ): Promise<TenantMembership | null> {
    if (!uid) return null;

    // 0. Environment-configured Superadmin check (IEC 62443 Root)
    const configuredSuperAdminEmail = (
      process.env.SUPERADMIN_EMAIL ||
      process.env.VITE_SUPERADMIN_EMAIL ||
      "ing.dernys@gmail.com"
    ).toLowerCase().trim();
    if (email && email.toLowerCase().trim() === configuredSuperAdminEmail) {
      return {
        id: "mem-superadmin-env",
        userId: uid,
        tenantId: "GLOBAL",
        role: "superadmin",
        permissions: [
          "ROOT_ACCESS",
          "MANAGE_TENANTS",
          "MANAGE_USERS",
          "VIEW_ALL_TENANTS",
          "MODIFY_SETPOINTS",
          "MODIFY_PLANT_PARAMS",
          "ACKNOWLEDGE_ALARM",
          "SHELVE_ALARM",
          "CLEAR_ALARM",
          "RESET_DATABASE",
          "EXPORT_HISTORIAN",
        ],
        securityLevel: 5,
        status: "ACTIVE",
        createdAt: "2026-01-01T00:00:00Z",
        assignedBy: "ENV_VARIABLE_ROOT",
      };
    }

    // 1. Check local authorized cache
    const cached = membershipCache.get(uid);
    if (cached) {
      if (cached.status && cached.status !== "ACTIVE") {
        return null; // Disabled membership fail-closed
      }
      return { ...cached };
    }

    // 2. Check if email maps to standard authorized pre-seeded enterprise identity
    if (email) {
      const normalized = email.toLowerCase().trim();
      const isPreseededDomain =
        normalized.endsWith("@bioazucar.com") ||
        normalized.endsWith("@ingenio-a.com") ||
        normalized.endsWith("@ingenio-b.com");

      if (isPreseededDomain) {
        for (const m of membershipCache.values()) {
          const expectedRoleEmail = `${m.role}@bioazucar.com`;
          const expectedUserEmail = `${m.userId}@bioazucar.com`;
          if (normalized === expectedRoleEmail || normalized === expectedUserEmail || normalized.includes(m.userId)) {
            if (m.status && m.status !== "ACTIVE") return null;
            return { ...m, userId: uid };
          }
        }
      }
    }

    // 3. Query Firestore using privileged Admin SDK
    try {
      const firestore = getAdminFirestore();
      const snapshot = await firestore
        .collection("tenant_memberships")
        .where("userId", "==", uid)
        .where("status", "==", "ACTIVE")
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data() as TenantMembership;
        const membership: TenantMembership = {
          ...data,
          id: doc.id,
        };
        membershipCache.set(uid, membership);
        return membership;
      }
    } catch {
      // In offline/test environments without live Firestore, fallback is restricted to cached records
    }

    return null;
  }

  /**
   * Synchronous lookup for fast middleware checks
   */
  public static getEffectiveMembershipSync(
    uid: string,
    email?: string
  ): TenantMembership | null {
    if (!uid) return null;

    if (membershipCache.has(uid)) {
      return { ...membershipCache.get(uid)! };
    }

    const configuredSuperAdminEmail = (
      process.env.SUPERADMIN_EMAIL ||
      process.env.VITE_SUPERADMIN_EMAIL ||
      "ing.dernys@gmail.com"
    ).toLowerCase().trim();
    if (email && email.toLowerCase().trim() === configuredSuperAdminEmail) {
      return {
        id: "mem-superadmin-env",
        userId: uid,
        tenantId: "GLOBAL",
        role: "superadmin",
        permissions: [
          "ROOT_ACCESS",
          "MANAGE_TENANTS",
          "MANAGE_USERS",
          "VIEW_ALL_TENANTS",
          "MODIFY_SETPOINTS",
          "MODIFY_PLANT_PARAMS",
          "ACKNOWLEDGE_ALARM",
          "SHELVE_ALARM",
          "CLEAR_ALARM",
          "RESET_DATABASE",
          "EXPORT_HISTORIAN",
        ],
        securityLevel: 5,
        status: "ACTIVE",
        createdAt: "2026-01-01T00:00:00Z",
        assignedBy: "ENV_VARIABLE_ROOT",
      };
    }

    if (email) {
      const normalized = email.toLowerCase().trim();
      const isPreseededDomain =
        normalized.endsWith("@bioazucar.com") ||
        normalized.endsWith("@ingenio-a.com") ||
        normalized.endsWith("@ingenio-b.com");

      if (isPreseededDomain) {
        for (const m of membershipCache.values()) {
          const expectedRoleEmail = `${m.role}@bioazucar.com`;
          const expectedUserEmail = `${m.userId}@bioazucar.com`;
          if (normalized === expectedRoleEmail || normalized === expectedUserEmail || normalized.includes(m.userId)) {
            if (m.status && m.status !== "ACTIVE") return null;
            return { ...m, userId: uid };
          }
        }
      }
    }

    return null;
  }

  /**
   * Registers or updates an authorized membership
   */
  public static async registerMembership(
    membership: TenantMembership
  ): Promise<void> {
    membershipCache.set(membership.userId, membership);

    try {
      const firestore = getAdminFirestore();
      await firestore
        .collection("tenant_memberships")
        .doc(membership.id)
        .set(membership, { merge: true });
    } catch {
      // Offline fallback
    }
  }

  public static getAllCachedMemberships(): TenantMembership[] {
    return Array.from(membershipCache.values());
  }

  public static getMembershipsByTenant(tenantId: string): TenantMembership[] {
    if (tenantId === "GLOBAL") {
      return Array.from(membershipCache.values());
    }
    return Array.from(membershipCache.values()).filter((m) => m.tenantId === tenantId);
  }

  public static invalidateMembership(userId: string): void {
    membershipCache.delete(userId);
  }

  public static disableMembership(userId: string): void {
    const existing = membershipCache.get(userId);
    if (existing) {
      existing.status = "DISABLED" as any;
      membershipCache.set(userId, existing);
    }
  }

  public static updateMembershipRole(userId: string, newRole: UserRole, permissions?: string[]): boolean {
    const existing = membershipCache.get(userId);
    if (existing) {
      existing.role = newRole;
      if (permissions) {
        existing.permissions = permissions;
      }
      existing.securityLevel =
        newRole === "superadmin" ? 5 : newRole === "administrador" ? 4 : newRole === "supervisor" ? 3 : 2;
      membershipCache.set(userId, existing);
      return true;
    }
    return false;
  }

  public static updateMembershipStatus(userId: string, status: "ACTIVE" | "SUSPENDED" | "INVITED" | "DISABLED"): boolean {
    const existing = membershipCache.get(userId);
    if (existing) {
      existing.status = status as any;
      membershipCache.set(userId, existing);
      return true;
    }
    return false;
  }

  public static deleteMembership(userId: string): boolean {
    return membershipCache.delete(userId);
  }
}
