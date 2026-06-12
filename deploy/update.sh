#!/usr/bin/env bash
# Nova — pull latest code and redeploy
#
# Usage:
#   ./deploy/update.sh
#   ./deploy/update.sh --no-pull

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

NO_PULL=0
PROFILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    --no-pull)
      NO_PULL=1
      shift
      ;;
    -h|--help)
      echo "Usage: ./deploy/update.sh [--profile PROFILE] [--no-pull]"
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

[[ -n "$PROFILE" ]] && export NOVA_PROFILE="$PROFILE"

require_docker
require_env_files

PROFILE="$(detect_profile)"
log "Updating Nova (profile: $PROFILE)"

if [[ "$NO_PULL" -eq 0 ]]; then
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    log "Pulling latest changes..."
    git pull --ff-only
  else
    warn "Not a git repository — skipping git pull"
  fi
fi

log "Rebuilding and restarting..."
nova_compose up -d --build --remove-orphans

wait_for_backend || true
nova_compose ps

if [[ -x "./deploy/health-check.sh" ]]; then
  ./deploy/health-check.sh || warn "Some health checks failed"
fi

log "Update complete."