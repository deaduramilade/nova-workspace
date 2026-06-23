# Nova

**AI-native collaborative browser workspace** — Self-hostable • Docker container isolation • High-performance WebRTC streaming (Neko) • Local LLM agents (Ollama)

Nova transforms any self-hosted or cloud server into a persistent, multi-user, browser-based workspace. Multiple humans and AI agents can simultaneously edit code, design interfaces, run applications, and collaborate in real time inside strongly isolated Docker environments.

The experience is comparable to “Google Docs + VS Code + Cursor + Figma + Zoom”, but fully private, self-hostable, containerized, and AI-first.

**License**: Apache-2.0  
**Current Status**: Phase 4 – Production Readiness & Polish (Complete) — June 12, 2026  
**Repository**: https://github.com/deaduramilade/nova-workspace

---

## ✨ Implemented Capabilities

- Real-time collaborative browser sessions via Neko WebRTC streaming (fully integrated)
- Working hours tracker with HR/salary calculation capability and supervisor visibility
- Breakout rooms for focused team discussions
- Break timer with binaural audio support for productive breaks
- Light team games (Memory Match and similar) for break-time productivity
- Real-time user presence, status system, and live sidebar (with contextual data)
- Supervisor oversight panel with live monitoring and feedback tools
- AI agents as first-class participants (foundation ready for expansion)
- Isolated Docker containers provisioned per participant
- Persistent storage and environment state
- Offline-first architecture with CRDT foundation for automatic, non-disruptive background synchronization
- **Zero-Trust Multi-Factor Authentication**: Device-based login with risk assessment and adaptive MFA for admins
  - Device fingerprinting and automatic recognition
  - Real-time risk scoring (0-100)
  - Trusted device management
  - Per-device session tracking
  - Anomaly detection and verification
  - Complete audit trail
  - See [Zero-Trust MFA Guide](docs/zero-trust-summary.md) for details
- Production-grade security hardening: rate limiting, environment-driven configuration, AES-256-GCM encryption (Argon2-derived keys), MFA support, RBAC + ABAC
- Strong privacy & compliance posture: 7-day maximum data retention with automatic deletion, GDPR/CCPA/SOC 2/ISO 27001 aligned controls
- Resource-efficient design: optimized for 4 GB RAM devices and metered connections; Oracle Cloud Always Free Tier compact profile (~1.6 GB total container RAM budget)

Full details and rationale are in the **[Project Charter](docs/charter.md)** — the single source of truth for Nova.

---

## 🏗️ Tech Stack & Architecture

| Layer              | Technology                                      | Notes |
|--------------------|-------------------------------------------------|-------|
| **Frontend**       | Next.js (App Router) + TypeScript + Tailwind CSS + Glassmorphism | PWA-ready. Realtime via WebSockets + custom CRDT engine. |
| **Backend**        | Python 3.12 + FastAPI                           | Rate limiting, production security, Alembic migrations, health/readiness endpoints. |
| **Streaming**      | m1k1o/neko (Firefox-based)                      | High-performance WebRTC browser streaming. |
| **AI**             | Ollama                                          | Local LLMs with custom agent framework (ready for deeper integration). |
| **Data**           | PostgreSQL 16 + Redis 7                         | Persistent metadata, presence, state, caching. |
| **Real-time / Sync**| WebSocket + CRDT foundation                    | Full offline capability with delta sync. |
| **Orchestration**  | Docker Compose (multi-profile)                  | Main, Oracle Always Free (compact/standard), production variants. |
| **Deployment**     | Oracle Cloud Always Free (recommended), self-hosted VPS, others | Full script suite + TLS automation in `deploy/`. |

See **[docs/architecture.md](docs/architecture.md)** for data models, API design, and security guidelines.

---

## 🚀 Quick Start

### Local Development (Recommended)

```bash
git clone https://github.com/deaduramilade/nova-workspace.git
cd nova-workspace

# 1. Start core infrastructure (PostgreSQL, Redis, Neko)
./deploy/local-dev.sh up
# Windows PowerShell:
# .\deploy\local-dev.ps1 up

# 2. Backend (new terminal, from repo root)
cd Backend
uvicorn app.main:app --reload --port 8000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**.

See `deploy/local-dev.sh` (or `.ps1`) and [docs/deployment.md](docs/deployment.md) for more options (full `docker compose`, env configuration, etc.).

### Production Deployment

**Recommended target**: Oracle Cloud Always Free Tier (Ampere A1, 12–24 GB RAM).

Complete guide with Oracle quick-start, secret generation, TLS/Let's Encrypt, resource profiles, and validation:

→ **[docs/deployment.md](docs/deployment.md)**

High-level flow:
```bash
./deploy/oracle-setup.sh
./deploy/init-env.sh --domain YOUR_IP_OR_DOMAIN --profile oracle --write
./deploy/setup-tls.sh your-domain.example.com --email you@example.com
./deploy/deploy.sh
```

Compact profile (default) is tuned for the free tier. Standard profile available for larger allocations.

---

## 📚 Documentation

- **[Project Charter](docs/charter.md)** — Vision, implemented features (Phase 4), security & privacy framework, compliance targets, workflow, governance, target users, and risk mitigations. **Single source of truth**.
- **[Architecture Specification](docs/architecture.md)** — High-level design, core data models, API endpoints, security implementation guidelines.
- **[Production Deployment Guide](docs/deployment.md)** — Oracle Free Tier instructions, all `deploy/*.sh` scripts, environment templates, resource budgets, troubleshooting, and maintenance.

---

## 🔒 Security, Privacy, Compliance & Accessibility

Nova is built for worldwide enterprise adoption and broad accessibility:

- **Data Retention**: Ephemeral workspace data, logs, and AI interactions retained for a maximum of **7 days** with automatic silent deletion.
- **Encryption**: All sensitive data at rest protected by AES-256-GCM; keys derived with Argon2.
- **Failed Access**: 5 consecutive failures trigger immediate forced deletion of locally stored sensitive data.
- **Zero-Trust + Controls**: Continuous verification, MFA, RBAC + ABAC, strict container isolation, comprehensive audit logging.
- **Offline Resilience**: Full functionality during outages; CRDT-powered automatic background sync with subtle indicators only.
- **Resource Efficiency**: Designed for entry-level hardware (4 GB RAM) and metered/unstable connections. Oracle compact profile targets ~1.6 GB container RAM.
- **Compliance Alignment**: GDPR, CCPA/CPRA, ISO 27001/27701, SOC 2, plus regional regulations (e.g. DPDP Act).

The full framework lives in the Charter.

---

## 🤝 Contributing & Governance

We welcome community contributions that align with the project vision.

- Significant changes require a Contributor License Agreement (CLA).
- Please keep early-phase contributions focused on the single-host Docker Compose model.
- Use the Charter as the north star for direction and scope.

Open issues and pull requests on GitHub. Feedback on GitHub, LinkedIn, Hugging Face, or X is appreciated.

---

## 📄 License

This project is licensed under the **Apache License 2.0** — see the [LICENSE](LICENSE) file for details.

Core remains free and open. Future monetization (sponsorships, premium support, managed hosting, enterprise tiers) will not restrict the open-source foundation.

---

**Nova — Private. Collaborative. AI-first. Production-ready.**

*Turn any server into a shared creative and productive space for humans and agents.*