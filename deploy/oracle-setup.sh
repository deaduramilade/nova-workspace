#!/usr/bin/env bash
# Nova — Oracle Cloud Always Free Tier server bootstrap
# Run as a non-root user with sudo on Ubuntu 24.04 / Oracle Linux 9

set -euo pipefail

log() { echo "[nova-setup] $*"; }

if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  echo "Run as a regular user with sudo, not root."
  exit 1
fi

log "Updating system packages..."
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

log "Installing dependencies..."
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  ca-certificates curl git python3 python3-pip ufw fail2ban

if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker Engine..."
  curl -fsSL https://get.docker.com | sudo sh
fi

if ! groups "$USER" | grep -q '\bdocker\b'; then
  sudo usermod -aG docker "$USER"
  log "Added $USER to docker group — log out and back in before deploying."
fi

if ! docker compose version >/dev/null 2>&1; then
  log "Docker Compose plugin not found — install Docker CE 24+ (includes compose v2)."
  exit 1
fi

log "Configuring 2 GB swap (OOM safety on compact profile)..."
if [[ ! -f /swapfile ]]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  if ! grep -q '/swapfile' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  fi
fi

log "Configuring UFW firewall..."
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

log "Hardening sysctl for containers..."
sudo tee /etc/sysctl.d/99-nova.conf >/dev/null <<'EOF'
vm.swappiness=10
vm.max_map_count=262144
net.ipv4.ip_forward=1
fs.file-max=65535
EOF
sudo sysctl --system >/dev/null

mkdir -p deploy/certs
chmod 700 deploy/certs 2>/dev/null || true

log "Setup complete."
echo ""
echo "Next steps:"
echo "  1. Log out and back in (docker group)"
echo "  2. chmod +x deploy/*.sh deploy/lib/*.sh"
echo "  3. ./deploy/init-env.sh --domain YOUR_IP_OR_DOMAIN --profile oracle --write"
echo "  4. ./deploy/setup-tls.sh your-domain.com   # or copy certs to deploy/certs/"
echo "  5. ./deploy/deploy.sh"
echo "  6. ./deploy/health-check.sh"