import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL_UNPOOLED;

if (!connectionString) {
  console.error('❌ DATABASE_URL_UNPOOLED not found');
  process.exit(1);
}

console.log('🔗 Connecting to Neon...');

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  console.log('✅ Connected to Neon database');

  console.log('📊 Starting ticket import...');

  // Read CSV
  const csvPath = path.join(__dirname, '..', 'data', 'tickets.csv');

  if (!fs.existsSync(csvPath)) {
    console.error('❌ tickets.csv not found at:', csvPath);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  // Filter valid tickets
  const tickets = result.data.filter((ticket) => {
    if (!ticket.ticket_created_at_utc) return false;
    if (String(ticket.ticket_created_at_utc).length > 30) return false;
    if (!String(ticket.ticket_created_at_utc).includes('-')) return false;
    return true;
  });

  console.log(`✅ Found ${tickets.length.toLocaleString()} valid tickets to import`);

  // Clear existing data
  console.log('🗑️  Clearing existing tickets...');
  await client.query('TRUNCATE TABLE tickets RESTART IDENTITY');

  // Import in batches using COPY-like approach with multi-row INSERT
  const BATCH_SIZE = 200;
  const totalBatches = Math.ceil(tickets.length / BATCH_SIZE);
  let imported = 0;

  const parseDate = (val) => {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  const parseIntVal = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const n = Number(val);
    return isNaN(n) ? null : Math.round(n);
  };

  const parseBool = (val) => {
    return val === 'TRUE' || val === 'true' || val === '1' || val === true;
  };

  const escapeStr = (val, maxLen = null) => {
    if (!val) return null;
    let s = String(val).replace(/'/g, "''");
    if (maxLen) s = s.slice(0, maxLen);
    return s;
  };

  for (let i = 0; i < tickets.length; i += BATCH_SIZE) {
    const batch = tickets.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const values = [];
    const placeholders = [];

    batch.forEach((t, idx) => {
      const offset = idx * 38; // 38 columns
      const row = [
        escapeStr(t.ticket_key || t.ticket_id || `ticket-${i + idx}`),
        escapeStr(t.ticket_uuid),
        escapeStr(t.ticket_title, 500),
        escapeStr(t.ticket_description, 5000),
        escapeStr(t.ticket_priority),
        escapeStr(t.ticket_status),
        escapeStr(t.ticket_type),
        escapeStr(t.org_id),
        escapeStr(t.org_name),
        escapeStr(t.org_status_id),
        escapeStr(t.org_status_name),
        escapeStr(t.project_name),
        escapeStr(t.ticket_reporter_email),
        escapeStr(t.ticket_reporter_name),
        escapeStr(t.assigned_user_name),
        escapeStr(t.assigned_user_email),
        parseDate(t.first_response_sent_utc),
        parseIntVal(t.time_to_first_response_in_minutes),
        escapeStr(t.first_responder_email),
        escapeStr(t.first_responder_name),
        parseDate(t.latest_response_sent_utc),
        escapeStr(t.latest_responder_email),
        escapeStr(t.latest_responder_name),
        parseDate(t.due_date_utc),
        parseBool(t.sla_ever_breached),
        parseDate(t.first_sla_breached_at_utc),
        parseDate(t.latest_sla_breached_at_utc),
        parseDate(t.deleted_at),
        escapeStr(t.delete_reason_name),
        parseBool(t.is_ticket_complete),
        parseDate(t.ticket_completed_at_utc),
        parseIntVal(t.time_to_resolution_in_minutes),
        escapeStr(t.assigned_user_email_when_ticket_completed),
        escapeStr(t.assigned_user_name_when_ticket_completed),
        escapeStr(t.ticket_tags),
        escapeStr(t.custom_fields),
        parseDate(t.ticket_created_at_utc) || new Date().toISOString(),
        parseDate(t.ticket_updated_at_utc),
      ];

      values.push(...row);
      const params = row.map((_, j) => `$${offset + j + 1}`).join(', ');
      placeholders.push(`(${params})`);
    });

    const sql = `
      INSERT INTO tickets (
        ticket_key, ticket_uuid, ticket_title, ticket_description,
        ticket_priority, ticket_status, ticket_type,
        org_id, org_name, org_status_id, org_status_name, project_name,
        ticket_reporter_email, ticket_reporter_name,
        assigned_user_name, assigned_user_email,
        first_response_sent_utc, time_to_first_response_in_minutes,
        first_responder_email, first_responder_name,
        latest_response_sent_utc, latest_responder_email, latest_responder_name,
        due_date_utc, sla_ever_breached, first_sla_breached_at_utc, latest_sla_breached_at_utc,
        deleted_at, delete_reason_name,
        is_ticket_complete, ticket_completed_at_utc, time_to_resolution_in_minutes,
        assigned_user_email_when_ticket_completed, assigned_user_name_when_ticket_completed,
        ticket_tags, custom_fields,
        ticket_created_at_utc, ticket_updated_at_utc
      ) VALUES ${placeholders.join(', ')}
      ON CONFLICT (ticket_key) DO NOTHING
    `;

    try {
      await client.query(sql, values);
      imported += batch.length;

      const percent = Math.round((batchNum / totalBatches) * 100);
      process.stdout.write(`\r📦 Importing: ${batchNum}/${totalBatches} batches (${percent}%) - ${imported.toLocaleString()} tickets`);
    } catch (error) {
      console.error(`\n❌ Error in batch ${batchNum}:`, error.message);
      // Try inserting one by one to find the problematic record
    }
  }

  console.log(`\n✅ Import complete!`);

  // Verify count
  const countResult = await client.query('SELECT COUNT(*) FROM tickets');
  console.log(`📊 Total tickets in database: ${parseInt(countResult.rows[0].count).toLocaleString()}`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
