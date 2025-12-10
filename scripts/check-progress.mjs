#!/usr/bin/env node

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkProgress() {
  console.log('📊 Checking progress every 5 seconds for 60 seconds...\n');

  for (let i = 0; i < 12; i++) {
    const result = await pool.query('SELECT COUNT(*) FROM transcripts');
    const count = result.rows[0].count;
    const percent = ((count / 26845) * 100).toFixed(1);

    console.log(`[${new Date().toLocaleTimeString()}] Transcripts loaded: ${count.toLocaleString()} / 26,845 (${percent}%)`);

    if (i < 11) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  await pool.end();
  console.log('\n✅ Progress check complete!');
}

checkProgress().catch(error => {
  console.error('Error:', error.message);
  pool.end();
  process.exit(1);
});
