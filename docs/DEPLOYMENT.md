# Deployment Guide

## Local
```powershell
cd backend
Copy-Item .env.example .env
npm install
docker compose up -d postgres
npm run migrate
npm run dev
```

## Production (Docker Compose)
- Set strong `JWT_*_SECRET` (32+ chars), real `DATABASE_URL`, `CORS_ORIGIN` to receiver-web domain.
- Provide `FCM_SERVICE_ACCOUNT_PATH` mount + `FCM_STUB=false`, `SMS_PROVIDER=twilio` + Twilio vars, `TURN_SHARED_SECRET` + coturn.
- Run `npm run migrate` on deploy, cron `npm run retention` daily.
- Terminate TLS at reverse proxy (Caddy/Nginx), Postgres volume backups daily.

## Without Docker (current machine has no Docker)
Install Postgres 16 locally, create db `sos_guardian`, set `DATABASE_URL`, run migrate.
