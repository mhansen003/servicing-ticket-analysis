#!/usr/bin/env node

/**
 * Backfill Agent Names from Original TSV File
 *
 * Reads the original TSV file and updates ONLY the agent_name field
 * in existing transcripts. Does NOT touch any AI analysis data.
 *
 * This is safe to run while AI analysis is ongoing.
 */

import dotenv from 'dotenv';
import fs from 'fs';
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

const INPUT_FILE = 'C:\\Users\\Mark Hansen\\Downloads\\Nov 1 to Date Call Logs.txt';

// Configuration
const CONFIG = {
  BATCH_SIZE: 100,
  DRY_RUN: false, // Set to true to test without updating database
};

// Statistics
const stats = {
  total: 0,
  processed: 0,
  updated: 0,
  alreadyHadName: 0,
  notFound: 0,
  errors: 0,
};

/**
 * Parse agent names from TSV file
 */
function parseAgentNamesFromTSV(filePath) {
  console.log('📂 Reading TSV file...');

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Parse header to find column indices
  const headers = lines[0].split('\t');
  const vendorCallKeyIdx = headers.indexOf('VendorCallKey');
  const agentNameIdx = headers.indexOf('Name'); // Column 17 in TSV

  console.log(`   Header indices:`);
  console.log(`   - VendorCallKey: ${vendorCallKeyIdx}`);
  console.log(`   - Name (Agent): ${agentNameIdx}`);

  if (vendorCallKeyIdx === -1 || agentNameIdx === -1) {
    throw new Error('Required columns not found in TSV file');
  }

  console.log(`\n   Found ${(lines.length - 1).toLocaleString()} lines in TSV file`);

  const agentNames = new Map();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = line.split('\t');
    const vendorCallKey = fields[vendorCallKeyIdx];
    const agentName = fields[agentNameIdx];

    if (vendorCallKey && agentName && agentName.trim() !== '') {
      agentNames.set(vendorCallKey, agentName.trim());
    }
  }

  console.log(`   Extracted ${agentNames.size.toLocaleString()} agent names from TSV\n`);
  return agentNames;
}

/**
 * Update agent names in database
 */
async function updateAgentNames(agentNamesMap) {
  console.log('💾 Updating agent names in database...\n');

  const vendorCallKeys = Array.from(agentNamesMap.keys());
  stats.total = vendorCallKeys.length;

  // Process in batches
  const batches = [];
  for (let i = 0; i < vendorCallKeys.length; i += CONFIG.BATCH_SIZE) {
    batches.push(vendorCallKeys.slice(i, i + CONFIG.BATCH_SIZE));
  }

  console.log(`📦 Processing ${batches.length} batches of ${CONFIG.BATCH_SIZE}\n`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    process.stdout.write(`\r   Processing batch ${i + 1}/${batches.length}...`);

    for (const vendorCallKey of batch) {
      try {
        const newAgentName = agentNamesMap.get(vendorCallKey);

        // Check if transcript exists
        const existing = await prisma.transcripts.findUnique({
          where: { vendor_call_key: vendorCallKey },
          select: { agent_name: true }
        });

        if (!existing) {
          stats.notFound++;
          continue;
        }

        // Skip if already has a name other than "Unknown"
        if (existing.agent_name && existing.agent_name !== 'Unknown') {
          stats.alreadyHadName++;
          stats.processed++;
          continue;
        }

        // Update only the agent_name field
        if (!CONFIG.DRY_RUN) {
          await prisma.transcripts.update({
            where: { vendor_call_key: vendorCallKey },
            data: { agent_name: newAgentName }
          });
          stats.updated++;
        }

        stats.processed++;

      } catch (error) {
        stats.errors++;
        console.error(`\n❌ Error updating ${vendorCallKey}:`, error.message);
      }
    }
  }

  console.log('\n');
}

/**
 * Main execution
 */
async function main() {
  console.log('🔧 Backfill Agent Names from TSV File\n');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  if (CONFIG.DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No database changes will be made\n');
  } else {
    console.log('⚠️  LIVE MODE - Database will be updated!\n');
  }

  try {
    // Parse agent names from TSV
    const agentNamesMap = parseAgentNamesFromTSV(INPUT_FILE);

    // Update database
    await updateAgentNames(agentNamesMap);

    console.log('═══════════════════════════════════════════════════════════════════\n');
    console.log('✅ BACKFILL COMPLETE!\n');
    console.log(`📊 Statistics:`);
    console.log(`   Total in TSV: ${stats.total.toLocaleString()}`);
    console.log(`   Processed: ${stats.processed.toLocaleString()}`);
    console.log(`   Updated: ${stats.updated.toLocaleString()}`);
    console.log(`   Already had name: ${stats.alreadyHadName.toLocaleString()}`);
    console.log(`   Not found in DB: ${stats.notFound.toLocaleString()}`);
    console.log(`   Errors: ${stats.errors.toLocaleString()}`);

    if (CONFIG.DRY_RUN) {
      console.log(`\n⚠️  DRY RUN: ${stats.updated.toLocaleString()} records WOULD be updated`);
      console.log(`\n💡 To apply changes, set CONFIG.DRY_RUN = false in the script`);
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
