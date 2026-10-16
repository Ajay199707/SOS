import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createApp } from './app.js';
import { config } from './config.js';
import { verifyAccess, isUuid } from './utils/tokens.js';
import { query } from './db.js';

process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED REJECTION]', err);
});

const app = createApp();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/v1/stream' });

// sessionId -> set of sockets
const rooms = new Map<string, Set<WebSocket>>();

(global as any).__broadcast__ = (sessionId: string, msg: any, excludeUserId?: string) => {
  const set = rooms.get(sessionId);
  if (!set) return;
  const data = JSON.stringify(msg);
  for (const ws of set) {
    if ((ws as any).__userId === excludeUserId) continue;
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
};
// alias used by routes
(global as any).__broadcast = (...a: any[]) => (global as any).__broadcast__(...a);

wss.on('connection', async (ws: any, req) => {
  try {
    const url = new URL(req.url || '', 'http://localhost');
    const token = url.searchParams.get('token') || '';
    const sessionId = url.searchParams.get('sessionId') || '';
    if (!token || !sessionId) return ws.close(4401, 'missing token/sessionId');
    if (!isUuid(sessionId)) return ws.close(4404, 'invalid sessionId');
    const decoded: any = verifyAccess(token);
    const userId = decoded.sub;

    // Authorize: owner or participant with can_access_session
    const s = await query(`SELECT * FROM emergency_sessions WHERE id=$1`, [sessionId]);
    if (!s.rows.length) return ws.close(4404, 'session not found');
    const session = s.rows[0];
    if (session.owner_id !== userId) {
      const part = await query(`SELECT * FROM session_participants sp JOIN trusted_contacts tc ON tc.id=sp.contact_id WHERE sp.session_id=$1 AND sp.contact_user_id=$2 AND tc.can_access_session=TRUE`, [sessionId, userId]);
      if (!part.rows.length) return ws.close(4403, 'forbidden');
    }
    ws.__userId = userId;
    (ws as any).isAlive = true;
    ws.on('pong', () => { (ws as any).isAlive = true; });
    if (!rooms.has(sessionId)) rooms.set(sessionId, new Set());
    rooms.get(sessionId)!.add(ws);
    ws.send(JSON.stringify({ type: 'connected', sessionId }));
    ws.on('close', () => rooms.get(sessionId)?.delete(ws));
  } catch {
    ws.close(4401, 'unauthorized');
  }
});

// heartbeat: drop dead sockets every 30s (reconnect with backoff on clients)
setInterval(() => {
  wss.clients.forEach((ws: any) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(); } catch { /* ignore */ }
  });
}, 30000);

server.listen(config.port, () => console.log(`SOS Guardian backend on :${config.port}`));
