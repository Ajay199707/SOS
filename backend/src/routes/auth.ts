import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../db.js';
import { signAccess, signRefresh, verifyRefresh } from '../utils/tokens.js';
import { requireAuth, AuthedRequest } from '../middleware/auth.js';

const router = Router();
const Register = z.object({ email: z.string().email().optional(), phone: z.string().min(6).optional(), password: z.string().min(8), displayName: z.string().min(1).max(80) });
const Login = z.object({ emailOrPhone: z.string().min(3), password: z.string().min(1) });

function hashToken(t: string) { return crypto.createHash('sha256').update(t).digest('hex'); }
function sixDigit() { return String(Math.floor(100000 + Math.random() * 900000)); }

// Rate-limit note: strict per-route limits are applied in app.ts (login 10/min, OTP 5/min).

router.post('/register', async (req, res) => {
  const p = Register.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'VALIDATION', error: p.error.flatten() });
  const { email, phone, password, displayName } = p.data;
  if (!email && !phone) return res.status(400).json({ code: 'CONTACT_REQUIRED', error: 'email or phone required' });
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const r = await query(`INSERT INTO users (email, phone, password_hash, display_name) VALUES ($1,$2,$3,$4) RETURNING id, email, phone, display_name`,
      [email ?? null, phone ?? null, passwordHash, displayName]);
    const user = r.rows[0];
    const access = signAccess({ sub: user.id });
    const refresh = signRefresh({ sub: user.id });
    await query(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2, now() + interval '30 days')`, [user.id, hashToken(refresh)]);
    res.status(201).json({ user, accessToken: access, refreshToken: refresh });
  } catch (e: any) {
    if (String(e.message).includes('duplicate') || String(e.message).includes('unique')) return res.status(409).json({ code: 'ALREADY_REGISTERED', error: 'email or phone already registered' });
    throw e;
  }
});

router.post('/login', async (req, res) => {
  const p = Login.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'VALIDATION', error: p.error.flatten() });
  const r = await query(`SELECT * FROM users WHERE email = $1 OR phone = $1`, [p.data.emailOrPhone]);
  const user = r.rows[0];
  if (!user) return res.status(401).json({ code: 'BAD_CREDENTIALS', error: 'invalid credentials' });
  const ok = await bcrypt.compare(p.data.password, user.password_hash);
  if (!ok) return res.status(401).json({ code: 'BAD_CREDENTIALS', error: 'invalid credentials' });
  const access = signAccess({ sub: user.id });
  const refresh = signRefresh({ sub: user.id });
  await query(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2, now() + interval '30 days')`, [user.id, hashToken(refresh)]);
  res.json({ user: { id: user.id, email: user.email, phone: user.phone, display_name: user.display_name }, accessToken: access, refreshToken: refresh });
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ code: 'VALIDATION', error: 'refreshToken required' });
  try {
    const d: any = verifyRefresh(refreshToken);
    const r = await query(`SELECT * FROM refresh_tokens WHERE user_id=$1 AND token_hash=$2 AND revoked=FALSE AND expires_at > now()`, [d.sub, hashToken(refreshToken)]);
    if (!r.rows.length) return res.status(401).json({ code: 'REFRESH_REVOKED', error: 'refresh revoked or expired' });
    // rotation: revoke old, issue new pair
    await query(`UPDATE refresh_tokens SET revoked=TRUE WHERE token_hash=$1`, [hashToken(refreshToken)]);
    const access = signAccess({ sub: d.sub });
    const next = signRefresh({ sub: d.sub });
    await query(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2, now() + interval '30 days')`, [d.sub, hashToken(next)]);
    res.json({ accessToken: access, refreshToken: next });
  } catch { return res.status(401).json({ code: 'BAD_REFRESH', error: 'invalid refresh' }); }
});

router.post('/logout', requireAuth, async (req: AuthedRequest, res) => {
  const { refreshToken } = req.body || {};
  if (refreshToken) await query(`UPDATE refresh_tokens SET revoked=TRUE WHERE token_hash=$1`, [hashToken(refreshToken)]);
  else await query(`UPDATE refresh_tokens SET revoked=TRUE WHERE user_id=$1`, [req.userId]);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const r = await query(`SELECT id, email, phone, display_name, is_verified, biometric_enabled, privacy_accepted_at, created_at FROM users WHERE id=$1`, [req.userId]);
  res.json(r.rows[0] ?? null);
});

// PATCH /me - profile + biometric flag + privacy acceptance
router.patch('/me', requireAuth, async (req: AuthedRequest, res) => {
  const p = z.object({ displayName: z.string().min(1).max(80).optional(), biometricEnabled: z.boolean().optional(), privacyAccepted: z.boolean().optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'VALIDATION', error: p.error.flatten() });
  if (p.data.displayName) await query(`UPDATE users SET display_name=$1, updated_at=now() WHERE id=$2`, [p.data.displayName, req.userId]);
  if (typeof p.data.biometricEnabled === 'boolean') await query(`UPDATE users SET biometric_enabled=$1 WHERE id=$2`, [p.data.biometricEnabled, req.userId]);
  if (p.data.privacyAccepted) await query(`UPDATE users SET privacy_accepted_at=now() WHERE id=$1`, [req.userId]);
  const r = await query(`SELECT id, email, phone, display_name, is_verified, biometric_enabled, privacy_accepted_at FROM users WHERE id=$1`, [req.userId]);
  res.json(r.rows[0]);
});

// Verification: request 6-digit code (logged in stub, SMS/email in prod), confirm it
router.post('/verify/request', requireAuth, async (req: AuthedRequest, res) => {
  const p = z.object({ channel: z.enum(['email', 'phone']) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'VALIDATION', error: p.error.flatten() });
  const code = sixDigit();
  await query(`INSERT INTO verification_codes (user_id, channel, code_hash, expires_at) VALUES ($1,$2,$3, now() + interval '10 minutes')`, [req.userId, p.data.channel, hashToken(code)]);
  console.log(`[VERIFY-STUB] user=${req.userId} channel=${p.data.channel} code=${code} (wire email/SMS provider here)`);
  res.json({ ok: true, stubHint: 'code logged server-side in stub mode' });
});

router.post('/verify/confirm', requireAuth, async (req: AuthedRequest, res) => {
  const p = z.object({ code: z.string().length(6) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'VALIDATION', error: p.error.flatten() });
  const r = await query(`SELECT * FROM verification_codes WHERE user_id=$1 AND consumed=FALSE AND expires_at > now() ORDER BY created_at DESC LIMIT 1`, [req.userId]);
  const row = r.rows[0];
  if (!row) return res.status(400).json({ code: 'NO_CODE', error: 'no valid code, request a new one' });
  if (row.attempts >= 5) return res.status(429).json({ code: 'TOO_MANY_ATTEMPTS', error: 'too many attempts' });
  await query(`UPDATE verification_codes SET attempts=attempts+1 WHERE id=$1`, [row.id]);
  if (row.code_hash !== hashToken(p.data.code)) return res.status(400).json({ code: 'BAD_CODE', error: 'incorrect code' });
  await query(`UPDATE verification_codes SET consumed=TRUE WHERE id=$1`, [row.id]);
  await query(`UPDATE users SET is_verified=TRUE WHERE id=$1`, [req.userId]);
  await query(`UPDATE trusted_contacts SET verified=TRUE WHERE owner_id=$1`, [req.userId]);
  res.json({ ok: true, verified: true });
});

// Recovery: forgot -> reset (single-use 1h token; in stub logged, in prod emailed)
router.post('/forgot', async (req, res) => {
  const p = z.object({ emailOrPhone: z.string().min(3) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'VALIDATION', error: p.error.flatten() });
  const r = await query(`SELECT id FROM users WHERE email=$1 OR phone=$1`, [p.data.emailOrPhone]);
  if (!r.rows.length) return res.json({ ok: true }); // don't leak existence
  const raw = crypto.randomBytes(32).toString('hex');
  await query(`INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1,$2, now() + interval '1 hour')`, [r.rows[0].id, hashToken(raw)]);
  console.log(`[RESET-STUB] user=${r.rows[0].id} token=${raw} (email this link in prod: /reset?token=...)`);
  res.json({ ok: true });
});

router.post('/reset', async (req, res) => {
  const p = z.object({ token: z.string().min(16), newPassword: z.string().min(8) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'VALIDATION', error: p.error.flatten() });
  const r = await query(`SELECT * FROM password_resets WHERE token_hash=$1 AND consumed=FALSE AND expires_at > now()`, [hashToken(p.data.token)]);
  if (!r.rows.length) return res.status(400).json({ code: 'BAD_TOKEN', error: 'invalid or expired token' });
  const h = await bcrypt.hash(p.data.newPassword, 12);
  await query(`UPDATE users SET password_hash=$1 WHERE id=$2`, [h, r.rows[0].user_id]);
  await query(`UPDATE password_resets SET consumed=TRUE WHERE id=$1`, [r.rows[0].id]);
  await query(`UPDATE refresh_tokens SET revoked=TRUE WHERE user_id=$1`, [r.rows[0].user_id]);
  res.json({ ok: true });
});

// Consents: mic_live, location_share, privacy_policy
router.post('/consents', requireAuth, async (req: AuthedRequest, res) => {
  const p = z.object({ kind: z.enum(['mic_live', 'location_share', 'privacy_policy']), accepted: z.boolean() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'VALIDATION', error: p.error.flatten() });
  await query(`INSERT INTO user_consents (user_id, kind, accepted) VALUES ($1,$2,$3) ON CONFLICT (user_id, kind) DO UPDATE SET accepted=$3, accepted_at=now()`, [req.userId, p.data.kind, p.data.accepted]);
  res.json({ ok: true });
});

router.get('/consents', requireAuth, async (req: AuthedRequest, res) => {
  const r = await query(`SELECT kind, accepted, accepted_at FROM user_consents WHERE user_id=$1`, [req.userId]);
  res.json(r.rows);
});

// Account delete (revocation cascades devices/contacts/sessions)
router.delete('/me', requireAuth, async (req: AuthedRequest, res) => {
  await query(`DELETE FROM users WHERE id=$1`, [req.userId]);
  res.json({ ok: true });
});

export default router;
