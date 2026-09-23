#!/usr/bin/env bash
# ==============================================================================
# BIOAZÚCAR 4.0 — PRODUCTION RESTORE ENGINE (LINUX / POSIX)
# ==============================================================================
set -euo pipefail

BACKUP_PATH="${1:-}"
BASE_DIR="${2:-.}"

if [ -z "$BACKUP_PATH" ] || [ ! -d "$BACKUP_PATH" ]; then
  echo "Error: Must specify valid backup directory as first argument."
  exit 1
fi

echo "======================================================================"
echo " BIOAZÚCAR 4.0 — PRODUCTION RESTORE ENGINE (LINUX)"
echo "======================================================================"
echo "Restoring from: $BACKUP_PATH"

# 1. Verify Checksums
if [ -f "$BACKUP_PATH/checksums.txt" ]; then
  echo "Verifying SHA-256 checksums..."
  (cd "$BACKUP_PATH" && sha256sum -c checksums.txt)
  echo "Checksums verified successfully."
fi

# 2. Restore Databases
if [ -d "$BACKUP_PATH/data" ]; then
  mkdir -p "$BASE_DIR/data"
  cp -a "$BACKUP_PATH/data"/* "$BASE_DIR/data/"
  echo "Restored database files."
fi

# 3. Restore Configurations
if [ -d "$BACKUP_PATH/config" ]; then
  mkdir -p "$BASE_DIR/deploy/config"
  cp -a "$BACKUP_PATH/config"/* "$BASE_DIR/deploy/config/"
  echo "Restored configuration files."
fi

echo "RESTORE COMPLETED SUCCESSFULLY."
