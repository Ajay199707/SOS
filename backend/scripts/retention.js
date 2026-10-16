const { Pool } = require('pg');
require('dotenv').config();
// Deletes location points older than LOCATION_RETENTION_DAYS. Keeps session metadata.
(async () => {
  const days = parseInt(process.env.LOCATION_RETENTION_DAYS || '30', 10);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const r = await pool.query(`DELETE FROM location_updates WHERE recorded_at < now() - ($1 || ' days')::interval`, [String(days)]);
  console.log(`retention: deleted ${r.rowCount} location points older than ${days}d`);
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
