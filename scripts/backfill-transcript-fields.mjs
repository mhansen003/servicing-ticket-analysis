#!/usr/bin/env node

/**
 * SAFE Backfill Script for Missing Transcript Fields
 *
 * This script reads raw call log data and populates ONLY missing fields in the database.
 *
 * SAFETY GUARANTEES:
 * - Only updates NULL/empty values
 * - Never overwrites existing data
 * - Dry-run mode available for testing
 * - Detailed logging of all changes
 */

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig, Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ Error: DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Configure for serverless
neonConfig.poolQueryViaFetch = true;
const pool = new Pool({ connectionString });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });

// Configuration
const DATA_FILE_PATH = 'C:\\Users\\Mark Hansen\\Downloads\\Nov 1 to Date Call Logs.txt';
const DRY_RUN = process.argv.includes('--dry-run'); // Add --dry-run flag to test without writing
const BATCH_SIZE = 100; // Process in batches to avoid memory issues

console.log('🔒 SAFE BACKFILL SCRIPT - Missing Transcript Fields');
console.log('====================================================');
console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes will be made)' : '✍️  WRITE MODE'}`);
console.log(`Data file: ${DATA_FILE_PATH}`);
console.log('');

/**
 * Parse TSV file and return records
 */
function parseCallLogs(filePath) {
  console.log('📖 Reading call logs file...');
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Parse header
  const headers = lines[0].split('\t');
  console.log(`   Found ${headers.length} columns`);

  // Parse data rows
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split('\t');
    const record = {};

    headers.forEach((header, index) => {
      record[header] = values[index] || null;
    });

    records.push(record);
  }

  console.log(`   ✓ Parsed ${records.length} records\n`);
  return records;
}

/**
 * Parse datetime string to Date object
 */
function parseDateTime(dateStr) {
  if (!dateStr) return null;
  try {
    const timestamp = parseInt(dateStr);
    if (!isNaN(timestamp)) {
      return new Date(timestamp);
    }
    return new Date(dateStr);
  } catch (err) {
    return null;
  }
}

/**
 * Safely backfill a single transcript
 */
async function backfillTranscript(rawRecord) {
  const vendorCallKey = rawRecord.VendorCallKey;
  if (!vendorCallKey) return { skipped: true, reason: 'no vendor key' };

  // Find existing transcript
  const existing = await prisma.transcripts.findUnique({
    where: { vendor_call_key: vendorCallKey },
  });

  if (!existing) {
    return { skipped: true, reason: 'not in database' };
  }

  // Build update object with ONLY missing fields
  const updates = {};
  let hasUpdates = false;

  // call_end
  if (!existing.call_end && rawRecord.CallEndDateTime) {
    const callEnd = parseDateTime(rawRecord.CallEndDateTime);
    if (callEnd) {
      updates.call_end = callEnd;
      hasUpdates = true;
    }
  }

  // number_of_holds
  if (existing.number_of_holds === null && rawRecord.NumberOfHolds) {
    const holds = parseInt(rawRecord.NumberOfHolds);
    if (!isNaN(holds)) {
      updates.number_of_holds = holds;
      hasUpdates = true;
    }
  }

  // hold_duration
  if (existing.hold_duration === null && rawRecord.CustomerHoldDuration) {
    const holdDuration = parseInt(rawRecord.CustomerHoldDuration);
    if (!isNaN(holdDuration)) {
      updates.hold_duration = holdDuration;
      hasUpdates = true;
    }
  }

  // status
  if (!existing.status && rawRecord.VoiceCallStatus) {
    updates.status = rawRecord.VoiceCallStatus;
    hasUpdates = true;
  }

  // agent_role
  if (!existing.agent_role && rawRecord.UserRoleName) {
    updates.agent_role = rawRecord.UserRoleName;
    hasUpdates = true;
  }

  // agent_profile
  if (!existing.agent_profile && rawRecord.ProfileName) {
    updates.agent_profile = rawRecord.ProfileName;
    hasUpdates = true;
  }

  // agent_email
  if (!existing.agent_email && rawRecord.Email) {
    updates.agent_email = rawRecord.Email;
    hasUpdates = true;
  }

  // If no updates needed, skip
  if (!hasUpdates) {
    return { skipped: true, reason: 'already complete' };
  }

  // Perform update (unless dry run)
  if (!DRY_RUN) {
    await prisma.transcripts.update({
      where: { vendor_call_key: vendorCallKey },
      data: updates,
    });
  }

  return {
    updated: true,
    vendorCallKey,
    fields: Object.keys(updates),
  };
}

/**
 * Main backfill process
 */
async function main() {
  try {
    // Check if file exists
    if (!fs.existsSync(DATA_FILE_PATH)) {
      console.error(`❌ Error: File not found at ${DATA_FILE_PATH}`);
      process.exit(1);
    }

    // Parse call logs
    const rawRecords = parseCallLogs(DATA_FILE_PATH);

    // Statistics
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const skippedReasons = {};
    const updatedFields = {};

    console.log('🔄 Processing records...\n');

    // Process in batches
    for (let i = 0; i < rawRecords.length; i += BATCH_SIZE) {
      const batch = rawRecords.slice(i, i + BATCH_SIZE);

      for (const record of batch) {
        totalProcessed++;

        const result = await backfillTranscript(record);

        if (result.skipped) {
          totalSkipped++;
          skippedReasons[result.reason] = (skippedReasons[result.reason] || 0) + 1;
        } else if (result.updated) {
          totalUpdated++;

          // Track which fields were updated
          for (const field of result.fields) {
            updatedFields[field] = (updatedFields[field] || 0) + 1;
          }

          if (totalUpdated % 10 === 0) {
            console.log(`   ✓ Updated ${totalUpdated} records...`);
          }
        }
      }

      // Progress update
      if ((i + BATCH_SIZE) % 500 === 0) {
        console.log(`\n📊 Progress: ${Math.min(i + BATCH_SIZE, rawRecords.length)} / ${rawRecords.length} records processed`);
      }
    }

    // Final report
    console.log('\n\n📊 BACKFILL COMPLETE!');
    console.log('=====================');
    console.log(`Total records processed: ${totalProcessed}`);
    console.log(`Records updated: ${totalUpdated}`);
    console.log(`Records skipped: ${totalSkipped}`);
    console.log('');

    if (Object.keys(skippedReasons).length > 0) {
      console.log('Skip reasons:');
      Object.entries(skippedReasons).forEach(([reason, count]) => {
        console.log(`  - ${reason}: ${count}`);
      });
      console.log('');
    }

    if (Object.keys(updatedFields).length > 0) {
      console.log('Fields updated:');
      Object.entries(updatedFields).forEach(([field, count]) => {
        console.log(`  - ${field}: ${count} records`);
      });
      console.log('');
    }

    if (DRY_RUN) {
      console.log('🔍 DRY RUN - No changes were made to the database');
      console.log('   Run without --dry-run flag to apply changes');
    } else {
      console.log('✅ Changes have been written to the database');
    }

  } catch (error) {
    console.error('\n❌ Error during backfill:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
