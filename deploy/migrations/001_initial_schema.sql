-- ==============================================================================
-- BIOAZÚCAR 4.0 — MIGRATION 001: INITIAL INDUSTRIAL SCHEMA
-- ==============================================================================
-- Version: 001
-- Name: initial_schema
-- Rollback-Supported: true

-- 1. Schema Migrations Ledger
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL,
    rollback_supported INTEGER NOT NULL DEFAULT 1,
    down_sql TEXT
);

-- 2. Multi-Tenant Enterprise Model
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    site_id TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    metadata_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 3. Industrial Connections (ISA-95 Level 2/3 Interfaces)
CREATE TABLE IF NOT EXISTS industrial_connections (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    site_id TEXT NOT NULL,
    name TEXT NOT NULL,
    protocol TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DISCONNECTED',
    operational_mode TEXT NOT NULL DEFAULT 'LIVE_OT',
    config_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 4. Canonical Tag Registry (32-Field Specification)
CREATE TABLE IF NOT EXISTS industrial_tags (
    id TEXT PRIMARY KEY,
    tag TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    connection_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    unit TEXT NOT NULL,
    scan_rate_ms INTEGER NOT NULL DEFAULT 1000,
    data_type TEXT NOT NULL DEFAULT 'Float32',
    min_value REAL,
    max_value REAL,
    safety_critical INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    provenance_source TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY(connection_id) REFERENCES industrial_connections(id) ON DELETE CASCADE
);

-- 5. Append-Only Cryptographic Audit Trail (IEC 62443-3-3 SL3)
CREATE TABLE IF NOT EXISTS audit_trail (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    user_role TEXT NOT NULL,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    target_id TEXT NOT NULL,
    previous_value TEXT,
    new_value TEXT,
    status TEXT NOT NULL,
    ip_address TEXT,
    tenant_id TEXT,
    hash TEXT NOT NULL
);

-- 6. Signed Edge Provisioning Manifests
CREATE TABLE IF NOT EXISTS provisioning_manifests (
    manifest_id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    target_edge_id TEXT NOT NULL,
    signature TEXT NOT NULL,
    hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    manifest_json TEXT NOT NULL,
    applied_at TEXT
);

-- 7. Industrial Telemetry Historian (Durable TSDB)
CREATE TABLE IF NOT EXISTS telemetry_history (
    id TEXT PRIMARY KEY,
    tag TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    quality TEXT NOT NULL,
    source TEXT NOT NULL,
    protocol TEXT NOT NULL,
    device_timestamp TEXT NOT NULL,
    received_timestamp TEXT NOT NULL,
    operational_mode TEXT NOT NULL,
    provenance_hash TEXT NOT NULL
);
