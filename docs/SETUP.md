# Setup & Installation

## Prereqs
Node 20+, Postgres 16, Android Studio Hedgehog+, JDK 17.

## Backend
```powershell
cd backend
Copy-Item .env.example .env
npm install
docker compose up -d postgres   # requires Docker Desktop; you don't have Docker yet
npm run migrate
npm run dev
```

You currently have: Node v24.11, Java 24, git 2.55. Docker NOT found — install Docker Desktop to run `docker compose up -d postgres`, or install Postgres locally and set DATABASE_URL.

## Sender app (next phase)
Open `sender-app/` in Android Studio, set `BACKEND_URL` in `local.properties`, install FCM `google-services.json`, run on physical device for mic/GPS background tests.

## Receiver web (next phase)
```powershell
cd receiver-web
npm install
npm run dev
```
