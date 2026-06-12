#!/usr/bin/env bash
# Nova deployment shared library — source from other deploy/*.sh scripts

if [[ -n "${NOVA_COMMON_LOADED:-}" ]]; then
  return 0 2>/dev/null || exit 0
fi
NOVA_COMMON_LOADED=1

NOVA_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$NOVA_ROOT"

log()  { printf '[nova] %s\n' "$*"; }
warn() { printf '[nova] WARN: %s\n' "$*" >&2; }
die()  { printf '[nova] ERROR: %s\n' "$*" >&2; exit 1; }

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || die "Required command not found: $cmd"
}

require_docker() {
  require_cmd docker
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 plugin required (docker compose)"
  docker info >/dev/null 2>&1 || die "Docker daemon not running or user lacks docker group access"
}

read_env_var() {
  local key="$1"
  local file="${2:-.env}"
  [[ -f "$file" ]] || return 1
  grep -E "^${key}=" "$file" 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d '"' | tr -d "'"
}

detect_profile() {
  if [[ -n "${NOVA_PROFILE:-}" ]]; then
    echo "$NOVA_PROFILE"
    return
  fi
  local from_env
  from_env="$(read_env_var DEPLOY_PROFILE .env || true)"
  if [[ -n "$from_env" ]]; then
    echo "$from_env"
    return
  fi
  from_env="$(read_env_var DEPLOY_PROFILE backend/.env || true)"
  if [[ -n "$from_env" ]]; then
    echo "$from_env"
    return
  fi
  echo "oracle"
}

compose_args() {
  local profile="${1:-$(detect_profile)}"
  case "$profile" in
    oracle)
      echo "-f" "docker-compose.oracle.yml"
      ;;
    oracle-standard)
      echo "-f" "docker-compose.oracle.yml" "-f" "docker-compose.oracle.standard.yml"
      ;;
    production|default)
      echo "-f" "docker-compose.prod.yml"
      ;;
    *)
      die "Unknown profile: $profile (use oracle, oracle-standard, or production)"
      ;;
  esac
}

nova_compose() {
  local profile="${NOVA_PROFILE:-$(detect_profile)}"
  # shellcheck disable=SC2046
  docker compose $(compose_args "$profile") "$@"
}

require_env_files() {
  [[ -f ".env" ]] || die "Missing root .env — run: ./deploy/init-env.sh --domain YOUR_DOMAIN --profile oracle --write"
  [[ -f "backend/.env" ]] || die "Missing backend/.env — run: ./deploy/init-env.sh --domain YOUR_DOMAIN --profile oracle --write"

  local missing=()
  for key in POSTGRES_PASSWORD REDIS_PASSWORD NEKO_PASSWORD NEKO_ADMIN_PASSWORD NEXT_PUBLIC_API_URL NEXT_PUBLIC_WS_URL; do
    local val
    val="$(read_env_var "$key" .env || true)"
    if [[ -z "$val" || "$val" == REPLACE_* ]]; then
      missing+=("$key")
    fi
  done
  if ((${#missing[@]} > 0)); then
    die "Unset or placeholder values in .env: ${missing[*]}"
  fi
}

wait_for_backend() {
  local attempts="${1:-30}"
  local delay="${2:-5}"
  log "Waiting for backend readiness (up to $((attempts * delay))s)..."
  local i
  for ((i = 1; i <= attempts; i++)); do
    if curl -fsS "http://localhost/api/v1/health/readiness" >/dev/null 2>&1 \
      || curl -fsS "http://127.0.0.1:8000/api/v1/health/readiness" >/dev/null 2>&1; then
      log "Backend is ready."
      return 0
    fi
    sleep "$delay"
  done
  warn "Backend readiness probe timed out — check: ./deploy/logs.sh backend"
  return 1
}