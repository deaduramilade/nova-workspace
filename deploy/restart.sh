#!/usr/bin/env bash
# Nova — restart services without rebuilding
#
# Usage:
#   ./deploy/restart.sh
#   ./deploy/restart.sh backend nginx

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
      echo "Usage: ./deploy/restart.sh [--profile PROFILE] [service ...]"
      exit 0
      ;;
    --*)
      die "Unknown option: $1"
      ;;
    *)
      break
      ;;
  esac
done

[[ -n "$PROFILE" ]] && export NOVA_PROFILE="$PROFILE"

require_docker
PROFILE="$(detect_profile)"

if [[ $# -gt 0 ]]; then
  log "Restarting: $*"
  nova_compose restart "$@"
else
  log "Restarting all services (profile: $PROFILE)"
  nova_compose restart
fi

wait_for_backend || true
log "Restart complete."