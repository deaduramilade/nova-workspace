# Nova Backend API Implementation Plan

**Version**: 1.0  
**Phase**: 1 – Foundation & Initial Setup  
**Date**: June 02, 2026

---

## 1. Backend Technology Stack

- **Language**: Python 3.12
- **Framework**: FastAPI
- **ASGI Server**: Uvicorn
- **Database**: SQLAlchemy 2.0 + Alembic (migrations)
- **Authentication**: JWT + HTTPOnly Cookies + MFA support
- **Background Tasks**: Celery + Redis (for deletion jobs, sync, etc.)

---

## 2. Project Structure (Recommended)

Create the following folder structure inside the `backend/` directory:

---

## 3. Core API Endpoints (Phase 1 Priority)

### Authentication
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/verify-role` → Senior role re-claiming
- `POST /api/v1/auth/mfa/enable`

### Workspaces
- `POST /api/v1/workspaces` → Create workspace
- `GET /api/v1/workspaces`
- `GET /api/v1/workspaces/{workspace_id}`
- `DELETE /api/v1/workspaces/{workspace_id}`

### Sessions
- `POST /api/v1/sessions/start`
- `GET /api/v1/sessions/{session_id}/join`
- `POST /api/v1/sessions/{session_id}/sync` → Offline changes sync

### AI Agents
- `POST /api/v1/agents/invite`
- `POST /api/v1/agents/{agent_id}/task`

### System & Compliance
- `GET /api/v1/health`
- `GET /api/v1/admin/audit-logs`
- `POST /api/v1/admin/recovery` → Data recovery request

---

## 4. Security Implementation (Phase 1)

- JWT authentication with short expiry + refresh tokens
- Password hashing using Argon2
- AES-256-GCM encryption utilities for sensitive data
- Rate limiting on authentication endpoints
- Automatic 7-day data deletion scheduler (background task)
- Failed attempt counter for local data wipe logic

---

## 5. Next Implementation Steps (Recommended Order)

1. Initialize FastAPI project + basic structure
2. Setup database connection (PostgreSQL)
3. Implement Authentication system (JWT + MFA foundation)
4. Create core models (User, Workspace, Session)
5. Implement Workspace CRUD endpoints
6. Add background task for data retention & deletion
7. Integrate encryption utilities

---

## 6. Requirements (`backend/requirements.txt`)

```txt
fastapi==0.115.*
uvicorn[standard]
sqlalchemy==2.0.*
alembic
psycopg2-binary
python-jose[cryptography]
passlib[argon2]
python-multipart
redis
celery[redis]
pydantic==2.*
python-dotenv