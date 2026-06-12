#!/usr/bin/env bash
# Nova — obtain Let's Encrypt certs and install into deploy/certs/
#
# Usage:
#   ./deploy/setup-tls.sh nova.example.com
#   ./deploy/setup-tls.sh nova.example.com --email admin@example.com

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

DOMAIN=""
EMAIL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email)
      EMAIL="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: ./deploy/setup-tls.sh DOMAIN [--email EMAIL]"
      exit 0
      ;;
    --*)
      die "Unknown option: $1"
      ;;
    *)
      DOMAIN="$1"
      shift
      ;;
  esac
done

[[ -n "$DOMAIN" ]] || die "DOMAIN required — e.g. ./deploy/setup-tls.sh nova.example.com"

if ! command -v certbot >/dev/null 2>&1; then
  log "Installing certbot..."
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot
fi

log "Stopping nginx temporarily for standalone certbot..."
nova_compose stop nginx 2>/dev/null || docker compose -f docker-compose.oracle.yml stop nginx 2>/dev/null || true

CERTBOT_ARGS=(certonly --standalone --preferred-challenges http -d "$DOMAIN" --agree-tos --non-interactive)
[[ -n "$EMAIL" ]] && CERTBOT_ARGS+=(--email "$EMAIL") || CERTBOT_ARGS+=(--register-unsafely-without-email)

log "Requesting certificate for $DOMAIN..."
sudo certbot "${CERTBOT_ARGS[@]}"

mkdir -p deploy/certs
sudo cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" deploy/certs/
sudo cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" deploy/certs/
sudo chown "$USER:$USER" deploy/certs/*.pem
chmod 600 deploy/certs/privkey.pem

if grep -q 'server_name your-domain.com' deploy/nginx.conf 2>/dev/null; then
  log "Updating server_name in deploy/nginx.conf..."
  sed -i.bak "s/server_name your-domain.com;/server_name ${DOMAIN};/" deploy/nginx.conf
  rm -f deploy/nginx.conf.bak
fi

log "Starting nginx..."
nova_compose up -d nginx 2>/dev/null || docker compose -f docker-compose.oracle.yml up -d nginx

log "TLS installed for $DOMAIN"
log "Renewal: sudo certbot renew && sudo cp /etc/letsencrypt/live/${DOMAIN}/*.pem deploy/certs/"