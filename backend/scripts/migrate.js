const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql') && f !== 'seed.sql').sort();
  for (const f of files) {
    console.log('applying', f);
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    await pool.query(sql);
  }
  console.log('migrations applied:', files.join(', '));
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
