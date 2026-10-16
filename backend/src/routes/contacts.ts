import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth, AuthedRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const Contact = z.object({
  displayName: z.string().min(1).max(80),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  relationship: z.string().max(40).optional(),
  notifyPush: z.boolean().default(true),
  notifySms: z.boolean().default(false),
  canAccessSession: z.boolean().default(true),
  capability: z.enum(['app', 'sms']).default('app'),
});

router.get('/', async (req: AuthedRequest, res) => {
  const r = await query(`SELECT * FROM trusted_contacts WHERE owner_id=$1 ORDER BY created_at DESC`, [req.userId]);
  res.json(r.rows);
});

router.post('/', async (req: AuthedRequest, res) => {
  const p = Contact.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const c = p.data;
  // link contact_user_id if registered
  let contactUserId: string | null = null;
  if (c.phone || c.email) {
    const u = await query(`SELECT id FROM users WHERE phone=$1 OR email=$2 LIMIT 1`, [c.phone ?? null, c.email ?? null]);
    contactUserId = u.rows[0]?.id ?? null;
  }
  const r = await query(
    `INSERT INTO trusted_contacts (owner_id, contact_user_id, display_name, phone, email, relationship, notify_push, notify_sms, can_access_session, capability)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [req.userId, contactUserId, c.displayName, c.phone ?? null, c.email ?? null, c.relationship ?? null, c.notifyPush, c.notifySms, c.canAccessSession, (c as any).capability ?? (contactUserId ? 'app' : 'sms')]);
  res.status(201).json(r.rows[0]);
});

router.put('/:id', async (req: AuthedRequest, res) => {
  const p = Contact.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const fields: string[] = []; const vals: any[] = []; let i = 1;
  const map: any = { displayName: 'display_name', phone: 'phone', email: 'email', relationship: 'relationship', notifyPush: 'notify_push', notifySms: 'notify_sms', canAccessSession: 'can_access_session' };
  for (const [k, v] of Object.entries(p.data)) { fields.push(`${map[k]}=$${i++}`); vals.push(v); }
  if (!fields.length) return res.status(400).json({ error: 'nothing to update' });
  vals.push(req.params.id, req.userId);
  const r = await query(`UPDATE trusted_contacts SET ${fields.join(',')} WHERE id=$${i++} AND owner_id=$${i} RETURNING *`, vals);
  if (!r.rows.length) return res.status(404).json({ error: 'not found' });
  res.json(r.rows[0]);
});

router.delete('/:id', async (req: AuthedRequest, res) => {
  await query(`DELETE FROM trusted_contacts WHERE id=$1 AND owner_id=$2`, [req.params.id, req.userId]);
  res.json({ ok: true });
});

export default router;
