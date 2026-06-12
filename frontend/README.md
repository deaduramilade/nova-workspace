# Nova Frontend

**The browser UI for Nova** — the AI-native collaborative workspace.

This directory contains the Next.js frontend for [Nova](https://github.com/deaduramilade/nova-workspace): a real-time, multi-user, browser-based environment where humans and AI agents collaborate inside isolated Docker containers via WebRTC (Neko) streaming.

## Responsibilities

The frontend delivers the full user experience defined in the [Project Charter](https://github.com/deaduramilade/nova-workspace/blob/main/docs/charter.md):

- **Workspace dashboard & management** — create/join persistent or ephemeral workspaces
- **Neko WebRTC streaming** — high-performance live browser viewport inside the workspace page with toolbar and controls
- **Real-time presence & status** — live online users sidebar, status indicators, contextual information
- **Productivity tools**:
  - Working hours tracker (visible to supervisors)
  - Break timer with binaural audio support
  - Breakout rooms for focused sub-discussions
  - Light team games (Memory Match, etc.) for productive breaks
- **Supervisor tools** — live oversight panel, feedback, monitoring
- **Collaboration primitives** — chat, calls, presence
- **Offline resilience** — CRDT-based synchronization engine with background delta sync and subtle status
- **Glassmorphism design** — polished, accessible, PWA-ready interface using Tailwind + custom components and contexts

All realtime features are powered by WebSocket contexts (`PresenceContext` / `RealtimeContext`, `Phase3Context` + custom CRDT in `lib/crdt`).

## Tech Stack

- Next.js (App Router) + React + TypeScript
- Tailwind CSS v4 + PostCSS
- Custom state: React Context + hooks for sockets, CRDT sync, presence
- Networking: axios + native WebSocket / socket hooks
- UI: react-hot-toast, custom modals (BreakoutRoomModal, BreakTimerModal, etc.), specialized panels (WorkingHoursPanel, SupervisorLiveTools, NekoStatusPanel, PresenceStatusBar…)
- Build: standalone output for efficient Docker runtime (see `Dockerfile`)

## Getting Started (Local Development)

The frontend is designed to run alongside the Nova backend and supporting services.

### Prerequisites
- Node.js 20+
- Running backend (FastAPI on port 8000 by default)
- Core infrastructure (Postgres, Redis, Neko) — see root instructions

### Run the frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at http://localhost:3000 and expects the backend at the URL configured via `NEXT_PUBLIC_API_URL` (and WS equivalent).

### Full local environment (from repo root)

```bash
# Start Postgres + Redis + Neko
./deploy/local-dev.sh up     # or .\deploy\local-dev.ps1 up on Windows

# Terminal 1: Backend
cd Backend
uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev
```

See the root [README.md](../README.md) and [docs/deployment.md](../docs/deployment.md) for complete setup, environment variables, and production builds.

## Production Build & Docker

The included `Dockerfile` produces a minimal standalone Next.js image:

- Multi-stage build (deps → builder → runner)
- Requires build-time args: `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`
- Tuned with memory limits for Oracle compact profiles
- Healthcheck and non-root user

Production deploys are normally orchestrated via the root Docker Compose profiles and `deploy/deploy.sh` (Nginx reverse proxy in front of both backend and frontend).

## Scripts

- `npm run dev` — development server with hot reload
- `npm run build` — production build
- `npm run start` — run the production server locally
- `npm run lint` — ESLint

## Project Structure Highlights

- `app/` — Next.js App Router routes (workspace, breakout-room, calls, game, presence, supervisor, login/register, etc.)
- `components/` — Reusable UI (PresenceUserRow, SupervisorLiveTools, ChatPanel, BreakoutRoomModal, WorkingHoursPanel, NekoStatusPanel, etc.)
- `contexts/` — Realtime state (ChatContext, CallContext, PresenceContext/RealtimeContext, Phase3Context for CRDT + supervisor)
- `hooks/` — Socket hooks (`useCallSocket`, `useChatSocket`, `useRealtimeSocket`, `useNetworkStatus`)
- `lib/` — Core logic:
  - `api.ts`, `chatTypes.ts`, `presenceTypes.ts`, `workspaceTypes.ts`, `supervisorTypes.ts`, etc.
  - `crdt/` — Offline sync engine and types
  - `binauralAudio.ts`, `breakoutRooms.ts`, `workingHours.ts`
- `public/` — Static assets (SVGs, favicon)

## Links

- **Main project README & Quick Start**: [../README.md](../README.md)
- **Project Charter** (single source of truth): [../docs/charter.md](../docs/charter.md)
- **Deployment Guide**: [../docs/deployment.md](../docs/deployment.md)
- **Architecture**: [../docs/architecture.md](../docs/architecture.md)

## Contributing

Frontend changes should stay aligned with the Charter vision and the overall system architecture. Prefer pure TypeScript/React patterns, keep bundle size conscious for the low-resource target, and ensure graceful offline behavior.

---

Part of the **Nova** project — Apache-2.0 licensed. See root [LICENSE](../LICENSE) and [README.md](../README.md).
