import { useEffect, useRef, useState } from 'react';
import { streamUrl } from './api';

// WS with backoff reconnect. Events: location | ack | resolved | state | webrtc-offer/answer/ice
export function useStream(sessionId: string | null, token: string | null, onEvent: (e: any) => void) {
  const [connected, setConnected] = useState(false);
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    if (!sessionId || !token) return;
    let ws: WebSocket | null = null;
    let alive = true;
    let delayMs = 1000;
    let timer: any;

    const connect = () => {
      if (!alive) return;
      ws = new WebSocket(streamUrl(sessionId, token));
      ws.onopen = () => { setConnected(true); delayMs = 1000; };
      ws.onmessage = (m) => { try { cb.current(JSON.parse(m.data)); } catch {} };
      ws.onclose = () => {
        setConnected(false);
        if (!alive) return;
        timer = setTimeout(connect, delayMs);
        delayMs = Math.min(delayMs * 2, 15000);
      };
    };
    connect();
    return () => { alive = false; clearTimeout(timer); try { ws?.close(); } catch {} };
  }, [sessionId, token]);

  return { connected };
}
