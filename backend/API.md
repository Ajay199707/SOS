# SOS Guardian API (v1)

Base: `http://localhost:4000/v1`

## Auth
- `POST /auth/register` {email?, phone?, password, displayName} -> {user, accessToken, refreshToken}
- `POST /auth/login` {emailOrPhone, password}
- `POST /auth/refresh` {refreshToken} -> {accessToken}
- `POST /auth/logout` (auth) {refreshToken?}
- `GET /auth/me` (auth)

All other endpoints require `Authorization: Bearer <accessToken>`.

## Contacts
- `GET /contacts`, `POST /contacts`, `PUT /contacts/:id`, `DELETE /contacts/:id`

## Devices (FCM)
- `POST /devices` {fcmToken, platform, label?}
- `GET /devices`, `DELETE /devices/:id`

## Emergency sessions (idempotent)
- `POST /sessions` {idempotencyKey (min 8 chars, UUID recommended), contactIds[]} -> 201 or 200 {deduplicated:true}
- `GET /sessions`, `GET /sessions/:id` (owner or authorized participant only, else 403)
- `POST /sessions/:id/location` (sender only) {lat, lon, accuracyM?, speedMps?, bearingDeg?, provider?, isStale?}
- `POST /sessions/:id/ack` (receiver participant)
- `POST /sessions/:id/cancel` (sender only)

## Signaling (WebRTC, authenticated)
- `GET /signaling/ice-servers` -> {iceServers[]} (STUN always, TURN when configured)
- `POST /signaling/:sessionId/offer|answer|ice` (relayed over WS to other party, audit-logged)

## Realtime
- `WS /v1/stream?token=<JWT>&sessionId=<uuid>` events: `connected, location, ack, resolved, webrtc-offer/answer/ice`
- Receiver links: `GET /v1/receiver-link/:sessionId` returns path only — login + server-side session auth still required. No tokens in SMS URLs.

## Errors
`{error: string}` with 400/401/403/404. Rate-limited 200 req/min. UTC timestamps in storage.
