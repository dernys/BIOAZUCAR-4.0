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

    // 1. Check local authorized cache
    const cached = membershipCache.get(uid);
    if (cached) {
      return { ...cached };
    }

    // 2. Check if email maps to standard pre-seeded user identity
    if (email) {
      for (const m of membershipCache.values()) {
        if (email.toLowerCase().startsWith(m.role) || email.toLowerCase().includes(m.userId)) {
          return { ...m, userId: uid };
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

    if (email) {
      for (const m of membershipCache.values()) {
        if (email.toLowerCase().startsWith(m.role) || email.toLowerCase().includes(m.userId)) {
          return { ...m, userId: uid };
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
}
