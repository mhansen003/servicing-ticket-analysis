#!/usr/bin/env node

/**
 * Sync Agent Names from Transcripts to TranscriptAnalysis
 *
 * After backfilling agent_name in the transcripts table,
 * this script syncs those names to the TranscriptAnalysis.agentName field.
 *
 * Safe to run anytime - updates ONLY the agentName field.
 */

import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
const { Pool } = pg;

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const CONFIG = {
  BATCH_SIZE: 100,
  DRY_RUN: false, // Set to true to preview changes
};

const stats = {
  total: 0,
  processed: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
};

/**
 * Sync agent names from transcripts to TranscriptAnalysis
 */
async function syncAgentNames() {
  console.log('🔄 Syncing Agent Names from Transcripts to TranscriptAnalysis\\n');
  console.log('═══════════════════════════════════════════════════════════════════\\n');

  if (CONFIG.DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No database changes will be made\\n');
  } else {
    console.log('⚠️  LIVE MODE - Database will be updated!\\n');
  }

  // Get all analyzed transcripts
  console.log('📊 Loading analyzed transcripts...\\n');
  const analyzed = await prisma.transcriptAnalysis.findMany({
    select: {
      vendorCallKey: true,
      agentName: true,
    }
  });

  console.log(`   Found ${analyzed.length.toLocaleString()} analyzed transcripts\\n`);
  stats.total = analyzed.length;

  // Process in batches
  const batches = [];
  for (let i = 0; i < analyzed.length; i += CONFIG.BATCH_SIZE) {
    batches.push(analyzed.slice(i, i + CONFIG.BATCH_SIZE));
  }

  console.log(`📦 Processing ${batches.length} batches of ${CONFIG.BATCH_SIZE}\\n`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    process.stdout.write(`\\r   Processing batch ${i + 1}/${batches.length}...`);

    for (const analysis of batch) {
      try {
        // Get current agent_name from transcripts table
        const transcript = await prisma.transcripts.findUnique({
          where: { vendor_call_key: analysis.vendorCallKey },
          select: { agent_name: true }
        });

        if (!transcript) {
          stats.skipped++;
          stats.processed++;
          continue;
        }

        const newAgentName = transcript.agent_name || 'Unknown';
        const currentAgentName = analysis.agentName || 'Unknown';

        // Only update if different
        if (newAgentName !== currentAgentName) {
          if (!CONFIG.DRY_RUN) {
            await prisma.transcriptAnalysis.update({
              where: { vendorCallKey: analysis.vendorCallKey },
              data: { agentName: newAgentName }
            });
          }
          stats.updated++;
        } else {
          stats.skipped++;
        }

        stats.processed++;

      } catch (error) {
        stats.errors++;
        console.error(`\\n❌ Error syncing ${analysis.vendorCallKey}:`, error.message);
      }
    }
  }

  console.log('\\n');
}

/**
 * Main execution
 */
async function main() {
  try {
    await syncAgentNames();

    console.log('═══════════════════════════════════════════════════════════════════\\n');
    console.log('✅ SYNC COMPLETE!\\n');
    console.log(`📊 Statistics:`);
    console.log(`   Total analyzed: ${stats.total.toLocaleString()}`);
    console.log(`   Processed: ${stats.processed.toLocaleString()}`);
    console.log(`   Updated: ${stats.updated.toLocaleString()}`);
    console.log(`   Skipped (no change): ${stats.skipped.toLocaleString()}`);
    console.log(`   Errors: ${stats.errors.toLocaleString()}`);

    if (CONFIG.DRY_RUN) {
      console.log(`\\n⚠️  DRY RUN: ${stats.updated.toLocaleString()} records WOULD be updated`);
      console.log(`\\n💡 To apply changes, set CONFIG.DRY_RUN = false in the script`);
    }

    console.log('\\n');

  } catch (error) {
    console.error('\\n❌ Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main().catch(error => {
  console.error('\\n❌ Fatal error:', error);
  prisma.$disconnect();
  process.exit(1);
});
