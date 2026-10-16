import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import auth from './routes/auth.js';
import contacts from './routes/contacts.js';
import sessions from './routes/sessions.js';
import devices from './routes/devices.js';
import signaling from './routes/signaling.js';
import { query } from './db.js';
import { requireAuth, AuthedRequest } from './middleware/auth.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '256kb' }));
  // request timeout 15s
  app.use((req, res, next) => { req.setTimeout(15000); res.setTimeout(15000); next(); });

  const globalLimiter = rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true });
  const loginLimiter = rateLimit({ windowMs: 60_000, max: 10, message: { code: 'RATE_LIMIT', error: 'too many login attempts' } });
  const otpLimiter = rateLimit({ windowMs: 60_000, max: 5, message: { code: 'RATE_LIMIT', error: 'too many OTP requests' } });
  const notifyLimiter = rateLimit({ windowMs: 60_000, max: 5, message: { code: 'RATE_LIMIT', error: 'notify rate limited' } });
  app.use(globalLimiter);

  app.get('/', (_req, res) => {
    res.json({
      name: 'SOS Guardian Backend API',
      status: 'running',
      version: '0.1.0',
      health: '/health',
      webReceiverUrl: config.corsOrigin[0] || 'http://localhost:5173',
      endpoints: {
        auth: '/v1/auth',
        sessions: '/v1/sessions',
        contacts: '/v1/contacts',
        signaling: '/v1/signaling',
        stream: 'ws://localhost:4000/v1/stream'
      }
    });
  });

  app.get('/health', async (_req, res) => {
    try { await query('SELECT 1'); res.json({ ok: true, service: 'sos-guardian-backend', db: 'up' }); }
    catch { res.status(503).json({ ok: false, db: 'down' }); }
  });

  // strict limits on sensitive auth paths (mounted before router via path-specific middleware)
  app.use('/v1/auth/login', loginLimiter);
  app.use('/v1/auth/refresh', loginLimiter);
  app.use('/v1/auth/verify/request', otpLimiter);
  app.use('/v1/auth/forgot', otpLimiter);

  app.use('/v1/auth', auth);
  app.use('/v1/contacts', contacts);
  app.use('/v1/sessions', sessions);
  app.use('/v1/devices', devices);
  app.use('/v1/signaling', signaling);
  // notify limiter applied per-session route
  app.use('/v1/sessions/:id/notify', notifyLimiter);

  // Audit retrieval (owner or participant)
  app.get('/v1/audit/:sessionId', requireAuth, async (req: AuthedRequest, res) => {
    const s = await query(`SELECT * FROM emergency_sessions WHERE id=$1`, [req.params.sessionId]);
    if (!s.rows.length) return res.status(404).json({ code: 'NOT_FOUND', error: 'not found' });
    if (s.rows[0].owner_id !== req.userId) {
      const part = await query(`SELECT 1 FROM session_participants WHERE session_id=$1 AND contact_user_id=$2`, [req.params.sessionId, req.userId]);
      if (!part.rows.length) return res.status(403).json({ code: 'FORBIDDEN', error: 'not authorized' });
    }
    const r = await query(`SELECT * FROM audit_log WHERE session_id=$1 ORDER BY created_at DESC LIMIT 200`, [req.params.sessionId]);
    res.json(r.rows);
  });

  app.get('/v1/receiver-link/:sessionId', (req, res) => {
    res.json({ url: `/s/${req.params.sessionId}`, note: 'Open in receiver app/web; login + session authorization required. No tokens in URL.' });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error(err);
    res.status(500).json({ code: 'INTERNAL', error: 'internal error' });
  });
  return app;
}
