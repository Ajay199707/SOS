# Android Permissions & Device Testing Guide

Request in advance during onboarding, not only after SOS pressed:
1. `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION`, then `ACCESS_BACKGROUND_LOCATION` (Allow all the time).
2. `RECORD_AUDIO` (mic foreground service type).
3. `POST_NOTIFICATIONS` (Android 13+), `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_LOCATION|MICROPHONE`.
4. Disable battery optimization for prolonged emergency (`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` via settings intent).

Test checklist (physical device):
- SOS → Emergency Mode, notification persists, screen-off 5min: location + audio continue.
- Revoke mic mid-session: sender warns, receiver shows audio unavailable, location continues.
- Disable GPS: last-known marked stale, no fabricated coords.
- Airplane mode 60s → restore: bounded retry with backoff, sync resumes.
- Kill process: document that Android may require user to reopen for mic; location FCM wakeup limited by OEM.
