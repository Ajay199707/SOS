const BASE = (import.meta.env.VITE_BACKEND_URL as string) || 'http://localhost:4000';

export function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function login(emailOrPhone: string, password: string) {
  const r = await fetch(`${BASE}/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrPhone, password }),
  });
  if (!r.ok) throw new Error('login failed');
  return r.json() as Promise<{ accessToken: string; refreshToken: string; user: any }>;
}

export async function getSession(token: string, id: string) {
  const r = await fetch(`${BASE}/v1/sessions/${id}`, { headers: authHeaders(token) });
  if (r.status === 403) throw new Error('Not authorized for this session');
  if (!r.ok) throw new Error('session fetch failed');
  return r.json();
}

export async function getHistory(token: string) {
  const r = await fetch(`${BASE}/v1/sessions/history?limit=20`, { headers: authHeaders(token) });
  if (!r.ok) throw new Error('history failed');
  return r.json();
}

export async function ack(token: string, id: string) {
  const r = await fetch(`${BASE}/v1/sessions/${id}/ack`, { method: 'POST', headers: authHeaders(token) });
  if (!r.ok) throw new Error('ack failed');
  return r.json();
}

export async function iceServers(token: string) {
  const r = await fetch(`${BASE}/v1/signaling/ice-servers`, { headers: authHeaders(token) });
  return r.json() as Promise<{ iceServers: RTCIceServer[] }>;
}

export async function sendSignal(token: string, sessionId: string, kind: string, payload: any) {
  await fetch(`${BASE}/v1/signaling/${sessionId}/${kind}`, {
    method: 'POST', headers: authHeaders(token), body: JSON.stringify(payload),
  });
}

export function streamUrl(sessionId: string, token: string) {
  return BASE.replace('http', 'ws') + `/v1/stream?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}`;
}
