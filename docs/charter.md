# Nova Project Charter

**Version**: 1.1  
**Phase**: 0 – Project Definition & Knowledge Transfer (10% overall progress)  
**Date**: June 02, 2026  
**Repository**: https://github.com/deaduramilade/nova-workspace  
**License**: Apache-2.0

---

## 1. Project Overview & Vision

**Nova** is an open-source AI-native collaborative browser workspace. It combines Docker container isolation, high-performance WebRTC streaming, and native AI agents powered by local LLMs.

**Core Idea**: Turn any self-hosted or cloud server into a persistent, multi-user, browser-based workspace where multiple humans and AI agents can simultaneously edit code, design UIs, run applications, and collaborate in real-time inside isolated Docker environments.

Nova aims to deliver an experience comparable to “Google Docs + VS Code + Cursor + Figma + Zoom”, but fully private, self-hostable, containerized, and AI-first.

---

## 2. Key Capabilities

- Real-time collaborative browser sessions streamed via WebRTC.
- AI agents function as first-class users with their own cursors, voices, and actions.
- Isolated Docker containers for each human and AI participant.
- Persistent storage and environment state across sessions.
- Zero-config onboarding for end users.
- Full support for PyTorch/CUDA workloads when needed.
- Strong offline-first support with seamless synchronization.
- Optimized for low-memory and low-data environments.
- Enterprise-grade security, privacy, and global compliance.

---

## 3. Design & Architecture

- **Frontend**: Modern React/Next.js dashboard with TypeScript and Progressive Web App (PWA) support.
- **Backend**: Python 3.12 with FastAPI for Docker management, user sessions, and AI orchestration.
- **Streaming Layer**: Neko (Phase 1) → Selkies-GStreamer (later phases).
- **AI Layer**: Ollama with custom agent framework (LangGraph/LlamaIndex patterns).
- **Orchestration**: Docker Compose (Phase 1), evolving to Kubernetes.
- **Data Layer**: PostgreSQL for session metadata, Redis for real-time state.
- **Networking**: WebRTC for media streams, WebSocket for signaling and control.

---

## 4. Security, Privacy, Compliance, Resilience, and Accessibility

### 4.1 Security and Privacy Framework
- **Data Retention**: Ephemeral workspace data, session logs, AI interactions, and temporary files are retained for a maximum of **7 days**. Automatic, silent deletion occurs after this period.
- **Encryption**: All sensitive data at rest is protected using **AES-256-GCM** encryption. Keys are derived securely using Argon2 and may leverage hardware-backed storage (TPM).
- **Failed Access Protection**: After **5 consecutive failed decryption or authentication attempts**, the system triggers immediate forced deletion of all locally stored sensitive data.
- **False-Positive Recovery**: Server-side encrypted versioned backups allow authorized recovery through multi-factor verification and role-based approval.
- **PII Controls**: Automated redaction prevents sensitive data from reaching AI agents unless explicitly permitted. Users can define “AI-safe zones”.
- **Zero-Trust Architecture**: Continuous verification for all access. Mandatory MFA. RBAC + ABAC. Senior roles require explicit verification and periodic re-claiming.
- **Audit & Isolation**: Comprehensive logging with strict container isolation (seccomp/AppArmor).

### 4.2 Offline-First Resilience
- Full functionality available during network outages.
- Local persistence via encrypted IndexedDB and Docker volumes.
- Automatic, non-disruptive background synchronization upon reconnection using delta updates and CRDTs.
- Changes propagate to collaborators in near real-time within the 7-day window.

### 4.3 Global Compliance Standards
Nova is designed for worldwide enterprise adoption:
- GDPR, CCPA/CPRA, ISO 27001/27701, SOC 2.
- Support for India’s DPDP Act and other regional regulations.
- Automated Privacy Impact Assessments, audit logs, and compliance reporting.

### 4.4 Resource Efficiency and Accessibility
- **Low-Memory Mode**: Optimized for devices with 4GB RAM or lower (resource caps, lightweight images, quantized models 1B–7B parameters).
- **Low-Data Mode**: Delta synchronization, compression, adaptive WebRTC bitrate, and text-only fallback.
- Automatic detection and optimization based on device and network conditions.

---

## 5. Workflow

1. User creates a new Workspace via the dashboard.
2. Isolated Docker containers are provisioned for all participants.
3. Users and AI agents join for real-time collaboration.
4. All actions are synchronized live (with full offline support).
5. Sessions can be saved, forked, or scheduled.

---

## 6. Strengths & Unique Value

- Eliminates AI collaboration friction by placing agents directly in the shared environment.
- Strong privacy and sovereignty through self-hosting.
- Superior developer experience compared to existing tools.
- Designed for global accessibility, including low-resource regions.
- Fully open-source (Apache-2.0) for maximum community growth.

---

## 7. Licensing, Updates, and Governance

- **License**: Apache-2.0 – Fully open core. Users may freely modify and fork the code.
- **Updates**: Built-in notifications and one-click upgrades for Docker Compose deployments. Optional auto-update configuration.
- **Governance**: Community contributions encouraged via pull requests. Contributor License Agreement (CLA) for major changes.

---

## 8. Target Users and Monetization Strategy

- **Target Users**: Indie hackers, AI researchers, development teams, educators, and enterprises.
- **Growth Strategy**: Open core for rapid adoption targeting hundreds of millions of users.
- **Monetization**: Core remains free. Revenue from sponsorships, partnerships, premium support, managed hosting, and enterprise tiers after reaching significant scale (10M+ users).

---

## 9. Risks & Mitigations

- Loss of project coherence → Use this charter as prefix in every session.
- Over-scoping → Strict single-host Docker Compose focus in Phase 1.
- WebRTC complexity → Start with Neko for simplicity.
- Security & Privacy risks → Addressed through layered controls and compliance.

---

**This document serves as the single source of truth for the Nova project.** All development decisions must align with this charter.

---

**End of Document**