-- ==============================================================================
-- BIOAZÚCAR 4.0 — MIGRATION 003: STORE AND FORWARD BUFFER & DATA PIPELINE
-- ==============================================================================
-- Version: 003
-- Name: edge_saf_metadata
-- Rollback-Supported: true

CREATE TABLE IF NOT EXISTS edge_saf_queue (
    id TEXT PRIMARY KEY,
    entry_id TEXT UNIQUE NOT NULL,
    tag TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    enqueued_at TEXT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING',
    forwarded_at TEXT,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_saf_status_enqueued ON edge_saf_queue(status, enqueued_at);
