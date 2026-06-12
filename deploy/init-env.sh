#!/usr/bin/env bash
# Nova — generate backend/.env and root .env from secrets
#
# Usage:
#   ./deploy/init-env.sh --domain your-domain.com --profile oracle --write
#   ./deploy/init-env.sh --domain 203.0.113.10 --profile oracle --write

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

require_cmd python3

if [[ $# -eq 0 ]]; then
  cat <<'EOF'
Generate production environment files.

Examples:
  ./deploy/init-env.sh --domain nova.example.com --profile oracle --write
  ./deploy/init-env.sh --domain 203.0.113.10 --profile oracle --write
  ./deploy/init-env.sh --domain nova.example.com --profile production --write

Profiles:
  oracle           Oracle Free Tier compact (default, ~1.6 GB containers)
  oracle-standard  Oracle 24 GB VM
  production       Generic VPS (docker-compose.prod.yml)
EOF
  exit 0
fi

exec python3 "$SCRIPT_DIR/generate_secrets.py" "$@"