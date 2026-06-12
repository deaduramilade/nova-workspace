# Nova Workspace — Production Deployment Guide

**Version**: 2.2  
**Last Updated**: June 12, 2026  
**Target**: Oracle Cloud Always Free Tier (primary), with alternatives

---

## Deployment Options

| Option | Cost | Always On | Difficulty | Best For |
|--------|------|-----------|------------|----------|
| **Oracle Cloud Always Free** | $0 | Yes | Medium | **Production + demos (recommended)** |
| Render.com | Free tier | No (sleeps) | Easy | Quick public preview |
| Fly.io | ~$5/mo credit | Yes | Easy | Global edge |
| Self-hosted VPS | ~$5/mo | Yes | Medium | Hetzner, DigitalOcean |

**Recommended**: Oracle Cloud Always Free — 4 ARM OCPUs, 24 GB RAM, 200 GB storage, static IP, 24/7 uptime within free limits.

---

## Oracle Cloud Always Free — Quick Start

### 1. Create the VM

1. Sign up at [cloud.oracle.com](https://cloud.oracle.com) (card required for verification; stay within Always Free limits).
2. Create an **Ampere A1** instance:
   - Shape: `VM.Standard.A1.Flex`
   - OCPUs: **2–4** (2 is enough for Nova compact profile)
   - RAM: **12–24 GB** (12 GB runs compact; 24 GB runs standard)
   - OS: **Ubuntu 24.04** or Oracle Linux 9
   - Boot volume: **50–100 GB**
3. Open ingress rules in the **VCN Security List**:
   - TCP **22** (SSH)
   - TCP **80** (HTTP)
   - TCP **443** (HTTPS)
4. Note the **public IP** — use it as your domain or point DNS A-record to it.

### 2. Prepare the server

SSH into the instance, then run the setup script:

```bash
git clone https://github.com/deaduramilade/nova-workspace.git
cd nova-workspace
chmod +x deploy/oracle-setup.sh
./deploy/oracle-setup.sh
```

Log out and back in so the `docker` group applies.

### 3. Generate secrets and env files

```bash
chmod +x deploy/*.sh deploy/lib/*.sh
./deploy/init-env.sh --domain YOUR_PUBLIC_IP_OR_DOMAIN --profile oracle --write
```

This writes:
- `backend/.env` — backend production config (Oracle-tuned)
- `.env` — Docker Compose secrets and public URLs

### 4. TLS certificates

**Option A — IP only (testing):** use a self-signed cert or HTTP-only on port 80 (not recommended for production).

**Option B — Domain + Let's Encrypt (recommended):**

```bash
./deploy/setup-tls.sh your-domain.com --email you@example.com
```

### 5. Deploy

```bash
# Compact profile (default for Oracle Free Tier)
./deploy/deploy.sh

# Standard profile (24 GB VM)
NOVA_PROFILE=oracle-standard ./deploy/deploy.sh
```

### 6. Validate

```bash
./deploy/health-check.sh
python3 deploy/validate_production.py
```

Open `https://YOUR_PUBLIC_IP_OR_DOMAIN` in a browser.

---

## Resource Profiles (Oracle Free Tier)

Nova ships two memory profiles aligned with the charter's resource-efficiency goals:

| Service | Compact (default) | Standard (24 GB VM) |
|---------|-------------------|---------------------|
| PostgreSQL | 256 MB | 512 MB |
| Redis | 96 MB | 192 MB |
| Neko | 512 MB | 768 MB |
| Backend | 384 MB, 1 worker | 768 MB, 2 workers |
| Frontend | 256 MB | 512 MB |
| Nginx | 64 MB | 128 MB |
| **Total** | **~1.6 GB** | **~2.9 GB** |

Ollama is **excluded** from Oracle profiles — it exceeds free-tier memory budgets. Enable separately on larger VMs.

---

## Deployment Scripts

| Script | Purpose |
|--------|---------|
| `deploy/oracle-setup.sh` | First-time Oracle VM bootstrap (Docker, swap, firewall) |
| `deploy/init-env.sh` | Generate `backend/.env` and root `.env` secrets |
| `deploy/setup-tls.sh` | Let's Encrypt certs → `deploy/certs/` |
| `deploy/deploy.sh` | Build and start production stack |
| `deploy/update.sh` | `git pull` + rebuild + restart |
| `deploy/restart.sh` | Restart services without rebuild |
| `deploy/stop.sh` | Stop stack (`--remove-volumes` deletes data) |
| `deploy/status.sh` | Container status + quick health probes |
| `deploy/logs.sh` | Tail logs (`./deploy/logs.sh backend`) |
| `deploy/health-check.sh` | Hit all `/api/v1/health/*` endpoints |
| `deploy/local-dev.sh` | Local infra only (postgres, redis, neko) |

Profile is read from `DEPLOY_PROFILE` in `.env`, or set `NOVA_PROFILE=oracle-standard`.

---

## Environment Files

| File | Purpose |
|------|---------|
| `backend/.env` | Backend runtime config (never commit) |
| `.env` | Root Compose secrets (`POSTGRES_PASSWORD`, etc.) |
| `deploy/oracle.env.template` | Oracle Free Tier reference |
| `deploy/production.env.template` | Generic production reference |
| `deploy/compose.env.template` | Root Compose template |
| `deploy/frontend.production.template` | Next.js build env |

Generate everything:

```bash
python3 deploy/generate_secrets.py --domain your-domain.com --profile oracle --write
```

---

## Firewall & Security Checklist

- [ ] Oracle VCN ingress: only 22, 80, 443 open to `0.0.0.0/0` (restrict SSH to your IP if possible)
- [ ] `ALLOW_REGISTRATION=False` in production
- [ ] `EXPOSE_API_DOCS=False`
- [ ] Strong secrets via `generate_secrets.py` (never use defaults)
- [ ] TLS enabled via nginx + Let's Encrypt
- [ ] `python3 deploy/validate_production.py` passes all checks

---

## Local Development

```bash
./deploy/local-dev.sh up
cd backend && uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev
```

Open http://localhost:3000

---

## Option 2: Render.com (Quick Demo)

1. Connect GitHub repo to Render.
2. Deploy backend as **Web Service** (Python, `uvicorn app.main:app`).
3. Deploy frontend as **Static Site** or Web Service (`npm run build && npm start`).
4. Set `NEXT_PUBLIC_API_URL` and `CORS_ORIGINS` to Render URLs.

Note: free tier sleeps after inactivity.

---

## Option 3: Fly.io

```bash
fly launch
fly secrets set SECRET_KEY=... ENCRYPTION_KEY=...
fly deploy
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Neko stream won't load | `docker logs nova-neko-oracle` — wait 30s after start |
| 503 on `/health/readiness` | `docker compose -f docker-compose.oracle.yml ps` — ensure postgres is healthy |
| Out of memory | Use compact profile; add 2 GB swap: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |
| CORS errors | Set `CORS_ORIGINS` to exact frontend URL (include `https://`) |
| WebSocket fails | Ensure nginx `location /api/v1/presence/ws` proxy is active |

---

## Maintenance

```bash
./deploy/logs.sh backend
./deploy/restart.sh
./deploy/update.sh
sudo certbot renew && sudo cp /etc/letsencrypt/live/YOUR_DOMAIN/*.pem deploy/certs/
```

---

**Nova is production-ready on Oracle Cloud Always Free Tier.** Use the compact profile for 12 GB VMs and standard for 24 GB allocations.