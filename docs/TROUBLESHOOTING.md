# Troubleshooting

- `ECONNREFUSED 5432`: Postgres not running. Start Docker `postgres` service or local Postgres, check `DATABASE_URL`.
- `invalid or expired token`: access is 15m. Call `POST /v1/auth/refresh`.
- `refresh revoked`: logged out. Login again.
- `403 not authorized for session`: receiver must login as the contact's registered user (matched by phone/email) and be participant with `can_access_session`.
- `FCM-STUB` logs: set `FCM_SERVICE_ACCOUNT_PATH` + `FCM_STUB=false` + install `firebase-admin` for real push.
- WS closes 4401/4403/4404: bad token, not participant, or bad sessionId. Re-login, check `sessionId`.
- `TSC error firebase-admin`: optional dep, stub mode doesn't need it. Install only for prod.
- Android mic/GPS background stops: test on physical device, grant Allow-all-the-time location + mic, disable battery optimization, foreground service notification must stay.
