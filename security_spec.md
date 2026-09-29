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

---

## 5. Comprehensive Firestore Collection Security Matrix (SEC-P0 §9)

| # | Collection Path | Read Policy | Create Policy | Update Policy | Delete Policy | Tenant Isolation | SuperAdmin Scope |
|---|-----------------|-------------|---------------|---------------|---------------|------------------|------------------|
| 1 | `tenants/{tenantId}` | Authenticated tenant members or SuperAdmin | SuperAdmin only | SuperAdmin only | SuperAdmin only | `belongsToTenant(tenantId)` | Full Read/Write (`scope=GLOBAL`) |
| 2 | `users/{userId}` | Self, Tenant peers, or SuperAdmin | Self (restricted role) or SuperAdmin | Self (restricted keys) or SuperAdmin | SuperAdmin only | `belongsToTenant(res.tenantId)` | Full Read/Write (`scope=GLOBAL`) |
| 3 | `tenant_memberships/{id}` | Self, Tenant peers, or SuperAdmin | SuperAdmin only | SuperAdmin only | SuperAdmin only | `belongsToTenant(res.tenantId)` | Full Read/Write (`scope=GLOBAL`) |
| 4 | `roles/{roleId}` | Authenticated users | SuperAdmin only | SuperAdmin only | SuperAdmin only | Global registry | Full Read/Write (`scope=GLOBAL`) |
| 5 | `rbac_rules/{ruleId}` | Authenticated users | SuperAdmin only | SuperAdmin only | SuperAdmin only | Global registry | Full Read/Write (`scope=GLOBAL`) |
| 6 | `system_configs/{id}` | Tenant peers or SuperAdmin | Tenant Admin/Supervisor or SuperAdmin | Tenant Admin/Supervisor or SuperAdmin | SuperAdmin only | `isResourceTenantMatch()` | Full Read/Write (`scope=GLOBAL`) |
| 7 | `telemetry/{id}` | Tenant peers or SuperAdmin | Tenant devices/engineers | Tenant devices/engineers | SuperAdmin only | `isResourceTenantMatch()` | Full Read/Write (`scope=GLOBAL`) |
| 8 | `cane_batches/{id}` | Tenant peers or SuperAdmin | Tenant operator/supervisor | Tenant operator/supervisor | SuperAdmin only | `isResourceTenantMatch()` | Full Read/Write (`scope=GLOBAL`) |
| 9 | `work_orders/{id}` | Tenant peers or SuperAdmin | Tenant maintenance/supervisor | Tenant maintenance/supervisor | SuperAdmin only | `isResourceTenantMatch()` | Full Read/Write (`scope=GLOBAL`) |
| 10| `equipment/{id}` | Tenant peers or SuperAdmin | Tenant maintenance/admin | Tenant maintenance/admin | SuperAdmin only | `isResourceTenantMatch()` | Full Read/Write (`scope=GLOBAL`) |
| 11| `alarms/{id}` | Tenant peers or SuperAdmin | Tenant SCADA/supervisor | Tenant SCADA/supervisor | SuperAdmin only | `isResourceTenantMatch()` | Full Read/Write (`scope=GLOBAL`) |
| 12| `audit_logs/{id}` | Tenant peers or SuperAdmin | Authenticated (matching actor) | **FORBIDDEN (`if false`)** | **FORBIDDEN (`if false`)** | `isResourceTenantMatch()` | Global Read (`scope=GLOBAL`), Append-Only |
| 13| `historian_records/{id}` | Tenant peers or SuperAdmin | Tenant collectors/engineers | **FORBIDDEN (`if false`)** | **FORBIDDEN (`if false`)** | `isResourceTenantMatch()` | Global Read (`scope=GLOBAL`), Append-Only |
| 14| `plant_settings/{id}` | Tenant peers or SuperAdmin | Tenant Admin or SuperAdmin | Tenant Admin or SuperAdmin | SuperAdmin only | `isResourceTenantMatch()` | Full Read/Write (`scope=GLOBAL`) |
| 15| `ai_anomalies/{id}` | Tenant peers or SuperAdmin | Tenant engineers or SuperAdmin | Tenant engineers or SuperAdmin | SuperAdmin only | `isResourceTenantMatch()` | Full Read/Write (`scope=GLOBAL`) |
| 16| `agricultural_parameters/{id}`| Tenant peers or SuperAdmin | Tenant agronomists/admin | Tenant agronomists/admin | SuperAdmin or Tenant Admin | `isResourceTenantMatch()` | Full Read/Write (`scope=GLOBAL`) |
| 17| `agricultural_plots/{id}` | Tenant peers or SuperAdmin | Tenant agronomists/admin | Tenant agronomists/admin | SuperAdmin or Tenant Admin | `isResourceTenantMatch()` | Full Read/Write (`scope=GLOBAL`) |
| 18| `agricultural_campaigns/{id}` | Tenant peers or SuperAdmin | Tenant agronomists/admin | Tenant agronomists/admin | SuperAdmin or Tenant Admin | `isResourceTenantMatch()` | Full Read/Write (`scope=GLOBAL`) |
| 19| `agricultural_varieties/{id}` | Tenant peers or SuperAdmin | Tenant agronomists/admin | Tenant agronomists/admin | SuperAdmin or Tenant Admin | `isResourceTenantMatch()` | Full Read/Write (`scope=GLOBAL`) |
| 20| `agricultural_operations/{id}`| Tenant peers or SuperAdmin | Tenant agronomists/admin | Tenant agronomists/admin | SuperAdmin or Tenant Admin | `isResourceTenantMatch()` | Full Read/Write (`scope=GLOBAL`) |
| 21| `agricultural_equipment/{id}` | Tenant peers or SuperAdmin | Tenant agronomists/admin | Tenant agronomists/admin | SuperAdmin or Tenant Admin | `isResourceTenantMatch()` | Full Read/Write (`scope=GLOBAL`) |
| 22| `agricultural_inputs/{id}` | Tenant peers or SuperAdmin | Tenant agronomists/admin | Tenant agronomists/admin | SuperAdmin or Tenant Admin | `isResourceTenantMatch()` | Full Read/Write (`scope=GLOBAL`) |
| 23| `agricultural_scenarios/{id}` | Tenant peers or SuperAdmin | Tenant agronomists/admin | Tenant agronomists/admin | SuperAdmin or Tenant Admin | `isResourceTenantMatch()` | Full Read/Write (`scope=GLOBAL`) |
| 24| `agricultural_audit_trail/{id}`| Tenant peers or SuperAdmin | Tenant agronomists/admin | **FORBIDDEN (`if false`)** | **FORBIDDEN (`if false`)** | `isResourceTenantMatch()` | Global Read (`scope=GLOBAL`), Append-Only |
| * | Catch-All `/{document=**}` | **FORBIDDEN (`if false`)** | **FORBIDDEN (`if false`)** | **FORBIDDEN (`if false`)** | **FORBIDDEN (`if false`)** | Default Deny All Unmapped Paths | Default Deny All Unmapped Paths |
