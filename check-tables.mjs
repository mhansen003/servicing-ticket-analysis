import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const result = await pool.query(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
`);

console.log('Tables:');
result.rows.forEach(r => console.log('  -', r.table_name));

await pool.end();
