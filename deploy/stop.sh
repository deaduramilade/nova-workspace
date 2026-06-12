#!/usr/bin/env bash
# Nova — stop the production stack
#
# Usage:
#   ./deploy/stop.sh
#   ./deploy/stop.sh --remove-volumes   # destructive: deletes postgres/redis data

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

REMOVE_VOLUMES=0
PROFILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    --remove-volumes)
      REMOVE_VOLUMES=1
      shift
      ;;
    -h|--help)
      echo "Usage: ./deploy/stop.sh [--profile PROFILE] [--remove-volumes]"
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

if [[ "$REMOVE_VOLUMES" -eq 1 ]]; then
  read -r -p "Remove volumes? This deletes database data. [y/N] " confirm
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    nova_compose down -v
    log "Stack stopped and volumes removed."
  else
    log "Aborted."
    exit 1
  fi
else
  nova_compose down
  log "Stack stopped (profile: $PROFILE)."
fi