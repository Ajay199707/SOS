# SOS Guardian

Fully operational personal emergency button — sender Android app, receiver Android + web, Node.js backend.

## Structure
- `backend/` — Node.js + TypeScript + Express + PostgreSQL + WebSocket + WebRTC signaling + FCM/SMS stubs. **Implemented (Phase 2 foundation).**
- `sender-app/` — Android Kotlin + Compose MVVM (next: Phase 3).
- `receiver-app/` — Android receiver (next: Phase 8).
- `receiver-web/` — React + TS dashboard (next: Phase 8).
- `docs/` — setup, permissions, deployment, troubleshooting, security.
- `prompt.txt` — original full spec (608 lines).

## Quick start (backend)
```powershell
cd backend
Copy-Item .env.example .env
npm install
# start Postgres (Docker Compose - requires Docker Desktop):
docker compose up -d postgres
npm run migrate
npm run dev
# health: http://localhost:4000/health
```
Without Docker: install Postgres 16 locally, set `DATABASE_URL`, then `npm run migrate`.

## API
See `backend/API.md`. Auth: `POST /v1/auth/register|login|refresh`, `GET /v1/auth/me`.
Sessions are idempotent via `idempotencyKey`. Location: `POST /v1/sessions/:id/location`. Signaling: `/v1/signaling/*`. Stream: `WS /v1/stream?token=&sessionId=`.

## Status
- [x] Phase 1: monorepo skeleton, compose, env examples
- [x] Phase 2 (backend core): auth JWT, contacts, devices, sessions + idempotency, location, ack/cancel, WS broadcast, TURN credential endpoint, audit log
- [ ] Phase 3+: Android sender Emergency Mode, FCM real keys, WebRTC audio, receiver UI, tests on devices

No mocks in production code. Push/SMS run in STUB mode until real FCM/Twilio env vars are provided — clearly logged.
