const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://sos@localhost:5433/sos_guardian' });

async function seed() {
  const s = await pool.query("SELECT id FROM users WHERE email='alice@example.com'");
  const r = await pool.query("SELECT id FROM users WHERE email='receiver@test.com'");
  if (!s.rows.length || !r.rows.length) {
    console.error('Users missing');
    process.exit(1);
  }
  const senderId = s.rows[0].id;
  const receiverId = r.rows[0].id;

  await pool.query('DELETE FROM trusted_contacts WHERE owner_id=$1 AND contact_user_id=$2', [senderId, receiverId]);
  const c = await pool.query(
    `INSERT INTO trusted_contacts (owner_id, contact_user_id, display_name, email, phone, can_access_session, notify_push)
     VALUES ($1, $2, 'SOS Receiver', 'receiver@test.com', '+15551234567', true, true)
     RETURNING id`,
    [senderId, receiverId]
  );
  const contactId = c.rows[0].id;

  const sessId = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
  await pool.query(
    `INSERT INTO emergency_sessions (id, owner_id, idempotency_key, state, audio_status)
     VALUES ($1, $2, 'demo-session-key-001', 'ACTIVE', 'ACTIVE')
     ON CONFLICT (id) DO UPDATE SET state='ACTIVE'`,
    [sessId, senderId]
  );

  await pool.query(
    `INSERT INTO session_participants (session_id, contact_id, contact_user_id, notify_status)
     VALUES ($1, $2, $3, 'PENDING')
     ON CONFLICT DO NOTHING`,
    [sessId, contactId, receiverId]
  );

  await pool.query('DELETE FROM location_updates WHERE session_id=$1', [sessId]);
  await pool.query(
    `INSERT INTO location_updates (session_id, lat, lon, accuracy_m, speed_mps, bearing_deg, provider, recorded_at) VALUES
     ($1, 12.9716, 77.5946, 5.2, 1.2, 90.0, 'fused', now() - interval '2 minutes'),
     ($1, 12.9720, 77.5955, 4.8, 2.5, 95.0, 'fused', now() - interval '1 minutes'),
     ($1, 12.9725, 77.5964, 3.5, 3.1, 100.0, 'fused', now())`,
    [sessId]
  );
  await pool.query('UPDATE emergency_sessions SET last_location_at=now() WHERE id=$1', [sessId]);

  console.log('SUCCESS: Demo emergency session seeded:', sessId);
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
