#!/usr/bin/env bash
# ==============================================================================
# BIOAZÚCAR 4.0 — PRODUCTION DIAGNOSTICS COLLECTOR (LINUX / POSIX)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_DIR="$BASE_DIR/deploy/diagnostics"
TIMESTAMP=$(date -u +"%Y%m%d-%H%M%S")
DIAG_DIR="$OUTPUT_DIR/bioazucar-diag-$TIMESTAMP"

echo "======================================================================"
echo " BIOAZÚCAR 4.0 — PRODUCTION DIAGNOSTICS COLLECTOR"
echo "======================================================================"

mkdir -p "$DIAG_DIR"

# 1. System Info
uname -a > "$DIAG_DIR/system_uname.txt" 2>&1 || true
uptime > "$DIAG_DIR/uptime.txt" 2>&1 || true
free -m > "$DIAG_DIR/memory.txt" 2>&1 || true
df -h . > "$DIAG_DIR/disk_usage.txt" 2>&1 || true

# 2. Network & Ports
netstat -tulpn 2>/dev/null > "$DIAG_DIR/listening_ports.txt" || ss -tulpn > "$DIAG_DIR/listening_ports.txt" || true

# 3. Docker status
if command -v docker &> /dev/null; then
  docker ps -a > "$DIAG_DIR/docker_containers.txt" 2>&1 || true
fi

# 4. Healthcheck
"$SCRIPT_DIR/healthcheck.sh" > "$DIAG_DIR/health_report.txt" 2>&1 || true

# 5. Archive
tar -czf "$DIAG_DIR.tar.gz" -C "$OUTPUT_DIR" "bioazucar-diag-$TIMESTAMP"
rm -rf "$DIAG_DIR"

echo "DIAGNOSTIC ARCHIVE CREATED: $DIAG_DIR.tar.gz"
