#!/usr/bin/env bash
# Nova — show container status and quick health summary
#
# Usage: ./deploy/status.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

PROFILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: ./deploy/status.sh [--profile PROFILE]"
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

[[ -n "$PROFILE" ]] && export NOVA_PROFILE="$PROFILE"

require_docker
PROFILE="$(detect_profile)"

log "Profile: $PROFILE"
echo ""
nova_compose ps
echo ""

if [[ -f ".env" ]]; then
  DOMAIN="$(read_env_var DOMAIN .env || echo unknown)"
  log "Domain: $DOMAIN"
fi

probe() {
  local name="$1"
  local url="$2"
  if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
    printf '  [OK]   %s\n' "$name"
  else
    printf '  [FAIL] %s\n' "$name"
  fi
}

log "Health probes:"
probe "nginx /api/v1/health" "http://localhost/api/v1/health"
probe "readiness" "http://localhost/api/v1/health/readiness"
probe "production" "http://localhost/api/v1/health/production"