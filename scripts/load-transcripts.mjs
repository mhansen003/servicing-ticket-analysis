#!/usr/bin/env node

/**
 * Load Call Logs into Database
 *
 * Reads tab-delimited call logs file and loads ALL transcripts
 * into the transcripts table for safe storage and future AI analysis
 */

import dotenv from 'dotenv';
import fs from 'fs';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const INPUT_FILE = 'C:\\Users\\Mark Hansen\\Downloads\\Nov 1 to Date Call Logs.txt';

const stats = {
  total: 0,
  loaded: 0,
  skipped: 0,
  failed: 0,
  startTime: Date.now(),
};

/**
 * Parse tab-delimited call logs file
 */
function parseCallLogs(filePath) {
  console.log('📂 Reading call logs file...');
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Parse header
  const headers = lines[0].split('\t');
  const vendorCallKeyIdx = headers.indexOf('VendorCallKey');
  const conversationIdx = headers.indexOf('Conversation');
  const agentNameIdx = headers.indexOf('AgentName');
  const departmentIdx = headers.indexOf('Department');
  const dispositionIdx = headers.indexOf('Disposition');
  const durationIdx = headers.indexOf('DurationInSeconds');
  const callStartIdx = headers.indexOf('CallStartDateTime');

  console.log(`   Found ${lines.length - 1} call logs`);

  const transcripts = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = line.split('\t');

    const vendorCallKey = fields[vendorCallKeyIdx];
    if (!vendorCallKey) continue;

    const conversationJson = fields[conversationIdx];
    let messages = [];

    try {
      const conv = JSON.parse(conversationJson || '{}');
      const entries = conv.conversationEntries || [];

      messages = entries.map(entry => ({
        speaker: entry.sender?.role === 'Agent' ? 'Agent' : 'Customer',
        text: entry.messageText || '',
        timestamp: entry.serverReceivedTimestamp || 0
      }));
    } catch (e) {
      // Skip invalid JSON
      continue;
    }

    if (messages.length === 0) continue;

    transcripts.push({
      vendor_call_key: vendorCallKey,
      agent_name: fields[agentNameIdx] || 'Unknown',
      department: fields[departmentIdx] || 'Unknown',
      disposition: fields[dispositionIdx] || 'Unknown',
      duration_seconds: parseInt(fields[durationIdx]) || 0,
      call_start: fields[callStartIdx] || null,
      messages
    });
  }

  console.log(`   Parsed ${transcripts.length} valid transcripts\n`);
  return transcripts;
}

/**
 * Load transcripts into database
 */
async function loadTranscripts(transcripts) {
  console.log('💾 Loading transcripts into database...\n');

  const batchSize = 100;
  const batches = [];

  for (let i = 0; i < transcripts.length; i += batchSize) {
    batches.push(transcripts.slice(i, i + batchSize));
  }

  console.log(`📦 Processing ${batches.length} batches of ${batchSize}\n`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Batch ${i + 1}/${batches.length}...`);

    for (const t of batch) {
      try {
        await pool.query(`
          INSERT INTO transcripts (
            id, vendor_call_key, call_start, duration_seconds,
            disposition, department, agent_name, messages
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7
          )
          ON CONFLICT (vendor_call_key) DO UPDATE SET
            call_start = EXCLUDED.call_start,
            duration_seconds = EXCLUDED.duration_seconds,
            disposition = EXCLUDED.disposition,
            department = EXCLUDED.department,
            agent_name = EXCLUDED.agent_name,
            messages = EXCLUDED.messages
        `, [
          t.vendor_call_key,
          t.call_start,
          t.duration_seconds,
          t.disposition,
          t.department,
          t.agent_name,
          JSON.stringify(t.messages)
        ]);

        stats.loaded++;
        process.stdout.write(`\r   Progress: ${stats.loaded}/${stats.total} (${((stats.loaded / stats.total) * 100).toFixed(1)}%)`);
      } catch (error) {
        stats.failed++;
        console.error(`\n❌ Error loading ${t.vendor_call_key}:`, error.message);
      }
    }

    console.log('');
  }

  // Verify
  const dbCount = await pool.query('SELECT COUNT(*) FROM transcripts');
  console.log(`\n✅ Database verification: ${dbCount.rows[0].count} total transcripts stored\n`);
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Load Call Logs into Database\n');
  console.log('═══════════════════════════════════\n');

  try {
    // Parse call logs
    const transcripts = parseCallLogs(INPUT_FILE);
    stats.total = transcripts.length;

    // Load into database
    await loadTranscripts(transcripts);

    console.log('═══════════════════════════════════\n');
    console.log('✅ COMPLETE!\n');
    console.log(`📊 Loaded: ${stats.loaded.toLocaleString()}`);
    console.log(`❌ Failed: ${stats.failed.toLocaleString()}`);
    console.log(`⏱️  Time: ${Math.ceil((Date.now() - stats.startTime) / 1000)} seconds\n`);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  pool.end();
  process.exit(1);
});
