#!/usr/bin/env bash
# ==============================================================================
# BIOAZÚCAR 4.0 — PRODUCTION PREFLIGHT VERIFICATION ENGINE (LINUX / POSIX)
# ==============================================================================
set -euo pipefail

MIN_RAM_GB=4
MIN_DISK_GB=10
INSTALL_PATH="${1:-/opt/bioazucar}"

echo "======================================================================"
echo " BIOAZÚCAR 4.0 — PRODUCTION PREFLIGHT VERIFICATION (LINUX)"
echo "======================================================================"
echo "Target Path: $INSTALL_PATH"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

FAIL_COUNT=0
WARN_COUNT=0
PASS_COUNT=0

log_pass() {
  echo -e " [PASS] $1 - $2: $3"
  PASS_COUNT=$((PASS_COUNT + 1))
}
log_warn() {
  echo -e " [WARN] $1 - $2: $3"
  WARN_COUNT=$((WARN_COUNT + 1))
}
log_fail() {
  echo -e " [FAIL] $1 - $2: $3"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

# 1. Architecture Check
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ] || [ "$ARCH" = "aarch64" ]; then
  log_pass "PRE-01" "CPU Architecture" "Compatible architecture ($ARCH)"
else
  log_fail "PRE-01" "CPU Architecture" "Incompatible architecture ($ARCH). Requires x86_64 or aarch64."
fi

# 2. RAM Memory Check
TOTAL_MEM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_MEM_GB=$(awk "BEGIN {print $TOTAL_MEM_KB/1048576}")
if (( $(awk "BEGIN {print ($TOTAL_MEM_GB >= $MIN_RAM_GB)}") )); then
  log_pass "PRE-02" "Host System Memory" "Total RAM: ${TOTAL_MEM_GB} GB (>= ${MIN_RAM_GB} GB)"
elif (( $(awk "BEGIN {print ($TOTAL_MEM_GB >= 2)}") )); then
  log_warn "PRE-02" "Host System Memory" "Total RAM: ${TOTAL_MEM_GB} GB is below recommended ${MIN_RAM_GB} GB"
else
  log_fail "PRE-02" "Host System Memory" "Total RAM: ${TOTAL_MEM_GB} GB is insufficient"
fi

# 3. Storage Directory & Filesystem Check
mkdir -p "$INSTALL_PATH/data" || true
if [ -w "$INSTALL_PATH/data" ]; then
  log_pass "PRE-03" "Persistent Storage Permissions" "Target path $INSTALL_PATH/data is writable"
else
  log_fail "PRE-03" "Persistent Storage Permissions" "Cannot write to $INSTALL_PATH/data"
fi

# 4. Node / Docker Tooling Check
if command -v docker &> /dev/null; then
  log_pass "PRE-04" "Docker Engine Available" "Docker CLI installed"
else
  log_warn "PRE-04" "Docker Engine Available" "Docker CLI not detected in PATH (Native mode possible)"
fi

echo ""
echo "----------------------------------------------------------------------"
echo " PREFLIGHT SUMMARY: $PASS_COUNT Passed, $WARN_COUNT Warnings, $FAIL_COUNT Failures"
echo "----------------------------------------------------------------------"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo " RESULT: FAIL — Preflight requirements not met."
  exit 1
elif [ "$WARN_COUNT" -gt 0 ]; then
  echo " RESULT: WARN — Preflight passed with warnings."
  exit 2
else
  echo " RESULT: PASS — Clean server verification successful."
  exit 0
fi
