#!/usr/bin/env bash
# Nova — tail service logs
#
# Usage:
#   ./deploy/logs.sh              # all services
#   ./deploy/logs.sh backend      # single service
#   ./deploy/logs.sh backend --tail 100

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

PROFILE=""
TAIL="50"
SERVICES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    --tail)
      TAIL="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: ./deploy/logs.sh [--profile PROFILE] [--tail N] [service ...]"
      exit 0
      ;;
    --*)
      die "Unknown option: $1"
      ;;
    *)
      SERVICES+=("$1")
      shift
      ;;
  esac
done

[[ -n "$PROFILE" ]] && export NOVA_PROFILE="$PROFILE"

require_docker

if ((${#SERVICES[@]} > 0)); then
  nova_compose logs -f --tail="$TAIL" "${SERVICES[@]}"
else
  nova_compose logs -f --tail="$TAIL"
fi