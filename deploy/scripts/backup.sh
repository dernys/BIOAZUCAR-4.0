#!/usr/bin/env bash
# ==============================================================================
# BIOAZÚCAR 4.0 — PRODUCTION BACKUP ENGINE (LINUX / POSIX)
# ==============================================================================
set -euo pipefail

LABEL="${1:-manual}"
BASE_DIR="${2:-.}"
BACKUP_DIR="$BASE_DIR/deploy/backup"
DATA_DIR="$BASE_DIR/data"
CONFIG_DIR="$BASE_DIR/deploy/config"

TIMESTAMP=$(date -u +"%Y%m%d-%H%M%S")
BACKUP_ID="bioazucar-backup-${LABEL}-${TIMESTAMP}"
TARGET_DIR="${BACKUP_DIR}/${BACKUP_ID}"

echo "======================================================================"
echo " BIOAZÚCAR 4.0 — PRODUCTION BACKUP ENGINE (LINUX)"
echo "======================================================================"
echo "Backup ID: $BACKUP_ID"
echo "Target:    $TARGET_DIR"

mkdir -p "$TARGET_DIR/data" "$TARGET_DIR/config" "$TARGET_DIR/certificates"

# 1. Copy SQLite WAL databases
if [ -d "$DATA_DIR" ]; then
  cp -a "$DATA_DIR"/*.sqlite "$TARGET_DIR/data/" 2>/dev/null || true
  cp -a "$DATA_DIR"/*.db "$TARGET_DIR/data/" 2>/dev/null || true
fi

# 2. Copy configurations
if [ -d "$CONFIG_DIR" ]; then
  cp -a "$CONFIG_DIR"/* "$TARGET_DIR/config/" 2>/dev/null || true
fi
if [ -f "$BASE_DIR/deploy/docker/.env" ]; then
  cp -a "$BASE_DIR/deploy/docker/.env" "$TARGET_DIR/.env" 2>/dev/null || true
fi

# 3. Generate SHA-256 Manifest
cd "$TARGET_DIR"
find . -type f ! -name "manifest.json" ! -name "checksums.txt" -exec sha256sum {} + > checksums.txt

cat <<EOF > manifest.json
{
  "product": "BioAzúcar 4.0",
  "backupId": "$BACKUP_ID",
  "version": "4.0.0-prod",
  "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

echo ""
echo " BACKUP COMPLETED: $TARGET_DIR"
