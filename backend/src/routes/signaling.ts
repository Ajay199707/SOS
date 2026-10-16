import { Router } from 'express';
import crypto from 'crypto';
import { config } from '../config.js';
import { requireAuth, AuthedRequest } from '../middleware/auth.js';
import { query } from '../db.js';

import { isUuid } from '../utils/tokens.js';

const router = Router();
router.use(requireAuth);

router.param('sessionId', (req, res, next, id) => {
  if (!isUuid(id)) return res.status(404).json({ code: 'NOT_FOUND', error: 'session not found' });
  next();
});

function timeLimitedTurn() {
  // If TURN_SHARED_SECRET set, generate time-limited credentials (coturn static-auth-secret).
  // username = expiry:userid, password = HMAC-SHA1(secret, username)
  if (config.turnSharedSecret && config.turnUrls.length) {
    const expiry = Math.floor(Date.now() / 1000) + 86400;
    const username = `${expiry}:sos`;
    const hmac = crypto.createHmac('sha1', config.turnSharedSecret).update(username).digest('base64');
    return [{ urls: config.turnUrls, username, credential: hmac, ttl: 86400 }];
  }
  if (config.turnUrls.length && config.turnUsername && config.turnCredential) {
    return [{ urls: config.turnUrls, username: config.turnUsername, credential: config.turnCredential }];
  }
  return [];
}

// GET /signaling/ice-servers - STUN + time-limited TURN
router.get('/ice-servers', async (_req: AuthedRequest, res) => {
  const servers: any[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] }, ...timeLimitedTurn()];
  res.json({ iceServers: servers });
});

router.post('/:sessionId/:kind', async (req: AuthedRequest, res) => {
  const { sessionId, kind } = req.params;
  if (!['offer', 'answer', 'ice'].includes(kind)) return res.status(400).json({ code: 'VALIDATION', error: 'invalid kind' });
  const s = await query(`SELECT * FROM emergency_sessions WHERE id=$1`, [sessionId]);
  if (!s.rows.length) return res.status(404).json({ code: 'NOT_FOUND', error: 'session not found' });
  const session = s.rows[0];
  const isOwner = session.owner_id === req.userId;
  if (!isOwner) {
    const part = await query(`SELECT * FROM session_participants sp JOIN trusted_contacts tc ON tc.id=sp.contact_id WHERE sp.session_id=$1 AND sp.contact_user_id=$2 AND tc.can_access_session=TRUE`, [sessionId, req.userId]);
    if (!part.rows.length) return res.status(403).json({ code: 'FORBIDDEN', error: 'not authorized for audio in this session' });
  }
  if (['RESOLVED', 'FAILED'].includes(session.state)) return res.status(409).json({ code: 'SESSION_CLOSED', error: 'session closed' });
  (global as any).__broadcast?.(sessionId, { type: `webrtc-${kind}`, sessionId, from: req.userId, payload: req.body }, req.userId);
  await query(`INSERT INTO audit_log (actor_id, session_id, action, meta) VALUES ($1,$2,$3,$4)`, [req.userId, sessionId, `webrtc.${kind}`, { kind }]);
  res.json({ ok: true });
});

export default router;
