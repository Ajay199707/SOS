# Architecture

```
[sender-app Kotlin/Compose] --HTTPS/WS--> [backend Express+TS+PG] <--HTTPS/WS--> [receiver-app / receiver-web React]
        | FCM push                                    | WebRTC signaling (STUN/TURN), no media relay
        +-- foreground mic service + FusedLocation --> live audio (WebRTC P2P/SFU) + location every ~5s
```

Key decisions:
- Backend is Express+TS modular (auth/contacts/sessions/devices/signaling) — satisfies "NestJS or equivalent".
- Postgres schema in `backend/migrations/001_init.sql`: users, refresh_tokens, devices, trusted_contacts, emergency_sessions (idempotency_key unique per owner), session_participants, location_updates, delivery_receipts, audit_log.
- Idempotent SOS: `POST /sessions {idempotencyKey}` returns existing on retry — no duplicate sessions.
- Auth: bcrypt + short-lived JWT access + revocable refresh. Session read restricted to owner or participant (IDOR protection).
- Realtime: `WS /v1/stream` per-session rooms, auth on upgrade. WebRTC media never goes through WS.
- Privacy: no audio stored by default, location retention 30d, no tokens in SMS links.
