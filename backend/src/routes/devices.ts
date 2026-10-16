import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth, AuthedRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/', async (req: AuthedRequest, res) => {
  const p = z.object({ fcmToken: z.string().min(10), platform: z.string().default('android'), label: z.string().optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const r = await query(`INSERT INTO devices (user_id, fcm_token, platform, label, last_seen_at) VALUES ($1,$2,$3,$4,now()) RETURNING *`,
    [req.userId, p.data.fcmToken, p.data.platform, p.data.label ?? null]);
  res.status(201).json(r.rows[0]);
});

router.get('/', async (req: AuthedRequest, res) => {
  const r = await query(`SELECT * FROM devices WHERE user_id=$1 ORDER BY last_seen_at DESC NULLS LAST`, [req.userId]);
  res.json(r.rows);
});

router.delete('/:id', async (req: AuthedRequest, res) => {
  await query(`DELETE FROM devices WHERE id=$1 AND user_id=$2`, [req.params.id, req.userId]);
  res.json({ ok: true });
});

export default router;
