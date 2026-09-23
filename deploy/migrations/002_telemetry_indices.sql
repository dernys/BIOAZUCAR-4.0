-- ==============================================================================
-- BIOAZÚCAR 4.0 — MIGRATION 002: PERFORMANCE INDICES
-- ==============================================================================
-- Version: 002
-- Name: telemetry_indices
-- Rollback-Supported: true

CREATE INDEX IF NOT EXISTS idx_telemetry_tag_ts ON telemetry_history(tag, device_timestamp);
CREATE INDEX IF NOT EXISTS idx_telemetry_received ON telemetry_history(received_timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_ts ON audit_trail(tenant_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_tags_tenant_tag ON industrial_tags(tenant_id, tag);
CREATE INDEX IF NOT EXISTS idx_conn_tenant ON industrial_connections(tenant_id);
