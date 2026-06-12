#!/bin/sh
set -eu

log() { printf '[nova-backend] %s\n' "$*"; }

if [ "${RUN_DB_MIGRATIONS:-true}" = "true" ]; then
  log "Applying database migrations..."
  alembic upgrade head
else
  log "Skipping migrations (RUN_DB_MIGRATIONS=false)"
fi

WORKERS="${UVICORN_WORKERS:-1}"
LOG_LEVEL_LOWER="$(printf '%s' "${LOG_LEVEL:-info}" | tr '[:upper:]' '[:lower:]')"

log "Starting uvicorn (${WORKERS} worker(s), log=${LOG_LEVEL_LOWER})..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers "${WORKERS}" \
  --proxy-headers \
  --forwarded-allow-ips='*' \
  --no-access-log \
  --log-level "${LOG_LEVEL_LOWER}"