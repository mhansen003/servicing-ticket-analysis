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

// CRITICAL: Load environment variables FIRST, before any other imports
// This ensures all modules can access env vars when they initialize
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Now import other modules - they will see the loaded env vars
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { DomoAPI } from './domo-api.mjs';
import { analyzeTranscript, analyzeTranscriptBatch } from './transcript-analyzer.mjs';

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
  // Parse Conversation JSON - this contains the messages
  let messages = null;
  const conversationStr = domoRecord.Conversation;
  if (conversationStr) {
    try {
      const conversation = typeof conversationStr === 'string' ? JSON.parse(conversationStr) : conversationStr;
      // Extract messages from conversationEntries
      if (conversation.conversationEntries && Array.isArray(conversation.conversationEntries)) {
        messages = conversation.conversationEntries.map(entry => ({
          speaker: entry.sender?.role === 'Agent' ? 'agent' : 'customer',
          text: entry.messageText || '',
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
    startDate = '2025-12-01', // Default: always sync from Dec 1, 2025 to catch any missing records
    endDate,
    limit,
    dryRun = false,
    useFullExport = true // NEW: Use full export to get complete conversations
  } = options;

  console.log('🚀 Starting Domo transcript sync...');
  console.log(`   Date range: ${startDate || 'all'} to ${endDate || 'now'}`);
  console.log(`   Method: ${useFullExport ? 'FULL EXPORT (complete conversations)' : 'SQL Query (truncated)'}`);
  console.log(`   Dry run: ${dryRun ? 'YES' : 'NO'}`);
  console.log('');

  try {
    // Step 1: Fetch data from Domo
    console.log('📥 Fetching data from Domo...');

    let domoRecords;

    if (useFullExport) {
      // Use full dataset export with streaming (gets complete Conversation field, no truncation)
      console.log('   Using FULL EXPORT with streaming to get complete conversation data...');

      // Streaming export with built-in date filtering
      domoRecords = await domo.exportDatasetFull(process.env.DOMO_DATASET_ID, {
        startDate,
        endDate,
        limit
      });

    } else {
      // Use SQL Query API (faster but truncates large text fields at 1024 chars)
      console.log('   Using SQL Query API (may truncate conversations)...');
      domoRecords = await domo.fetchAllRecords(
        process.env.DOMO_DATASET_ID,
        { startDate, endDate, limit }
      );
    }

    stats.fetched = domoRecords.length;
    console.log(`\n✅ Fetched ${stats.fetched} records from Domo\n`);

    if (stats.fetched === 0) {
      console.log('✅ No new records to process');
      return stats;
    }

    // Step 2: Import to database
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

    // Step 3: Run AI analysis on new transcripts
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
      // Use batch processing for faster analysis (20 concurrent to avoid overloading OpenRouter)
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
