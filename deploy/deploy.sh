#!/usr/bin/env bash
# Nova — build and start the production stack
#
# Usage:
#   ./deploy/deploy.sh                          # auto-detect profile from .env
#   NOVA_PROFILE=oracle ./deploy/deploy.sh
#   ./deploy/deploy.sh --profile oracle-standard
#   ./deploy/deploy.sh --skip-validate --no-build

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

SKIP_VALIDATE=0
NO_BUILD=0
PROFILE=""

usage() {
  cat <<'EOF'
Nova deploy — build and start containers

Options:
  --profile PROFILE   oracle | oracle-standard | production (default: from .env)
  --skip-validate     Skip validate_production.py pre-flight
  --no-build          Start without rebuilding images
  -h, --help          Show this help

Examples:
  ./deploy/deploy.sh
  ./deploy/deploy.sh --profile oracle-standard
  NOVA_PROFILE=production ./deploy/deploy.sh
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    --skip-validate)
      SKIP_VALIDATE=1
      shift
      ;;
    --no-build)
      NO_BUILD=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1 (use --help)"
      ;;
  esac
done

[[ -n "$PROFILE" ]] && export NOVA_PROFILE="$PROFILE"

require_docker
require_env_files

PROFILE="$(detect_profile)"
log "Deploying Nova (profile: $PROFILE)"

if [[ "$SKIP_VALIDATE" -eq 0 ]]; then
  if command -v python3 >/dev/null 2>&1; then
    log "Running production validator..."
    python3 deploy/validate_production.py || die "Pre-flight validation failed (use --skip-validate to override)"
  else
    warn "python3 not found — skipping validate_production.py"
  fi
fi

UP_ARGS=(-d)
[[ "$NO_BUILD" -eq 0 ]] && UP_ARGS+=(--build)

log "Starting stack: docker compose $(compose_args "$PROFILE") up ${UP_ARGS[*]}"
nova_compose up "${UP_ARGS[@]}"

wait_for_backend || true

log "Container status:"
nova_compose ps

if [[ -x "./deploy/health-check.sh" ]]; then
  ./deploy/health-check.sh || warn "Some health checks failed"
fi

log "Deploy complete."
DOMAIN="$(read_env_var DOMAIN .env || echo localhost)"
log "Open: https://${DOMAIN} (or http if using IP without TLS)"