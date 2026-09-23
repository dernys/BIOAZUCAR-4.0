#!/usr/bin/env bash
# ==============================================================================
# BIOAZÚCAR 4.0 — PRODUCTION INSTALLER (LINUX / POSIX)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
OFFLINE_MODE="${1:-online}"

echo "======================================================================"
echo " BIOAZÚCAR 4.0 — PRODUCTION INSTALLER (LINUX)"
echo "======================================================================"
echo "Base Directory: $BASE_DIR"
echo "Mode:           $OFFLINE_MODE"

# 1. Preflight
"$SCRIPT_DIR/preflight.sh" "$BASE_DIR"

# 2. Directories
mkdir -p "$BASE_DIR/data" "$BASE_DIR/logs" "$BASE_DIR/deploy/backup" "$BASE_DIR/deploy/certificates"

# 3. Offline image loading
if [ "$OFFLINE_MODE" = "offline" ]; then
  echo "Ingesting offline images..."
  for img in "$BASE_DIR/deploy/offline/images"/*.tar; do
    if [ -f "$img" ]; then
      echo "Loading $img..."
      docker load -i "$img"
    fi
  done
fi

# 4. Migrations
echo "Executing database migrations..."
if command -v npx &> /dev/null; then
  npx tsx "$BASE_DIR/deploy/migrations/migrationRunner.ts" up
fi

# 5. Start containers
if command -v docker &> /dev/null; then
  docker compose -f "$BASE_DIR/deploy/docker/docker-compose.prod.yml" up -d
fi

# 6. Healthcheck
sleep 5
"$SCRIPT_DIR/healthcheck.sh" || true

echo "INSTALLATION COMPLETE."
