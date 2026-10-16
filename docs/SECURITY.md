# Security & Privacy Notes

- HTTPS/TLS everywhere, `helmet`, CORS allowlist, 256kb JSON limit.
- bcrypt-12 passwords, short-lived JWT access (15m), revocable refresh (30d, sha256 stored).
- Recovery via single-use `password_resets` tokens (1h expiry). OTP verify via `verification_codes` (10min, 5 attempts).
- Session auth: owner OR `session_participants.contact_user_id` with `can_access_session`. All reads/writes check this — no secret-URL-only auth.
- No tokens in SMS URLs. Receiver links require login.
- TURN: time-limited credentials via `TURN_SHARED_SECRET` (HMAC), never hardcoded.
- PII minimization: location retention job deletes old points, audit log for sensitive access, no audio stored.
- Rate limits: global 200/min, auth login 10/min, OTP 5/min, notify 5/min per session.
- Revocation: logout revokes one/all refresh tokens, account delete cascades.
