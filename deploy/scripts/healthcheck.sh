#!/usr/bin/env bash
# ==============================================================================
# BIOAZÚCAR 4.0 — PRODUCTION HEALTH GATES EVALUATOR (LINUX / POSIX)
# ==============================================================================
set -euo pipefail

APP_URL="${1:-http://127.0.0.1:3000}"
EDGE_URL="${2:-http://127.0.0.1:9099}"

echo "======================================================================"
echo " BIOAZÚCAR 4.0 — OPERATIONAL HEALTH GATES EVALUATION (LINUX)"
echo "======================================================================"
echo "Platform URL: $APP_URL"
echo "Edge URL:     $EDGE_URL"
echo "Timestamp:    $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

EXIT_CODE=0

# Gate 1: Central Platform API
if curl -s -f -m 5 "$APP_URL/api/health" > /dev/null; then
  echo " [HEALTHY] Platform SCADA Core: HTTP 200 OK at $APP_URL/api/health"
else
  echo " [FAILED]  Platform SCADA Core: Could not reach $APP_URL/api/health"
  EXIT_CODE=1
fi

# Gate 2: Prometheus Metrics Scrape
METRICS_PAYLOAD=$(curl -s -f -m 5 "$APP_URL/metrics" 2>/dev/null || true)
if echo "$METRICS_PAYLOAD" | grep "bioazucar_" > /dev/null 2>&1; then
  echo " [HEALTHY] Metrics & OpenMetrics: Telemetry metrics scraped successfully"
else
  echo " [DEGRADED] Metrics & OpenMetrics: Telemetry metrics stream unavailable or empty"
  if [ $EXIT_CODE -eq 0 ]; then EXIT_CODE=2; fi
fi

# Gate 3: Edge Gateway Node Watchdog (Optional/Conditional)
if curl -s -f -m 3 "$EDGE_URL/health" > /dev/null; then
  echo " [HEALTHY] Edge Gateway Watchdog: HTTP 200 OK at $EDGE_URL/health"
else
  echo " [DEGRADED] Edge Gateway Watchdog: Node port $EDGE_URL unreachable (May be remote or local process)"
  if [ $EXIT_CODE -eq 0 ]; then EXIT_CODE=2; fi
fi

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo " OVERALL STATUS: HEALTHY"
elif [ $EXIT_CODE -eq 2 ]; then
  echo " OVERALL STATUS: DEGRADED"
else
  echo " OVERALL STATUS: FAILED"
fi

exit $EXIT_CODE
