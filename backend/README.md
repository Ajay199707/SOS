# SOS Guardian Backend

## Scripts
- `npm run dev` - ts-node-dev
- `npm run build` + `npm start` - production
- `npm run migrate` - applies `migrations/*.sql` in order
- `npm run retention` - deletes `location_updates` older than LOCATION_RETENTION_DAYS
- `npm test` - jest

## Env
Copy `.env.example` to `.env`. Required: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
Optional: `TURN_SHARED_SECRET` for time-limited TURN creds, `FCM_SERVICE_ACCOUNT_PATH` for real push.

## State machine
`IDLE → ACTIVATING → ACTIVE ⇄ DEGRADED → CANCEL_REQUESTED → RESOLVED | FAILED`
Enforced in `POST /sessions/:id/state`. Only sender transitions, except receiver `ack`.

## Retention
`npm run retention` (cron daily in prod). Keeps session metadata, deletes old location points.
