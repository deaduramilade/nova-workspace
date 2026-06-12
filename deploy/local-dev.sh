#!/usr/bin/env bash
# Nova — start local development infrastructure (postgres, redis, neko)
#
# Usage:
#   ./deploy/local-dev.sh up
#   ./deploy/local-dev.sh down
#   ./deploy/local-dev.sh status

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ACTION="${1:-up}"

require_docker

case "$ACTION" in
  up)
    log "Starting local infrastructure..."
    docker compose up -d postgres redis neko
    docker compose ps postgres redis neko
    log "Backend:  cd backend && uvicorn app.main:app --reload --port 8000"
    log "Frontend: cd frontend && npm run dev"
    log "App:      http://localhost:3000"
    ;;
  down)
    docker compose down
    log "Local infrastructure stopped."
    ;;
  status)
    docker compose ps postgres redis neko
    ;;
  -h|--help|help)
    echo "Usage: ./deploy/local-dev.sh [up|down|status]"
    ;;
  *)
    die "Unknown action: $ACTION (use up, down, or status)"
    ;;
esac