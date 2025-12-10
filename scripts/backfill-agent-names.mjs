#!/usr/bin/env node

/**
 * Backfill Agent Names Script
 *
 * Extracts agent names from transcript conversation messages
 * and updates the agent_name field in the database.
 *
 * Strategy:
 * 1. Find agent messages in each transcript
 * 2. Check first 3 messages for introduction patterns
 * 3. Check last message for closing patterns
 * 4. Clean and validate extracted names
 * 5. Update database with found names
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

// Configuration
const CONFIG = {
  BATCH_SIZE: 100,
  DRY_RUN: false, // LIVE MODE - will update database
  TEST_LIMIT: null, // Set to a number to limit processing for testing
};

// Statistics
const stats = {
  total: 0,
  processed: 0,
  foundNames: 0,
  notFound: 0,
  updated: 0,
  errors: 0,
};

/**
 * Extract agent name from messages using pattern matching
 */
function extractAgentName(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return null;
  }

  // Get agent messages only
  const agentMessages = messages.filter(m =>
    m.speaker && m.speaker.toLowerCase() === 'agent'
  );

  if (agentMessages.length === 0) {
    return null;
  }

  // Improved patterns with better name capture
  const patterns = [
    // Introduction patterns (check first 3 messages)
    {
      regex: /(?:my name is|i'?m|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      type: 'introduction',
      priority: 1
    },
    // Closing patterns (check last message)
    {
      regex: /(?:this was|was)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:on the phone|calling|with)/i,
      type: 'closing',
      priority: 2
    },
    // Speaking pattern
    {
      regex: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+speaking/i,
      type: 'speaking',
      priority: 3
    },
  ];

  let foundName = null;
  let bestPriority = Infinity;

  // Check first 3 agent messages for introduction
  const firstMessages = agentMessages.slice(0, 3);
  for (const msg of firstMessages) {
    for (const { regex, type, priority } of patterns) {
      if (type !== 'closing') { // Skip closing patterns for intro
        const match = msg.text.match(regex);
        if (match && priority < bestPriority) {
          let name = match[1].trim();
          // Clean up common suffixes
          name = name.replace(/\s+(from|speaking|with|at)$/i, '').trim();

          // Validate name (should be 2-30 chars, letters and spaces only)
          if (name.length >= 2 && name.length <= 30 && /^[A-Za-z\s]+$/.test(name)) {
            foundName = name;
            bestPriority = priority;
          }
        }
      }
    }
  }

  // If not found, check last message for closing
  if (!foundName && agentMessages.length > 0) {
    const lastMsg = agentMessages[agentMessages.length - 1];
    for (const { regex, type, priority } of patterns) {
      if (type === 'closing') {
        const match = lastMsg.text.match(regex);
        if (match) {
          let name = match[1].trim();
          name = name.replace(/\s+(from|speaking|with|at)$/i, '').trim();

          if (name.length >= 2 && name.length <= 30 && /^[A-Za-z\s]+$/.test(name)) {
            foundName = name;
            break;
          }
        }
      }
    }
  }

  return foundName;
}

/**
 * Process a batch of transcripts
 */
async function processBatch(transcripts) {
  const updates = [];

  for (const transcript of transcripts) {
    try {
      const agentName = extractAgentName(transcript.messages);

      if (agentName) {
        stats.foundNames++;
        updates.push({
          vendorCallKey: transcript.vendor_call_key,
          agentName,
          oldName: transcript.agent_name
        });
      } else {
        stats.notFound++;
      }

      stats.processed++;
    } catch (error) {
      stats.errors++;
      console.error(`Error processing ${transcript.vendor_call_key}:`, error.message);
    }
  }

  // Update database (if not dry run)
  if (!CONFIG.DRY_RUN && updates.length > 0) {
    for (const update of updates) {
      try {
        await prisma.transcripts.update({
          where: { vendor_call_key: update.vendorCallKey },
          data: { agent_name: update.agentName }
        });
        stats.updated++;
      } catch (error) {
        console.error(`Failed to update ${update.vendorCallKey}:`, error.message);
        stats.errors++;
      }
    }
  }

  return updates;
}

/**
 * Main execution
 */
async function main() {
  console.log('🔧 Agent Name Backfill Script\n');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  if (CONFIG.DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No database changes will be made\n');
  } else {
    console.log('⚠️  LIVE MODE - Database will be updated!\n');
  }

  try {
    // Get all transcripts with "Unknown" agent name
    console.log('📊 Loading transcripts with Unknown agent names...');

    let where = {
      OR: [
        { agent_name: 'Unknown' },
        { agent_name: null },
        { agent_name: '' }
      ],
      messages: {
        not: null
      }
    };

    const totalCount = await prisma.transcripts.count({ where });
    console.log(`   Found ${totalCount.toLocaleString()} transcripts to process\n`);

    let transcriptsToProcess = await prisma.transcripts.findMany({
      where,
      select: {
        vendor_call_key: true,
        agent_name: true,
        messages: true
      },
      orderBy: {
        call_start: 'desc'
      }
    });

    // Apply test limit if set
    if (CONFIG.TEST_LIMIT && transcriptsToProcess.length > CONFIG.TEST_LIMIT) {
      console.log(`🧪 TEST MODE: Limiting to first ${CONFIG.TEST_LIMIT} transcripts\n`);
      transcriptsToProcess = transcriptsToProcess.slice(0, CONFIG.TEST_LIMIT);
    }

    stats.total = transcriptsToProcess.length;

    // Process in batches
    const batches = [];
    for (let i = 0; i < transcriptsToProcess.length; i += CONFIG.BATCH_SIZE) {
      batches.push(transcriptsToProcess.slice(i, i + CONFIG.BATCH_SIZE));
    }

    console.log(`📦 Processing ${batches.length} batches of ${CONFIG.BATCH_SIZE} transcripts each\n`);

    const allUpdates = [];

    for (let i = 0; i < batches.length; i++) {
      process.stdout.write(`\r   Processing batch ${i + 1}/${batches.length}...`);
      const updates = await processBatch(batches[i]);
      allUpdates.push(...updates);
    }

    console.log('\n');

    // Show sample results
    if (allUpdates.length > 0) {
      console.log('\n📝 SAMPLE EXTRACTED NAMES (first 10):\n');
      console.log('─────────────────────────────────────────────────────────────────');
      allUpdates.slice(0, 10).forEach((update, idx) => {
        console.log(`${idx + 1}. ${update.vendorCallKey.substring(0, 8)}... → "${update.agentName}"`);
      });
    }

    console.log('\n\n═══════════════════════════════════════════════════════════════════\n');
    console.log('✅ BACKFILL COMPLETE!\n');
    console.log(`📊 Statistics:`);
    console.log(`   Total processed: ${stats.processed.toLocaleString()}`);
    console.log(`   Names found: ${stats.foundNames.toLocaleString()} (${((stats.foundNames / stats.total) * 100).toFixed(1)}%)`);
    console.log(`   Not found: ${stats.notFound.toLocaleString()}`);
    console.log(`   Errors: ${stats.errors.toLocaleString()}`);

    if (CONFIG.DRY_RUN) {
      console.log(`\n⚠️  DRY RUN: ${stats.foundNames.toLocaleString()} records WOULD be updated`);
      console.log(`\n💡 To apply changes, set CONFIG.DRY_RUN = false in the script`);
    } else {
      console.log(`\n✅ Updated: ${stats.updated.toLocaleString()} records in database`);
    }

    console.log('\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  prisma.$disconnect();
  process.exit(1);
});
