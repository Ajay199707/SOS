import { useEffect, useRef, useState } from 'react';
import { iceServers, sendSignal } from './api';

// Receiver WebRTC playback (Phase 5): answers sender offer, plays live mic audio only while session active.
// No recording. Reconnects with backoff, adapts via default WebRTC congestion control.
export function AudioPlayer({ sessionId, token, enabled }: { sessionId: string; token: string; enabled: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [state, setState] = useState('IDLE');
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let retries = 0;

    const start = async () => {
      try {
        setState('CONNECTING');
        const { iceServers: servers } = await iceServers(token);
        const pc = new RTCPeerConnection({ iceServers: servers });
        pcRef.current = pc;
        pc.ontrack = (e) => {
          if (audioRef.current) {
            audioRef.current.srcObject = e.streams[0];
            audioRef.current.play().catch(() => {});
          }
          setState('LIVE');
        };
        pc.onconnectionstatechange = () => setState(pc.connectionState.toUpperCase());
        pc.onicecandidate = (e) => {
          if (e.candidate) {
            sendSignal(token, sessionId, 'ice', {
              candidate: e.candidate.candidate,
              sdpMid: e.candidate.sdpMid,
              sdpMLineIndex: e.candidate.sdpMLineIndex,
            }).catch(() => {});
          }
        };
        // NOTE: offer arrives over WS (webrtc-offer). Parent passes it via window event for simplicity.
        const onOffer = async (ev: any) => {
          const sdp = ev.detail?.sdp;
          if (!sdp || ev.detail?.sessionId !== sessionId) return;
          await pc.setRemoteDescription({ type: 'offer', sdp });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal(token, sessionId, 'answer', { sdp: answer.sdp, type: 'answer' });
        };
        window.addEventListener('sos-offer', onOffer);
        return () => window.removeEventListener('sos-offer', onOffer);
      } catch {
        retries++;
        if (!cancelled && retries < 6) setTimeout(start, Math.min(1000 * 2 ** retries, 15000));
        else setState('FAILED');
      }
    };

    const cleanupPromise = start();
    return () => { cancelled = true; cleanupPromise?.then?.((c: any) => c?.()); try { pcRef.current?.close(); } catch {} };
  }, [enabled, sessionId, token]);

  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginTop: 12 }}>
      <div>Audio: <b>{state}</b> {state === 'FAILED' && '(check mic permission on sender, network, TURN)'}</div>
      <audio ref={audioRef} controls muted={muted} style={{ width: '100%', marginTop: 8 }} />
      <button onClick={() => setMuted((m) => !m)}>{muted ? 'Unmute' : 'Mute'}</button>
    </div>
  );
}
