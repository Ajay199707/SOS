# Receiver Web — SOS Guardian (Phases 4-5)

Live GPS visualization + WebRTC audio playback against the same backend.

## Run
```powershell
cd receiver-web
Copy-Item .env.example .env   # VITE_BACKEND_URL=http://localhost:4000
npm install
npm run dev                   # http://localhost:5173
```

Login as the trusted contact's registered user, paste session UUID, Open.
- Map: Leaflet + OSM, route polyline, accuracy circle, LIVE (red) vs STALE (gray) badge, Directions link.
- Audio: `AudioPlayer` answers sender offer over `/signaling`, plays `<audio>` with mute, reconnects with backoff.
- WS `useStream` auto-reconnects; `ack` notifies sender.

Verified: `tsc --noEmit` clean, `vite build` succeeds.
