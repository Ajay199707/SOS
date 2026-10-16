# Sender App — SOS Guardian (Phase 3)

## Requires (not present on this machine)
- JDK 17 (you have Java 24 — install Temurin 17 and set `JAVA_HOME`)
- Android Studio Hedgehog+ + SDK 34 + Pixel device (physical for mic/GPS background)
- Backend running: `cd backend; npm run dev` (emulator uses `http://10.0.2.2:4000/`)
- Firebase `google-services.json` in `app/` for FCM

## Build
```powershell
cd sender-app
.\gradlew.bat assembleDebug
adb install app\build\outputs\apk\debug\app-debug.apk
```

## What was implemented
- Compose SOS home: 220dp red button, press-hold 1s, contact checkboxes, readiness GPS/NET/MIC
- `SessionManager`: idempotent activation, session FIRST then parallel location/mic/notify, bounded retry
- `LocationService` (FGS location): 5s FusedLocation, stale handling, local persist on offline
- `MicService` + `SenderAudioClient` (WebRTC): mic AudioSource, P2P offer via `/signaling`, no recording
- `EmergencyScreen`: persistent mode, subsystem status, deliberate 2-tap cancel
- `SosRepository` (Retrofit+Moshi+DataStore tokens), `StreamClient` WS with backoff, `PushService` FCM
- Manifest: location/background/mic/FGS permissions, screen-off compatible

## Honest gaps (need device + creds)
- Untested on real device (no SDK here). Must test screen-off 5min, mic revoked, GPS off, airplane 60s.
- `google-services.json` missing, TURN creds via `/ice-servers`, SFU for >2 receivers still TODO.
