# BioAzúcar 4.0 - Agricultural PDA Security & Access Control Specification (ABAC)

## 1. Context & Architecture (IEC 62443 / ISA-95 Security Standard)
This document outlines the Attribute-Based Access Control (ABAC) and Tenant-Isolation security architecture for the Agricultural Operational Decision Support (PDA) module within BioAzúcar 4.0.

The Firestore database enforces Zero-Trust authentication and tenancy boundaries across all industrial and agricultural entities:
- Multi-Tenant Isolation: Every resource contains a valid `tenantId`.
- SuperAdmin Override: Users with `isSuperAdmin == true` or `tenantId == "GLOBAL"` possess enterprise-wide read and configuration capabilities.
- Agricultural Domain Isolation: All 9 PDA entities require authenticated, tenant-verified sessions for read, create, update, and delete.
- ISA-95 Audit Trail Immutability: Audit log collections (`audit_logs`, `agricultural_audit_trail`) are strictly **append-only** (`allow update, delete: if false;`).

---

## 2. Invariant Specifications (The 8 Pillars)

1. **Master Gate & Tenancy Sync**:
   Every agricultural document write requires `isNewResourceTenantMatch()`. A tenant user cannot insert or mutate records belonging to another sugar mill or tenant organization.

2. **Validation Blueprints (Anti-Update-Gap)**:
   Document IDs cannot be orphaned across tenant partitions. State updates must retain original `tenantId` and required operational keys (`code`, `varietyCode`, `projectedTotalCaneTons`, etc.).

3. **Role-Based Clearance Boundaries**:
   - `superadmin`: Full system management and multi-tenant audit access.
   - `admin`: Plant and agricultural governance, campaign baseline approvals, scenario commits.
   - `agronomo`: Parcel planning, variety master updates, soil prep and harvesting logistics.
   - `operador`: Field telemetry monitoring, daily reception dispatch.
   - `auditor`: Read-only access to historical archives and parameter calibration traces.

4. **Immutable Audit Trail**:
   Audit entries (`agricultural_audit_trail`) record timestamp, actor, entity ID, and changed delta. Any attempt to update or delete audit records is rejected by security rules.

---

## 3. The "Dirty Dozen" Attack Vectors & Defense Matrix

| # | Attack Vector Description | Targeted Path | Rule Defense Mechanism | Result |
|---|---------------------------|---------------|------------------------|--------|
| 1 | Unauthenticated Read | `/agricultural_parameters/{id}` | `isAuthenticated()` check | DENIED (403) |
| 2 | Unauthenticated Write | `/agricultural_plots/{id}` | `isAuthenticated()` check | DENIED (403) |
| 3 | Cross-Tenant Plot Hijack | `/agricultural_plots/{id}` | `isNewResourceTenantMatch()` ensures `res.tenantId == token.tenantId` | DENIED (403) |
| 4 | Audit Trail Deletion Attempt | `/agricultural_audit_trail/{id}` | `allow delete: if false;` | DENIED (403) |
| 5 | Audit Trail Modification Attempt | `/agricultural_audit_trail/{id}` | `allow update: if false;` | DENIED (403) |
| 6 | Non-Admin Schema Parameter Reset | `/agricultural_parameters/{id}` | Role verification & tenant match | DENIED (403) |
| 7 | Campaign Target Tampering without Tenancy | `/agricultural_campaigns/{id}` | `isNewResourceTenantMatch()` | DENIED (403) |
| 8 | Arbitrary User Role Self-Elevation | `/users/{id}` | `isSuperAdmin()` required for role modifications | DENIED (403) |
| 9 | Direct Tenant Injection | `/tenants/{id}` | Write restricted to SuperAdmin | DENIED (403) |
| 10| System Config Override | `/system_configs/{id}` | Restricted to SuperAdmin / authorized Admins | DENIED (403) |
| 11| Variety Deletion by Non-Admin | `/agricultural_varieties/{id}` | Admin or SuperAdmin check | DENIED (403) |
| 12| Negative Harvest Yield Injection | `/agricultural_plots/{id}` | Data validation & UI schema constraints | DENIED (Validation) |

---

## 4. Client-Side Resilience & Offline Fallback Strategy
When running offline or during disconnected field conditions:
1. `AgriculturalPersistenceService` maintains a verified local cache with optimistic UI updates.
2. Read operations seamlessly pull from local cached state when unauthenticated or disconnected, preventing application crashes.
3. Once valid authentication is established, real-time Firestore listeners synchronize master data without UI interruption.
