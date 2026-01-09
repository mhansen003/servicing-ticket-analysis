#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';
import { DomoAPI } from './scripts/domo-api.mjs';
import { analyzeTranscriptBatch } from './scripts/transcript-analyzer.mjs';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const domo = new DomoAPI(
  process.env.DOMO_CLIENT_ID,
  process.env.DOMO_CLIENT_SECRET,
  process.env.DOMO_ENVIRONMENT || 'cmgfi'
);

const stats = {
  fetched: 0,
  imported: 0,
  analyzed: 0,
  skipped: 0,
  errors: 0
};

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

function transformDomoRecord(domoRecord) {
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

  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  };

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
    console.error(`❌ Error importing ${transcript.vendor_call_key}:`, error.message);
    stats.errors++;
    return false;
  }
}

async function isAlreadyAnalyzed(vendorCallKey) {
  const existing = await prisma.transcriptAnalysis.findUnique({
    where: { vendorCallKey }
  });
  return !!existing;
}

async function sync() {
  try {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║     Manual Sync: Dec 11-15, 2025                      ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');

    console.log('📥 Fetching data from DOMO...');
    const domoRecords = await domo.exportDatasetFull(process.env.DOMO_DATASET_ID, {
      startDate: '2025-12-11',
      endDate: '2025-12-15'
    });

    stats.fetched = domoRecords.length;
    console.log(`✅ Fetched ${stats.fetched} records\n`);

    console.log('💾 Importing to database...');
    for (const domoRecord of domoRecords) {
      if (!domoRecord.VendorCallKey) {
        stats.skipped++;
        continue;
      }

      const transcript = transformDomoRecord(domoRecord);
      await importTranscript(transcript);

      if (stats.imported % 100 === 0) {
        console.log(`   Imported ${stats.imported}...`);
      }
    }
    console.log(`✅ Imported ${stats.imported} transcripts\n`);

    console.log('🤖 Running AI analysis...');
    const transcriptsToAnalyze = await prisma.transcripts.findMany({
      where: {
        vendor_call_key: {
          in: domoRecords.map(r => r.VendorCallKey).filter(Boolean)
        }
      }
    });

    const needsAnalysis = [];
    for (const transcript of transcriptsToAnalyze) {
      if (await isAlreadyAnalyzed(transcript.vendor_call_key)) {
        stats.skipped++;
      } else {
        needsAnalysis.push(transcript);
      }
    }

    if (needsAnalysis.length > 0) {
      console.log(`   Analyzing ${needsAnalysis.length} transcripts...`);
      const { results, errors } = await analyzeTranscriptBatch(needsAnalysis, prisma, {
        maxConcurrent: 20,
        onProgress: (processed, total) => {
          if (processed % 50 === 0 || processed === total) {
            console.log(`   Analyzed ${processed}/${total}...`);
          }
        }
      });

      stats.analyzed = results.length;
      stats.errors += errors.length;
    }

    console.log(`✅ Analyzed ${stats.analyzed} transcripts\n`);

    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║              Sync Complete                             ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log(`   Fetched:      ${stats.fetched}`);
    console.log(`   Imported:     ${stats.imported}`);
    console.log(`   Analyzed:     ${stats.analyzed}`);
    console.log(`   Skipped:      ${stats.skipped}`);
    console.log(`   Errors:       ${stats.errors}`);
    console.log('');

  } catch (error) {
    console.error('❌ Sync failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

sync();
