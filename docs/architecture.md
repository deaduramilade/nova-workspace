# Nova Architecture Specification

**Version**: 1.0  
**Phase**: 1 – Foundation & Initial Setup  
**Date**: June 02, 2026  
**Status**: Draft

---

## 1. High-Level System Architecture

Nova follows a **modular, containerized microservices** architecture optimized for self-hosting, security, and performance.


### Core Components

| Component              | Technology                  | Purpose                                      | Phase 1 Priority |
|------------------------|-----------------------------|----------------------------------------------|------------------|
| Frontend               | Next.js 15 + React + TypeScript | Dashboard, Session Management, WebRTC Viewer | High |
| Backend                | Python 3.12 + FastAPI       | Orchestration, Auth, Docker Management       | High |
| Database               | PostgreSQL 16               | Session metadata, users, workspaces          | High |
| Cache                  | Redis 7                     | Real-time state, presence, locks             | High |
| Streaming              | Neko (m1k1o/neko)           | Browser streaming (Phase 1)                  | High |
| AI Engine              | Ollama                      | Local LLM agents                             | Medium |
| Orchestration          | Docker Compose              | Container management                         | High |
| Storage                | Docker Volumes + Local FS   | Persistent data                              | High |

---

## 2. Data Models (Core Entities)

### User
- id, username, email, role, mfa_enabled, created_at

### Workspace
- id, name, owner_id, status, created_at, expires_at (7 days for ephemeral)

### Session
- id, workspace_id, user_id, container_id, status, joined_at

### AI Agent
- id, name, model_name, workspace_id, permissions, status

### Container
- id, workspace_id, image, status, resource_limits

---

## 3. API Design (FastAPI)

**Base URL**: `/api/v1`

### Auth & User Management
- `POST /auth/login` – Login + MFA
- `POST /auth/register`
- `POST /auth/verify-role` – Senior role re-claiming

### Workspace Management
- `POST /workspaces` – Create new workspace
- `GET /workspaces` – List user workspaces
- `GET /workspaces/{id}`

### Session & Collaboration
- `POST /sessions/start`
- `GET /sessions/{id}/join` – Returns WebRTC connection details
- `POST /sessions/{id}/sync` – Offline changes sync endpoint

### AI Agent Management
- `POST /agents/invite`
- `POST /agents/task`

### Admin / Compliance
- `GET /admin/audit-logs`
- `POST /admin/recovery/request` – False-positive data recovery

---

## 4. Security Implementation Guidelines

- All API endpoints protected with JWT + MFA where required.
- AES-256-GCM encryption for sensitive local data.
- Automatic 7-day deletion job (background scheduler).
- 5-failed-attempts local data wipe.
- Zero-Trust checks on every critical action.

---

## 5. Resource & Offline Strategy

- Default low-resource profiles in `docker-compose.yml`.
- CRDT-based conflict resolution for offline edits.
- Background delta sync on reconnection.
- Adaptive streaming quality.

---

## 6. Phase 1 Success Criteria

- Successful `docker compose up -d` with all core services running.
- Basic frontend dashboard skeleton.
- Backend API skeleton with key endpoints.
- Neko streaming accessible.
- Ollama running and queryable.
- All security and compliance requirements documented and partially implemented.

---

**End of Architecture Specification**