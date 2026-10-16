import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth, AuthedRequest } from '../middleware/auth.js';
import { sendPush, sendSmsFallback } from '../services/notifications.js';
import { isUuid } from '../utils/tokens.js';

const router = Router();
router.use(requireAuth);

router.param('id', (req, res, next, id) => {
  if (!isUuid(id)) return res.status(404).json({ code: 'NOT_FOUND', error: 'session not found' });
  next();
});

const CreateSession = z.object({ idempotencyKey: z.string().min(8).max(128), contactIds: z.array(z.string().uuid()).min(1) });
const Location = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180), accuracyM: z.number().optional(), speedMps: z.number().optional(), bearingDeg: z.number().optional(), provider: z.string().optional(), isStale: z.boolean().default(false) });
const STATES = ['IDLE', 'ACTIVATING', 'ACTIVE', 'DEGRADED', 'CANCEL_REQUESTED', 'RESOLVED', 'FAILED'] as const;
const TRANSITIONS: Record<string, string[]> = {
  IDLE: ['ACTIVATING'],
  ACTIVATING: ['ACTIVE', 'FAILED'],
  ACTIVE: ['DEGRADED', 'CANCEL_REQUESTED', 'RESOLVED', 'FAILED'],
  DEGRADED: ['ACTIVE', 'CANCEL_REQUESTED', 'RESOLVED', 'FAILED'],
  CANCEL_REQUESTED: ['RESOLVED', 'ACTIVE'],
  FAILED: ['ACTIVATING'],
  RESOLVED: [],
};

async function canRead(sessionId: string, userId: string) {
  if (!isUuid(sessionId)) return { session: null as any, allowed: false };
  const r = await query(`SELECT * FROM emergency_sessions WHERE id=$1`, [sessionId]);
  if (!r.rows.length) return { session: null as any, allowed: false };
  const s = r.rows[0];
  if (s.owner_id === userId) return { session: s, allowed: true };
  const part = await query(`SELECT * FROM session_participants sp JOIN trusted_contacts tc ON tc.id=sp.contact_id WHERE sp.session_id=$1 AND sp.contact_user_id=$2 AND tc.can_access_session=TRUE`, [sessionId, userId]);
  return { session: s, allowed: part.rows.length > 0 };
}

// POST /sessions - idempotent creation
router.post('/', async (req: AuthedRequest, res) => {
  const p = CreateSession.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'VALIDATION', error: p.error.flatten() });
  const existing = await query(`SELECT * FROM emergency_sessions WHERE owner_id=$1 AND idempotency_key=$2`, [req.userId, p.data.idempotencyKey]);
  if (existing.rows.length) return res.json({ ...existing.rows[0], deduplicated: true });
  const s = await query(`INSERT INTO emergency_sessions (owner_id, idempotency_key, state) VALUES ($1,$2,'ACTIVE') RETURNING *`, [req.userId, p.data.idempotencyKey]);
  const session = s.rows[0];
  const c = await query(`SELECT * FROM trusted_contacts WHERE owner_id=$1 AND id = ANY($2)`, [req.userId, p.data.contactIds]);
  if (!c.rows.length) return res.status(400).json({ code: 'NO_VALID_CONTACTS', error: 'no owned contacts matched' });
  for (const contact of c.rows) {
    await query(`INSERT INTO session_participants (session_id, contact_id, contact_user_id, notify_status) VALUES ($1,$2,$3,'PENDING') ON CONFLICT DO NOTHING`, [session.id, contact.id, contact.contact_user_id]);
    await query(`INSERT INTO delivery_receipts (session_id, channel, target, status) VALUES ($1,'push',$2,'QUEUED')`, [session.id, contact.display_name]);
  }
  await query(`INSERT INTO audit_log (actor_id, session_id, action) VALUES ($1,$2,'session.created')`, [req.userId, session.id]);
  res.status(201).json(session);
});

// GET /sessions/history?limit&offset&state - authorized history with pagination
router.get('/history', async (req: AuthedRequest, res) => {
  const limit = Math.min(parseInt(String(req.query.limit || '20'), 10) || 20, 100);
  const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0);
  const state = req.query.state ? String(req.query.state) : null;
  if (state && !STATES.includes(state as any)) return res.status(400).json({ code: 'BAD_STATE', error: 'invalid state' });
  // owner sessions + sessions where user is participant
  const r = await query(
    `SELECT DISTINCT s.* FROM emergency_sessions s LEFT JOIN session_participants sp ON sp.session_id=s.id
     WHERE s.owner_id=$1 OR sp.contact_user_id=$1 ${state ? 'AND s.state=$4' : ''} ORDER BY s.created_at DESC LIMIT $2 OFFSET $3`,
    state ? [req.userId, limit, offset, state] : [req.userId, limit, offset]);
  res.json({ items: r.rows, limit, offset });
});

router.get('/', async (req: AuthedRequest, res) => {
  const r = await query(`SELECT * FROM emergency_sessions WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 50`, [req.userId]);
  res.json(r.rows);
});

router.get('/:id', async (req: AuthedRequest, res) => {
  const { session, allowed } = await canRead(req.params.id, req.userId!);
  if (!session) return res.status(404).json({ code: 'NOT_FOUND', error: 'not found' });
  if (!allowed) return res.status(403).json({ code: 'FORBIDDEN', error: 'not authorized for this session' });
  const loc = await query(`SELECT * FROM location_updates WHERE session_id=$1 ORDER BY recorded_at DESC LIMIT 100`, [req.params.id]);
  const parts = await query(`SELECT sp.*, tc.display_name, tc.phone FROM session_participants sp LEFT JOIN trusted_contacts tc ON tc.id=sp.contact_id WHERE sp.session_id=$1`, [req.params.id]);
  res.json({ ...session, locations: loc.rows.reverse(), participants: parts.rows });
});

router.get('/:id/deliveries', async (req: AuthedRequest, res) => {
  const { session, allowed } = await canRead(req.params.id, req.userId!);
  if (!session) return res.status(404).json({ code: 'NOT_FOUND', error: 'not found' });
  if (!allowed) return res.status(403).json({ code: 'FORBIDDEN', error: 'not authorized' });
  const r = await query(`SELECT * FROM delivery_receipts WHERE session_id=$1 ORDER BY created_at DESC`, [req.params.id]);
  res.json(r.rows);
});

// POST /:id/notify - bounded retry push + SMS fallback (5/min via app.ts limiter)
router.post('/:id/notify', async (req: AuthedRequest, res) => {
  const s = await query(`SELECT * FROM emergency_sessions WHERE id=$1`, [req.params.id]);
  if (!s.rows.length) return res.status(404).json({ code: 'NOT_FOUND', error: 'session not found' });
  if (s.rows[0].owner_id !== req.userId) return res.status(403).json({ code: 'FORBIDDEN', error: 'only sender notifies' });
  const parts = await query(`SELECT sp.*, tc.display_name, tc.phone, tc.notify_sms FROM session_participants sp LEFT JOIN trusted_contacts tc ON tc.id=sp.contact_id WHERE sp.session_id=$1`, [req.params.id]);
  const dev = await query(`SELECT fcm_token FROM devices WHERE user_id=$1`, [req.userId]);
  void dev;
  // notify each participant's devices
  let sent = 0, failed = 0;
  for (const part of parts.rows) {
    if (!part.contact_user_id) continue;
    const tokens = (await query(`SELECT fcm_token FROM devices WHERE user_id=$1`, [part.contact_user_id])).rows.map((d: any) => d.fcm_token).filter(Boolean);
    const results = await sendPush(tokens, 'SOS Emergency', `Emergency session active. Open receiver dashboard.`, { sessionId: req.params.id });
    for (const r of results) {
      const st = (r as any).status === 'DELIVERED' ? 'DELIVERED' : 'QUEUED';
      if (st === 'DELIVERED') sent++; else failed++;
      await query(`INSERT INTO delivery_receipts (session_id, channel, target, status, detail) VALUES ($1,'push',$2,$3,$4)`, [req.params.id, part.display_name ?? part.contact_id, st, JSON.stringify(r).slice(0, 500)]);
    }
    // SMS fallback when configured per-contact (concise, secure link, no tokens)
    if (part.notify_sms && part.phone) {
      const sms = await sendSmsFallback(part.phone, `SOS emergency from your contact. Open receiver app, session ${req.params.id.slice(0, 8)}. Login required.`);
      await query(`INSERT INTO delivery_receipts (session_id, channel, target, status, detail) VALUES ($1,'sms',$2,$3,$4)`, [req.params.id, part.phone, (sms as any).status, 'fallback']);
    }
    await query(`UPDATE session_participants SET notify_status=$1 WHERE session_id=$2 AND contact_id=$3`, [sent > 0 ? 'SENT' : 'PENDING', req.params.id, part.contact_id]);
  }
  res.json({ ok: true, sent, failed });
});

router.post('/:id/location', async (req: AuthedRequest, res) => {
  const p = Location.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'VALIDATION', error: p.error.flatten() });
  const s = await query(`SELECT * FROM emergency_sessions WHERE id=$1`, [req.params.id]);
  if (!s.rows.length) return res.status(404).json({ code: 'NOT_FOUND', error: 'session not found' });
  if (s.rows[0].owner_id !== req.userId) return res.status(403).json({ code: 'FORBIDDEN', error: 'only sender posts location' });
  if (['RESOLVED', 'FAILED'].includes(s.rows[0].state)) return res.status(409).json({ code: 'SESSION_CLOSED', error: 'session closed' });
  const L = p.data;
  if (!L.lat && L.lat !== 0) return res.status(400).json({ code: 'NO_LOCATION', error: 'no coordinates provided' });
  await query(`INSERT INTO location_updates (session_id, lat, lon, accuracy_m, speed_mps, bearing_deg, provider, is_stale) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [req.params.id, L.lat, L.lon, L.accuracyM ?? null, L.speedMps ?? null, L.bearingDeg ?? null, L.provider ?? null, L.isStale]);
  await query(`UPDATE emergency_sessions SET last_location_at=now(), updated_at=now() WHERE id=$1`, [req.params.id]);
  (global as any).__broadcast?.(req.params.id, { type: 'location', sessionId: req.params.id, ...L });
  res.json({ ok: true });
});

// POST /:id/state - enforced state machine (sender only)
router.post('/:id/state', async (req: AuthedRequest, res) => {
  const p = z.object({ to: z.enum(STATES as any), reason: z.string().max(300).optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'VALIDATION', error: p.error.flatten() });
  const s = await query(`SELECT * FROM emergency_sessions WHERE id=$1`, [req.params.id]);
  if (!s.rows.length) return res.status(404).json({ code: 'NOT_FOUND', error: 'not found' });
  if (s.rows[0].owner_id !== req.userId) return res.status(403).json({ code: 'FORBIDDEN', error: 'only sender changes state' });
  const from = s.rows[0].state as string;
  if (!TRANSITIONS[from]?.includes(p.data.to)) return res.status(409).json({ code: 'BAD_TRANSITION', error: `cannot go ${from} -> ${p.data.to}` });
  const ended = ['RESOLVED', 'FAILED'].includes(p.data.to);
  await query(`UPDATE emergency_sessions SET state=$1, degrade_reason=$2, updated_at=now(), ended_at=CASE WHEN $3 THEN now() ELSE ended_at END WHERE id=$4`,
    [p.data.to, p.data.reason ?? null, ended, req.params.id]);
  await query(`INSERT INTO audit_log (actor_id, session_id, action, meta) VALUES ($1,$2,'session.state', $3)`, [req.userId, req.params.id, { from, to: p.data.to } as any]);
  (global as any).__broadcast?.(req.params.id, { type: 'state', sessionId: req.params.id, from, to: p.data.to });
  res.json({ ok: true, from, to: p.data.to });
});

router.post('/:id/ack', async (req: AuthedRequest, res) => {
  const u = await query(`UPDATE session_participants SET ack_at=now(), notify_status='ACKED' WHERE session_id=$1 AND contact_user_id=$2 RETURNING *`, [req.params.id, req.userId]);
  if (!u.rows.length) return res.status(403).json({ code: 'FORBIDDEN', error: 'not a participant' });
  (global as any).__broadcast?.(req.params.id, { type: 'ack', sessionId: req.params.id, userId: req.userId });
  res.json(u.rows[0]);
});

router.post('/:id/cancel', async (req: AuthedRequest, res) => {
  const s = await query(`SELECT * FROM emergency_sessions WHERE id=$1`, [req.params.id]);
  if (!s.rows.length) return res.status(404).json({ code: 'NOT_FOUND', error: 'not found' });
  if (s.rows[0].owner_id !== req.userId) return res.status(403).json({ code: 'FORBIDDEN', error: 'only sender can cancel' });
  await query(`UPDATE emergency_sessions SET state='RESOLVED', ended_at=now(), updated_at=now() WHERE id=$1`, [req.params.id]);
  await query(`INSERT INTO audit_log (actor_id, session_id, action) VALUES ($1,$2,'session.resolved')`, [req.userId, req.params.id]);
  (global as any).__broadcast?.(req.params.id, { type: 'resolved', sessionId: req.params.id });
  res.json({ ok: true });
});

export default router;
