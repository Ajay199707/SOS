import { useCallback, useEffect, useState } from 'react';
import { ack, getHistory, getSession, login, register } from './api';
import { useStream } from './useStream';
import { MapView, Loc } from './MapView';
import { AudioPlayer } from './AudioPlayer';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('sos_token'));
  const [email, setEmail] = useState('receiver@test.com');
  const [password, setPassword] = useState('password123');
  const [displayName, setDisplayName] = useState('SOS Receiver');
  const [isRegistering, setIsRegistering] = useState(false);
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

  const doSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      if (isRegistering) {
        const r = await register(email, password, displayName);
        localStorage.setItem('sos_token', r.accessToken);
        setToken(r.accessToken);
      } else {
        const r = await login(email, password);
        localStorage.setItem('sos_token', r.accessToken);
        setToken(r.accessToken);
      }
    } catch (e: any) {
      setErr(e.message || (isRegistering ? 'Registration failed' : 'Login failed'));
    }
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
      <div style={{ maxWidth: 440, margin: '50px auto', padding: '28px 24px', fontFamily: 'system-ui, -apple-system, sans-serif', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <h2 style={{ marginTop: 0, color: '#1e293b' }}>SOS Guardian Receiver</h2>
        <p style={{ fontSize: 14, color: '#64748b', marginTop: -8 }}>
          {isRegistering ? 'Create a receiver account' : 'Sign in to monitor emergency alerts'}
        </p>

        <form onSubmit={doSubmit}>
          {isRegistering && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Display Name</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="Your Name" style={{ width: '100%', padding: '8px 10px', boxSizing: 'border-box', borderRadius: 4, border: '1px solid #cbd5e1' }} />
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Email or Phone</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="receiver@test.com" style={{ width: '100%', padding: '8px 10px', boxSizing: 'border-box', borderRadius: 4, border: '1px solid #cbd5e1' }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="min 8 chars" style={{ width: '100%', padding: '8px 10px', boxSizing: 'border-box', borderRadius: 4, border: '1px solid #cbd5e1' }} />
          </div>

          <button type="submit" style={{ width: '100%', padding: '10px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer' }}>
            {isRegistering ? 'Register' : 'Login'}
          </button>
        </form>

        {err && <p style={{ color: '#dc2626', fontSize: 14, marginTop: 12 }}>{err}</p>}

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#64748b' }}>
            {isRegistering ? 'Already have an account?' : "Don't have an account?"}
          </span>
          <button type="button" onClick={() => { setIsRegistering(!isRegistering); setErr(null); }} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            {isRegistering ? 'Sign In' : 'Create Account'}
          </button>
        </div>

        <div style={{ marginTop: 14, background: '#f8fafc', padding: '10px 12px', borderRadius: 4, fontSize: 12, color: '#475569' }}>
          <b>Demo Credentials:</b><br />
          Email: <code>receiver@test.com</code><br />
          Password: <code>password123</code>
        </div>
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
