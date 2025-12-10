#!/usr/bin/env node

/**
 * Sync Transcripts from Domo
 *
 * 1. Fetches new transcript data from Domo
 * 2. Transforms and imports to transcripts table
 * 3. Runs AI analysis on new transcripts
 * 4. Saves analysis to TranscriptAnalysis table
 *
 * Run hourly via cron to keep data current
 */

import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { DomoAPI } from './domo-api.mjs';
import { analyzeTranscript } from './transcript-analyzer.mjs';

const { Pool } = pg;

// Load environment variables
dotenv.config({ path: '.env.local' });

// Verify required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'DOMO_CLIENT_ID',
  'DOMO_CLIENT_SECRET',
  'DOMO_DATASET_ID',
  'OPENROUTER_API_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ ERROR: ${envVar} not found in environment`);
    process.exit(1);
  }
}

// Initialize database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Initialize Domo API
const domo = new DomoAPI(
  process.env.DOMO_CLIENT_ID,
  process.env.DOMO_CLIENT_SECRET,
  process.env.DOMO_ENVIRONMENT || 'cmgfi'
);

// Statistics
const stats = {
  fetched: 0,
  imported: 0,
  analyzed: 0,
  skipped: 0,
  errors: 0,
  startTime: Date.now()
};

/**
 * Transform Domo record to match our transcripts schema
 */
function transformDomoRecord(domoRecord) {
  // Parse messages JSON if it's a string
  let messages = domoRecord.messages;
  if (typeof messages === 'string') {
    try {
      messages = JSON.parse(messages);
    } catch (e) {
      console.warn(`⚠️  Failed to parse messages for ${domoRecord.vendor_call_key}`);
      messages = null;
    }
  }

  // Parse dates
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  };

  // Parse integers
  const parseInt = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const n = Number(val);
    return isNaN(n) ? null : Math.round(n);
  };

  return {
    vendor_call_key: domoRecord.vendor_call_key || domoRecord.VendorCallKey,
    call_start: parseDate(domoRecord.call_start || domoRecord.CallStart),
    call_end: parseDate(domoRecord.call_end || domoRecord.CallEnd),
    duration_seconds: parseInt(domoRecord.duration_seconds || domoRecord.DurationSeconds),
    disposition: domoRecord.disposition || domoRecord.Disposition || null,
    number_of_holds: parseInt(domoRecord.number_of_holds || domoRecord.NumberOfHolds),
    hold_duration: parseInt(domoRecord.hold_duration || domoRecord.HoldDuration),
    department: domoRecord.department || domoRecord.Department || null,
    status: domoRecord.status || domoRecord.Status || null,
    agent_name: domoRecord.agent_name || domoRecord.AgentName || domoRecord.assigned_agent || null,
    agent_role: domoRecord.agent_role || domoRecord.AgentRole || domoRecord.user_role_name || null,
    agent_profile: domoRecord.agent_profile || domoRecord.AgentProfile || domoRecord.profile_name || null,
    agent_email: domoRecord.agent_email || domoRecord.AgentEmail || domoRecord.agent_email_address || null,
    messages: messages
  };
}

/**
 * Import transcript to database
 */
async function importTranscript(transcript) {
  try {
    await prisma.transcripts.upsert({
      where: { vendor_call_key: transcript.vendor_call_key },
      update: transcript,
      create: transcript
    });
    stats.imported++;
    return true;
  } catch (error) {
    console.error(`❌ Error importing transcript ${transcript.vendor_call_key}:`, error.message);
    stats.errors++;
    return false;
  }
}

/**
 * Check if transcript is already analyzed
 */
async function isAlreadyAnalyzed(vendorCallKey) {
  const existing = await prisma.transcriptAnalysis.findUnique({
    where: { vendorCallKey }
  });
  return !!existing;
}

/**
 * Main sync function
 */
async function syncTranscripts(options = {}) {
  const {
    startDate,
    endDate,
    limit,
    dryRun = false
  } = options;

  console.log('🚀 Starting Domo transcript sync...');
  console.log(`   Date range: ${startDate || 'all'} to ${endDate || 'now'}`);
  console.log(`   Dry run: ${dryRun ? 'YES' : 'NO'}`);
  console.log('');

  try {
    // Step 1: Fetch data from Domo
    console.log('📥 Fetching data from Domo...');
    const domoRecords = await domo.fetchAllRecords(
      process.env.DOMO_DATASET_ID,
      { startDate, endDate, limit }
    );
    stats.fetched = domoRecords.length;
    console.log(`✅ Fetched ${stats.fetched} records from Domo\n`);

    if (stats.fetched === 0) {
      console.log('✅ No new records to process');
      return stats;
    }

    // Step 2: Import to database
    console.log('💾 Importing transcripts to database...');
    for (const domoRecord of domoRecords) {
      if (!domoRecord.vendor_call_key && !domoRecord.VendorCallKey) {
        console.warn('⚠️  Skipping record without vendor_call_key');
        stats.skipped++;
        continue;
      }

      const transcript = transformDomoRecord(domoRecord);

      if (dryRun) {
        console.log('   [DRY RUN] Would import:', transcript.vendor_call_key);
        continue;
      }

      await importTranscript(transcript);

      if (stats.imported % 100 === 0) {
        console.log(`   Imported ${stats.imported} transcripts...`);
      }
    }
    console.log(`✅ Imported ${stats.imported} transcripts\n`);

    // Step 3: Run AI analysis on new transcripts
    console.log('🤖 Running AI analysis on new transcripts...');
    const transcriptsToAnalyze = await prisma.transcripts.findMany({
      where: {
        vendor_call_key: {
          in: domoRecords
            .map(r => r.vendor_call_key || r.VendorCallKey)
            .filter(Boolean)
        }
      }
    });

    for (const transcript of transcriptsToAnalyze) {
      // Skip if already analyzed
      if (await isAlreadyAnalyzed(transcript.vendor_call_key)) {
        stats.skipped++;
        continue;
      }

      if (dryRun) {
        console.log('   [DRY RUN] Would analyze:', transcript.vendor_call_key);
        continue;
      }

      try {
        await analyzeTranscript(transcript, prisma);
        stats.analyzed++;

        if (stats.analyzed % 10 === 0) {
          console.log(`   Analyzed ${stats.analyzed} transcripts...`);
        }
      } catch (error) {
        console.error(`❌ Error analyzing ${transcript.vendor_call_key}:`, error.message);
        stats.errors++;
      }
    }

    console.log(`✅ Analyzed ${stats.analyzed} transcripts\n`);

    // Summary
    const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    console.log('📊 Sync Summary:');
    console.log(`   Fetched:  ${stats.fetched}`);
    console.log(`   Imported: ${stats.imported}`);
    console.log(`   Analyzed: ${stats.analyzed}`);
    console.log(`   Skipped:  ${stats.skipped}`);
    console.log(`   Errors:   ${stats.errors}`);
    console.log(`   Duration: ${elapsed}s`);
    console.log('✅ Sync complete!');

    return stats;

  } catch (error) {
    console.error('❌ Sync failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start-date' && args[i + 1]) {
      options.startDate = args[i + 1];
      i++;
    } else if (args[i] === '--end-date' && args[i + 1]) {
      options.endDate = args[i + 1];
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--dry-run') {
      options.dryRun = true;
    }
  }

  syncTranscripts(options)
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export { syncTranscripts };
