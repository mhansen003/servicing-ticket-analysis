#!/usr/bin/env node

/**
 * Daily DOMO Sync - Delta Only
 *
 * This script:
 * 1. Queries the database for the most recent transcript date
 * 2. Syncs only NEW data from DOMO since that date
 * 3. Never goes back before Dec 1, 2025 (baseline cutoff)
 * 4. Runs AI analysis only on newly imported records
 *
 * Run this script once daily in the morning via cron or scheduler
 */

// CRITICAL: Load environment variables FIRST
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { DomoAPI } from './domo-api.mjs';
import { analyzeTranscriptBatch } from './transcript-analyzer.mjs';

const { Pool } = pg;

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

// BASELINE CUTOFF: Never sync data before this date
const BASELINE_DATE = '2025-12-01';

// Statistics
const stats = {
  fetched: 0,
  imported: 0,
  analyzed: 0,
  skipped: 0,
  errors: 0,
  startTime: Date.now(),
  syncStartDate: null,
  syncEndDate: null
};

/**
 * Decode HTML entities in text
 */
function decodeHtmlEntities(text) {
  if (!text) return text;
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

/**
 * Transform Domo record to match our transcripts schema
 */
function transformDomoRecord(domoRecord) {
  // Parse Conversation JSON
  let messages = null;
  const conversationStr = domoRecord.Conversation;
  if (conversationStr) {
    try {
      const conversation = typeof conversationStr === 'string' ? JSON.parse(conversationStr) : conversationStr;
      if (conversation.conversationEntries && Array.isArray(conversation.conversationEntries)) {
        messages = conversation.conversationEntries.map(entry => ({
          speaker: entry.sender?.role === 'Agent' ? 'agent' : 'customer',
          text: decodeHtmlEntities(entry.messageText || ''),
          timestamp: entry.clientTimestamp || entry.serverReceivedTimestamp || null
        }));
      }
    } catch (e) {
      console.warn(`⚠️  Failed to parse conversation for ${domoRecord.VendorCallKey}`);
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
    vendor_call_key: domoRecord.VendorCallKey,
    call_start: parseDate(domoRecord.CallStartDateTime),
    call_end: parseDate(domoRecord.CallEndDateTime),
    duration_seconds: parseInt(domoRecord.CallDurationInSeconds),
    disposition: domoRecord.CallDispositionServicing || null,
    number_of_holds: parseInt(domoRecord.NumberOfHolds),
    hold_duration: parseInt(domoRecord.CustomerHoldDuration),
    department: domoRecord.Department || null,
    status: domoRecord.VoiceCallStatus || null,
    agent_name: domoRecord.Name || null,
    agent_role: domoRecord.UserRoleName || null,
    agent_profile: domoRecord.ProfileName || null,
    agent_email: domoRecord.Email || null,
    messages: messages
  };
}

/**
 * Import transcript to database (upsert = update if exists, create if new)
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
 * Get the most recent transcript date from the database
 * Returns the date to start syncing from (never before BASELINE_DATE)
 */
async function getLastSyncDate() {
  console.log('📅 Determining sync start date...');

  // Query for the most recent transcript
  const mostRecent = await prisma.transcripts.findFirst({
    orderBy: { call_start: 'desc' },
    select: { call_start: true }
  });

  if (!mostRecent || !mostRecent.call_start) {
    console.log(`   No existing data found. Starting from baseline: ${BASELINE_DATE}`);
    return BASELINE_DATE;
  }

  const lastDate = mostRecent.call_start;
  const baselineDate = new Date(BASELINE_DATE);

  // Use the most recent date, but never go back before baseline
  if (lastDate < baselineDate) {
    console.log(`   Last sync date (${lastDate.toISOString().split('T')[0]}) is before baseline.`);
    console.log(`   Starting from baseline: ${BASELINE_DATE}`);
    return BASELINE_DATE;
  }

  // Format as YYYY-MM-DD for DOMO API
  const startDate = lastDate.toISOString().split('T')[0];
  console.log(`   Last transcript: ${startDate}`);
  console.log(`   Syncing delta since: ${startDate}`);
  return startDate;
}

/**
 * Main delta sync function
 */
async function dailyDeltaSync(options = {}) {
  const {
    dryRun = false,
    useFullExport = true
  } = options;

  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     DOMO Daily Delta Sync - Incremental Updates       ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // Step 1: Determine start date (delta only - from last sync)
    const startDate = await getLastSyncDate();
    stats.syncStartDate = startDate;

    // End date is today
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    stats.syncEndDate = endDate;

    console.log('');
    console.log('🔄 Sync Configuration:');
    console.log(`   Method: ${useFullExport ? 'FULL EXPORT (complete conversations)' : 'SQL Query (truncated)'}`);
    console.log(`   Date range: ${startDate} to ${endDate}`);
    console.log(`   Baseline cutoff: ${BASELINE_DATE} (never sync before this)`);
    console.log(`   Dry run: ${dryRun ? 'YES' : 'NO'}`);
    console.log('');

    // Step 2: Fetch delta data from DOMO
    console.log('📥 Fetching delta from DOMO...');

    let domoRecords;
    if (useFullExport) {
      console.log('   Using FULL EXPORT with streaming to get complete conversation data...');
      domoRecords = await domo.exportDatasetFull(process.env.DOMO_DATASET_ID, {
        startDate,
        endDate
      });
    } else {
      console.log('   Using SQL Query API (may truncate conversations)...');
      domoRecords = await domo.fetchAllRecords(
        process.env.DOMO_DATASET_ID,
        { startDate, endDate }
      );
    }

    stats.fetched = domoRecords.length;
    console.log(`\n✅ Fetched ${stats.fetched} records from DOMO\n`);

    if (stats.fetched === 0) {
      console.log('✨ No new records to process - database is up to date!');
      return stats;
    }

    // Step 3: Import to database (only new records due to upsert)
    console.log('💾 Importing transcripts to database...');
    for (const domoRecord of domoRecords) {
      if (!domoRecord.VendorCallKey) {
        console.warn('⚠️  Skipping record without VendorCallKey');
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

    // Step 4: Run AI analysis on NEW transcripts only
    console.log('🤖 Running AI analysis on new transcripts...');
    const transcriptsToAnalyze = await prisma.transcripts.findMany({
      where: {
        vendor_call_key: {
          in: domoRecords
            .map(r => r.VendorCallKey)
            .filter(Boolean)
        }
      }
    });

    // Filter out already analyzed
    const needsAnalysis = [];
    for (const transcript of transcriptsToAnalyze) {
      if (await isAlreadyAnalyzed(transcript.vendor_call_key)) {
        stats.skipped++;
      } else {
        needsAnalysis.push(transcript);
      }
    }

    if (dryRun) {
      console.log(`   [DRY RUN] Would analyze ${needsAnalysis.length} transcripts`);
    } else if (needsAnalysis.length > 0) {
      // Use batch processing for faster analysis (20 concurrent)
      const concurrency = 20;
      console.log(`   Batch processing ${needsAnalysis.length} transcripts (${concurrency} concurrent)...`);

      const { results, errors } = await analyzeTranscriptBatch(needsAnalysis, prisma, {
        maxConcurrent: concurrency,
        onProgress: (processed, total) => {
          if (processed % 50 === 0 || processed === total) {
            console.log(`   Analyzed ${processed}/${total} transcripts...`);
          }
        }
      });

      stats.analyzed = results.length;
      stats.errors += errors.length;

      if (errors.length > 0) {
        console.log(`\n⚠️  ${errors.length} transcripts failed analysis:`);
        errors.slice(0, 5).forEach(e => {
          console.log(`   - ${e.vendorCallKey}: ${e.error}`);
        });
        if (errors.length > 5) {
          console.log(`   ... and ${errors.length - 5} more`);
        }
      }
    } else {
      console.log('   All fetched transcripts are already analyzed. Skipping AI analysis.');
    }

    console.log(`✅ Analyzed ${stats.analyzed} transcripts\n`);

    // Summary
    const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    console.log('');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║              Daily Sync Summary                        ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log(`   Sync Period:  ${stats.syncStartDate} to ${stats.syncEndDate}`);
    console.log(`   Fetched:      ${stats.fetched} records from DOMO`);
    console.log(`   Imported:     ${stats.imported} new/updated transcripts`);
    console.log(`   Analyzed:     ${stats.analyzed} with AI`);
    console.log(`   Skipped:      ${stats.skipped} (already analyzed)`);
    console.log(`   Errors:       ${stats.errors}`);
    console.log(`   Duration:     ${elapsed}s`);
    console.log('');
    console.log('✅ Daily delta sync complete!');
    console.log('');

    return stats;

  } catch (error) {
    console.error('❌ Daily sync failed:', error);
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
    if (args[i] === '--dry-run') {
      options.dryRun = true;
    }
  }

  dailyDeltaSync(options)
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export { dailyDeltaSync };
