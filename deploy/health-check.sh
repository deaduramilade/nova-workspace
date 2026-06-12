#!/usr/bin/env bash
# Nova — verify health endpoints after deploy
#
# Usage: ./deploy/health-check.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

require_cmd curl

BASE_URL="${NOVA_HEALTH_URL:-http://localhost}"
FAILED=0

check_endpoint() {
  local path="$1"
  local url="${BASE_URL}${path}"
  local body
  if body="$(curl -fsS --max-time 10 "$url" 2>/dev/null)"; then
    log "OK  $path"
    if command -v python3 >/dev/null 2>&1 && [[ "$body" == \{* ]]; then
      echo "$body" | python3 -m json.tool 2>/dev/null | head -n 12 || true
    fi
    echo ""
    return 0
  fi
  warn "FAIL $path"
  FAILED=1
  return 1
}

log "Health check against $BASE_URL"
echo ""

check_endpoint "/api/v1/health" || true
check_endpoint "/api/v1/health/readiness" || true
check_endpoint "/api/v1/health/production" || true
check_endpoint "/api/v1/health/security" || true

if [[ "$FAILED" -eq 0 ]]; then
  log "All health checks passed."
  exit 0
fi

die "One or more health checks failed."