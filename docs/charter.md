# Nova Project Charter

**Version**: 2.2  
**Phase**: 4 – Production Readiness & Polish (Complete)  
**Date**: June 12, 2026
**Repository**: https://github.com/deaduramilade/nova-workspace  
**License**: Apache-2.0

---

## 1. Project Overview & Vision

**Nova** is an open-source AI-native collaborative browser workspace. It combines Docker container isolation, high-performance WebRTC streaming (Neko), and native AI agents powered by local LLMs.

**Core Idea**: Turn any self-hosted or cloud server into a persistent, multi-user, browser-based workspace where multiple humans and AI agents can simultaneously edit code, design UIs, run applications, and collaborate in real-time inside isolated Docker environments.

Nova delivers a unified experience comparable to “Google Docs + VS Code + Cursor + Figma + Zoom”, but fully private, self-hostable, containerized, and AI-first.

**Current Status (June 2026)**: The project has successfully completed Phase 4 (Production Readiness). Core features including working hours tracking, breakout rooms, break timer with binaural audio support, light team games, real-time user presence, supervisor oversight, and streaming integration are now implemented and functional.

---

## 2. Key Capabilities (Implemented)

- Real-time collaborative browser sessions via WebRTC streaming (Neko integration complete).
- Working hours tracker with HR/salary calculation capability.
- Breakout rooms for focused team discussions.
- Break timer with binaural audio support for productivity breaks.
- Light team games module for productive break time.
- Real-time user presence and status system.
- Supervisor oversight panel with live monitoring.
- AI agents as first-class participants (foundation ready).
- Isolated Docker containers for each participant.
- Persistent storage and environment state.
- Offline-first architecture with CRDT foundation.
- Strong privacy, security, and compliance controls.

---

## 3. Design & Architecture

- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS with subtle Glassmorphism design. Progressive Web App ready.
- **Backend**: Python 3.12 + FastAPI with rate limiting and production security hardening.
- **Streaming Layer**: Neko WebRTC (fully integrated in workspace pages).
- **AI Layer**: Ollama foundation with custom agent framework (ready for expansion).
- **Orchestration**: Docker Compose with Oracle Cloud Always Free Tier profile (`docker-compose.oracle.yml`).
- **Data Layer**: PostgreSQL + Redis.
- **Real-time**: WebSocket + CRDT foundation for offline synchronization.
- **Security**: Rate limiting, environment-based configuration, AES-256 encryption support.

---

## 4. Security, Privacy, Compliance, Resilience, and Accessibility

### 4.1 Security and Privacy Framework

- **Data Retention**: Ephemeral workspace data, session logs, AI interactions, and temporary files are retained for a maximum of 7 days. Automatic, silent deletion occurs after this period.
- **Encryption**: All sensitive data at rest is protected with AES-256-GCM encryption. Keys are derived securely (Argon2).
- **Failed Access Protection**: After 5 consecutive failed attempts, the system triggers immediate forced deletion of all locally stored sensitive data.
- **False-Positive Recovery**: Server-side encrypted versioned backups allow authorized recovery.
- **Zero-Trust Architecture**: Continuous verification, mandatory MFA support, RBAC + ABAC.
- **Audit & Isolation**: Comprehensive logging and strict container isolation (seccomp/AppArmor).

### 4.2 Offline-First Resilience

- Full functionality available during network outages.
- Local persistence via encrypted storage and Docker volumes.
- CRDT foundation implemented for automatic, non-disruptive background synchronization.
- Subtle status indicators only — no workflow disruption.

### 4.3 Global Compliance Standards

Nova is designed for worldwide enterprise adoption:
- GDPR, CCPA/CPRA, ISO 27001/27701, SOC 2.
- Support for DPDP Act (India) and other regional regulations.
- Automated Privacy Impact Assessments and compliance reporting ready.

### 4.4 Resource Efficiency and Accessibility

- Optimized for devices with 4GB RAM or lower.
- **Oracle Always Free compact profile**: ~1.6 GB container RAM budget (12 GB VM).
- Low-data mode with delta synchronization and adaptive streaming.
- Designed for broad accessibility on entry-level hardware and metered/unstable connections.

---

## 5. Implemented Features (Phase 4 Complete)

- Working hours tracker with supervisor visibility.
- Breakout room creation and management.
- Break timer with binaural audio support.
- Light team game module (Memory Match) for break productivity.
- Real-time online users sidebar with status and weather context.
- Supervisor oversight panel with live monitoring.
- Neko streaming integration in workspace pages.
- Security hardening (rate limiting, secure configuration).
- CRDT foundation for offline sync.
- Production deployment guide (`docs/deployment.md`) with Oracle Free Tier quick start.
- Oracle-tuned compose stack, env templates, `deploy/oracle-setup.sh`, and full `deploy/*.sh` script suite.

---

## 6. Workflow

1. User creates or joins a Workspace via the dashboard.
2. Isolated Docker containers are provisioned.
3. Users join via browser for real-time collaboration and streaming.
4. Working hours are automatically tracked.
5. Breakout rooms and break timer are available for team productivity.
6. Supervisor can monitor live status and send feedback.
7. All actions support offline mode with automatic sync.

---

## 7. Strengths & Unique Value

- Eliminates AI collaboration friction by placing agents directly in the shared environment.
- Strong privacy and sovereignty through self-hosting.
- Superior developer experience compared to existing cloud tools.
- Designed for global accessibility and enterprise trust.
- Apache-2.0 licensed for maximum community growth.
- Production-ready with security hardening and deployment guides.

---

## 8. Licensing, Updates, and Governance

- **License**: Apache-2.0 – Fully open and free core.
- **Updates**: Built-in notifications and one-click upgrades for Docker Compose.
- **Governance**: Community contributions encouraged with Contributor License Agreement (CLA) for significant changes.

---

## 9. Target Users and Monetization

- **Primary Users**: Indie hackers, AI researchers, development teams, educators, and enterprises seeking private AI collaboration.
- **Growth Strategy**: Open core for rapid adoption via GitHub, LinkedIn, Hugging Face, and X.
- **Monetization**: Core remains free. Revenue from sponsorships, premium support, managed hosting, and enterprise tiers after reaching scale.

---

## 10. Risks & Mitigations

- Loss of coherence across models → Use this charter as prefix in every session.
- Over-scoping → Strict focus on single-host Docker Compose in early phases.
- WebRTC complexity → Started with Neko, production migration path to Selkies ready.
- Security & Privacy risks → Addressed through layered controls and compliance alignment.

---

**This document serves as the single source of truth for the Nova project.**

It integrates the foundational vision with all implemented features up to Phase 4 (Production Readiness), including security, privacy, offline capabilities, compliance, resource efficiency, and accessibility.

---
