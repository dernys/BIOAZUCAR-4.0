#!/usr/bin/env bash
# ==============================================================================
# BIOAZÚCAR 4.0 — PRODUCTION ROLLBACK ENGINE (LINUX / POSIX)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="${1:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
BACKUP_DIR="$BASE_DIR/deploy/backup"

echo "======================================================================"
echo " BIOAZÚCAR 4.0 — PRODUCTION ROLLBACK ENGINE"
echo "======================================================================"

# Find latest pre-update backup
LATEST_BACKUP=$(ls -td "$BACKUP_DIR"/bioazucar-backup-pre-update-* 2>/dev/null | head -n 1 || true)
if [ -z "$LATEST_BACKUP" ]; then
  LATEST_BACKUP=$(ls -td "$BACKUP_DIR"/bioazucar-backup-* 2>/dev/null | head -n 1 || true)
fi

if [ -z "$LATEST_BACKUP" ] || [ ! -d "$LATEST_BACKUP" ]; then
  echo "Error: No backup snapshot found in $BACKUP_DIR to perform rollback."
  exit 1
fi

echo "Selected rollback target: $LATEST_BACKUP"

# 1. Restore state from backup
"$SCRIPT_DIR/restore.sh" "$LATEST_BACKUP" "$BASE_DIR"

# 2. Restart containers
if command -v docker &> /dev/null; then
  docker compose -f "$BASE_DIR/deploy/docker/docker-compose.prod.yml" restart || true
fi

# 3. Verify health
"$SCRIPT_DIR/healthcheck.sh" "http://127.0.0.1:3000" "http://127.0.0.1:9099" || true

echo "ROLLBACK COMPLETE."
