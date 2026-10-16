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
    if (token) {
      getHistory(token)
        .then((h) => {
          const items = h.items ?? [];
          setHistory(items);
          if (items.length > 0 && !session) {
            setSessionId(items[0].id);
            openSession(items[0].id);
          }
        })
        .catch(() => {});
    }
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

  const openSession = async (idToOpen?: string) => {
    const target = (typeof idToOpen === 'string' ? idToOpen : sessionId).trim();
    if (!token) return;
    if (!target) {
      setErr('Please enter a session UUID or select one from the list below');
      return;
    }
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(target)) {
      setErr(`"${target}" is not a valid UUID format (e.g. a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d)`);
      return;
    }
    setSessionId(target);
    try {
      const s = await getSession(token, target);
      setSession(s);
      setLocations((s.locations ?? []).map((l: any) => ({
        lat: l.lat, lon: l.lon, accuracy_m: l.accuracy_m, recorded_at: l.recorded_at, is_stale: l.is_stale, provider: l.provider,
      })));
      setErr(null);
    } catch (e: any) { setErr(e.message || 'Failed to open session'); }
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
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: '#1e293b' }}>
          Emergency Dashboard{' '}
          <span style={{ fontSize: 14, fontWeight: 400, color: connected ? '#16a34a' : '#64748b', marginLeft: 8 }}>
            {connected ? '● live stream connected' : '○ stream offline'}
          </span>
        </h2>
        <button
          onClick={() => { localStorage.removeItem('sos_token'); setToken(null); setSession(null); }}
          style={{ padding: '6px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
        >
          Logout
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          placeholder="Enter session UUID"
          style={{ flex: 1, padding: '8px 10px', borderRadius: 4, border: '1px solid #cbd5e1' }}
        />
        <button
          onClick={() => openSession()}
          style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
        >
          Open
        </button>
      </div>

      {err && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 12px', borderRadius: 6, fontSize: 14, marginBottom: 16 }}>
          {err}
        </div>
      )}

      {session && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, background: '#fff', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
            <span style={{
              padding: '4px 10px', borderRadius: 4, fontSize: 13, fontWeight: 700,
              background: session.state === 'ACTIVE' ? '#fee2e2' : '#f1f5f9',
              color: session.state === 'ACTIVE' ? '#dc2626' : '#475569'
            }}>
              STATUS: {session.state}
            </span>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              Started: {new Date(session.created_at).toLocaleTimeString()}
            </span>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              Audio: <b>{session.audio_status}</b>
            </span>
          </div>

          <div style={{ height: 320, borderRadius: 6, overflow: 'hidden', marginBottom: 14 }}>
            <MapView locations={locations} />
          </div>

          <AudioPlayer sessionId={session.id} token={token} enabled={['ACTIVE', 'DEGRADED'].includes(session.state)} />

          <div style={{ marginTop: 14 }}>
            <button
              style={{ padding: '10px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
              onClick={() => ack(token, session.id).then(() => alert('Emergency acknowledged! The sender has been notified.')).catch((e) => alert(e.message))}
            >
              ✓ Acknowledge Emergency
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 16, color: '#334155' }}>Recent Emergency Sessions</h3>
        {history.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: 14 }}>No sessions found yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((h: any) => (
              <div
                key={h.id}
                onClick={() => { setSessionId(h.id); openSession(h.id); }}
                style={{
                  padding: '10px 14px',
                  background: session?.id === h.id ? '#eff6ff' : '#f8fafc',
                  border: `1px solid ${session?.id === h.id ? '#93c5fd' : '#e2e8f0'}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    marginRight: 8,
                    background: h.state === 'ACTIVE' ? '#fee2e2' : '#f1f5f9',
                    color: h.state === 'ACTIVE' ? '#dc2626' : '#475569'
                  }}>
                    {h.state}
                  </span>
                  <span style={{ fontSize: 13, color: '#334155' }}>
                    {new Date(h.created_at).toLocaleString()}
                  </span>
                </div>
                <code style={{ fontSize: 12, color: '#2563eb' }}>{h.id.slice(0, 8)}...</code>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
