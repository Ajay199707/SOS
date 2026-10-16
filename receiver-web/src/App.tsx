import { useCallback, useEffect, useState } from 'react';
import { ack, getHistory, getSession, login } from './api';
import { useStream } from './useStream';
import { MapView, Loc } from './MapView';
import { AudioPlayer } from './AudioPlayer';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('sos_token'));
  const [email, setEmail] = useState('receiver@test.com');
  const [password, setPassword] = useState('password123');
  const [sessionId, setSessionId] = useState<string>('');
  const [session, setSession] = useState<any>(null);
  const [locations, setLocations] = useState<Loc[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const onEvent = useCallback((e: any) => {
    if (e.type === 'location' && e.sessionId === sessionId) {
      setLocations((prev) => [...prev.slice(-199), {
        lat: e.lat, lon: e.lon, accuracy_m: e.accuracyM,
        recorded_at: new Date().toISOString(), is_stale: e.isStale, provider: e.provider,
      }]);
    } else if (e.type === 'webrtc-offer') {
      window.dispatchEvent(new CustomEvent('sos-offer', { detail: e }));
    } else if (e.type === 'resolved' || e.type === 'state') {
      if (token && sessionId) getSession(token, sessionId).then(setSession).catch(() => {});
    }
  }, [sessionId, token]);

  const { connected } = useStream(sessionId || null, token, onEvent);

  useEffect(() => {
    if (token) getHistory(token).then((h) => setHistory(h.items ?? [])).catch(() => {});
  }, [token]);

  const doLogin = async () => {
    try { const r = await login(email, password); localStorage.setItem('sos_token', r.accessToken); setToken(r.accessToken); setErr(null); }
    catch { setErr('Login failed'); }
  };

  const openSession = async () => {
    if (!token || !sessionId) return;
    try {
      const s = await getSession(token, sessionId);
      setSession(s);
      setLocations((s.locations ?? []).map((l: any) => ({
        lat: l.lat, lon: l.lon, accuracy_m: l.accuracy_m, recorded_at: l.recorded_at, is_stale: l.is_stale, provider: l.provider,
      })));
      setErr(null);
    } catch (e: any) { setErr(e.message); }
  };

  if (!token) {
    return (
      <div style={{ maxWidth: 420, margin: '40px auto', fontFamily: 'sans-serif' }}>
        <h2>SOS Guardian Receiver</h2>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email or phone" style={{ width: '100%', marginBottom: 8 }} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" style={{ width: '100%', marginBottom: 8 }} />
        <button onClick={doLogin}>Login</button>
        {err && <p style={{ color: 'red' }}>{err}</p>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 16, fontFamily: 'sans-serif' }}>
      <h2>Emergency dashboard {connected ? '● live' : '○ offline'}</h2>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={sessionId} onChange={(e) => setSessionId(e.target.value)} placeholder="session UUID" style={{ flex: 1 }} />
        <button onClick={openSession}>Open</button>
        <button onClick={() => { localStorage.removeItem('sos_token'); setToken(null); }}>Logout</button>
      </div>
      {err && <p style={{ color: 'red' }}>{err}</p>}
      {session && (
        <>
          <p><b>State:</b> {session.state} · <b>Since:</b> {new Date(session.created_at).toLocaleString()} · <b>Audio:</b> {session.audio_status}</p>
          <MapView locations={locations} />
          <AudioPlayer sessionId={session.id} token={token} enabled={['ACTIVE', 'DEGRADED'].includes(session.state)} />
          <button style={{ marginTop: 12 }} onClick={() => ack(token, session.id).then(() => alert('Acknowledged — sender sees it'))}>
            Acknowledge emergency
          </button>
        </>
      )}
      <h3>Recent sessions</h3>
      <ul>{history.map((h: any) => <li key={h.id}>{h.state} · {new Date(h.created_at).toLocaleString()} · <code>{h.id.slice(0, 8)}</code></li>)}</ul>
    </div>
  );
}
