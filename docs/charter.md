# Nova Project Charter

**Version**: 3.1  
**Phase**: Advanced Development (RBAC, Security & Meeting Intelligence)  
**Date**: June 15, 2026  
**Repository**: https://github.com/deaduramilade/nova-workspace  
**License**: Apache-2.0

---

## 1. Project Overview & Vision

**Nova** is an open-source AI-native collaborative browser workspace. It combines Docker container isolation, high-performance WebRTC streaming (Neko), and native AI agents powered by local LLMs.

**Core Idea**: Turn any self-hosted or cloud server into a persistent, multi-user, browser-based workspace where multiple humans and AI agents can simultaneously edit code, design UIs, run applications, and collaborate in real-time inside isolated Docker environments.

Nova delivers a unified experience comparable to “Google Docs + VS Code + Cursor + Figma + Zoom”, but fully private, self-hostable, containerized, and AI-first.

**Current Status (June 2026)**: The project has advanced beyond Phase 4 (Production Readiness). It now includes a mature **Role-Based Access Control (RBAC)** system, **Google Authenticator TOTP (2FA)**, comprehensive audit logging, meeting recording with AI-generated transcripts, and real-time collaboration features.

---

## 2. Key Capabilities

### Core Collaboration Features
- Real-time collaborative browser sessions via WebRTC (Neko)
- Working hours tracker with supervisor visibility and HR reporting
- Breakout rooms for focused team discussions
- Break timer with binaural audio support
- Light team game module for productive breaks
- Personal Profile Settings (PFP upload + LinkedIn, X, Discord linking)
- Mobile View Indicator for users on mobile devices

### Role-Based Access Control (RBAC)
- Five defined roles: **Worker**, **Supervisor**, **HR Personnel**, **Administrator**, and **AI Agent**
- Role change request system with Administrator approval workflow
- Audit logging for all role changes
- Role-based API route guards and middleware
- Pydantic validation for role enums

### Security & Authentication
- JWT authentication with embedded role claims
- Google Authenticator (TOTP) support for login
- MFA enforcement for sensitive administrative actions (role approvals)
- Failed access protection with forced data deletion
- AES-256-GCM encryption for sensitive data

### Meeting & Documentation Intelligence
- Meeting recording initiation
- AI-generated meeting transcripts
- Automated executive meeting report generation
- Automated dissemination of reports via email and workspace group chat to absent participants

### Real-time & Notification Systems
- WebSocket real-time updates for role requests and approvals
- Async email notifications for role change approvals and rejections
- In-app notification system

### Offline & Resource Efficiency
- Offline-first architecture with CRDT synchronization
- Optimized for low-memory and low-data environments
- Production deployment support for Oracle Cloud Always Free Tier

---

## 3. Roles and Responsibilities

| Role                    | Access Level   | Primary Responsibilities                              | AI Assistant      |
|-------------------------|----------------|-------------------------------------------------------|-------------------|
| **Worker**              | Standard       | Daily collaboration and task execution                | Nova Worker       |
| **Supervisor**          | Elevated       | Team oversight, monitoring, and feedback              | Nova Supervisor   |
| **HR Personnel**        | Elevated       | Work log management, attendance, and reporting        | Nova HR           |
| **Administrator**       | Highest        | User management, role governance, and system config   | Nova Admin        |
| **AI Agent**            | Participant    | Collaborative task execution within workspaces        | —                 |

Each role has access to a dedicated, context-aware AI assistant triggered by typing **“Nova”** in the workspace chat.

---

## 4. Design & Architecture

- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS with subtle Glassmorphism
- **Backend**: Python 3.12 + FastAPI + SQLAlchemy + Alembic
- **Streaming**: Neko WebRTC
- **Database**: PostgreSQL + Redis
- **Authentication**: JWT + TOTP (Google Authenticator)
- **Real-time**: WebSocket
- **Deployment**: Docker Compose (with Oracle Cloud Always Free profile)

---

## 5. Security, Privacy, Compliance, and Governance

### 5.1 Security Framework
- **Data Retention**: 7-day automatic silent deletion for ephemeral data
- **Encryption**: AES-256-GCM with Argon2 key derivation
- **Access Control**: Role-Based Access Control (RBAC) with audit logging
- **Authentication**: JWT with role claims + optional TOTP 2FA
- **MFA Enforcement**: Required for high-privilege actions (role approvals)

### 5.2 Privacy & Compliance
- Designed for GDPR, CCPA/CPRA, ISO 27001/27701, and SOC 2 alignment
- Zero-Trust principles with continuous verification
- Automated Privacy Impact Assessments ready

### 5.3 Governance
- Role change requests require explicit Administrator approval
- All role changes are logged in the Audit Log
- Strong separation between testing role switches and permanent changes

---

## 6. Implemented Features

- Working hours tracker with HR reporting capability
- Breakout rooms and Break Timer with binaural audio
- Light team games for break productivity
- Real-time user presence and Supervisor Oversight Panel
- Full RBAC system with role approval workflow
- Google Authenticator TOTP (2FA) for login and admin actions
- Meeting recording with AI-generated transcripts and executive reports
- WebSocket real-time updates and async email notifications
- Profile Settings with social account linking
- Dedicated HR Workspace and Admin Dashboard
- Production-ready deployment configurations (including Oracle Free Tier)

---

## 7. Workflow

1. User authenticates with optional TOTP 2FA.
2. Users operate within defined roles with specific permissions.
3. Role changes require Administrator approval (with TOTP verification).
4. All role changes are recorded in the Audit Log.
5. Users and AI agents collaborate inside isolated Docker workspaces.
6. Meetings can be recorded with AI-generated transcripts and reports.
7. Reports are automatically distributed to absent participants via email and workspace chat.
8. All actions support offline mode with CRDT synchronization.

---

## 8. Strengths & Unique Value

- Strong **governance and accountability** through RBAC, audit logging, and approval workflows
- **Context-aware AI assistance** tailored to each user’s role
- Secure and automated **meeting documentation** with transcription and distribution
- Privacy-first, self-hostable architecture
- Production-ready security (TOTP + RBAC + Audit Logging)
- Designed for both enterprise compliance and agile team collaboration

---

## 9. Licensing, Updates, and Governance

- **License**: Apache-2.0 – Fully open core
- **Updates**: One-click Docker Compose upgrades supported
- **Governance**: Community contributions encouraged with CLA for significant changes

---

## 10. Target Users and Monetization

- **Primary Users**: Development teams, AI researchers, enterprises, educational institutions, and remote/hybrid teams
- **Growth Strategy**: Open core via GitHub, LinkedIn, Hugging Face, and X
- **Monetization**: Core remains free. Revenue from sponsorships, premium support, and enterprise tiers

---

## 11. Risks & Mitigations

- Loss of project coherence → This charter is used as the single source of truth
- Security & compliance risks → Addressed through RBAC, TOTP, audit logging, and layered controls
- Over-scoping → Strict focus on core collaboration, governance, and meeting intelligence

---

**This document serves as the single source of truth for the Nova Workspace project.**

This integrates the original vision with all implemented features, including advanced Role-Based Access Control, Two-Factor Authentication, meeting intelligence, and real-time governance capabilities.