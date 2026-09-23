#!/usr/bin/env bash
# ==============================================================================
# BIOAZÚCAR 4.0 — PRODUCTION UPDATE ENGINE (LINUX / POSIX)
# ==============================================================================
set -euo pipefail

TARGET_VERSION="${1:-4.0.0-prod}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "======================================================================"
echo " BIOAZÚCAR 4.0 — PRODUCTION UPDATE ENGINE (N -> N+1)"
echo "======================================================================"
echo "Target Version: $TARGET_VERSION"

# 1. Pre-update safety backup
echo "[1/4] Creating automated safety pre-update backup..."
"$SCRIPT_DIR/backup.sh" "pre-update" "$BASE_DIR"

# 2. Database migrations
echo "[2/4] Applying database migrations..."
if command -v npx &> /dev/null; then
  npx tsx "$BASE_DIR/deploy/migrations/migrationRunner.ts" up
fi

# 3. Pull / Load containers
echo "[3/4] Updating containers..."
if command -v docker &> /dev/null; then
  docker compose -f "$BASE_DIR/deploy/docker/docker-compose.prod.yml" up -d --remove-orphans || true
fi

# 4. Health gate evaluation
echo "[4/4] Evaluating post-update health gates..."
"$SCRIPT_DIR/healthcheck.sh" "http://127.0.0.1:3000" "http://127.0.0.1:9099" || {
  echo "CRITICAL: Healthcheck failed! Triggering automatic rollback..."
  "$SCRIPT_DIR/rollback.sh" "$BASE_DIR"
  exit 1
}

echo "UPDATE TO $TARGET_VERSION COMPLETED SUCCESSFULLY."
