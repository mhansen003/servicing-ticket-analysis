#!/usr/bin/env node

/**
 * Backfill via API
 *
 * Reads the TSV file and sends data to the Vercel API endpoint for backfilling
 * This avoids local database connection issues
 */

import fs from 'fs';

const DATA_FILE_PATH = 'C:\\Users\\Mark Hansen\\Downloads\\Nov 1 to Date Call Logs.txt';
const API_URL = process.env.API_URL || 'https://your-app.vercel.app/api/backfill';
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 500; // Send in batches of 500

console.log('🔒 BACKFILL VIA API');
console.log('===================');
console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN' : '✍️  WRITE MODE'}`);
console.log(`API URL: ${API_URL}`);
console.log(`Data file: ${DATA_FILE_PATH}\n`);

/**
 * Parse TSV file
 */
function parseCallLogs(filePath) {
  console.log('📖 Reading call logs file...');
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const headers = lines[0].split('\t');
  console.log(`   Found ${headers.length} columns`);

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
 * Send batch to API
 */
async function sendBatch(records, dryRun) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      records,
      dryRun,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Main process
 */
async function main() {
  try {
    // Check file exists
    if (!fs.existsSync(DATA_FILE_PATH)) {
      console.error(`❌ Error: File not found at ${DATA_FILE_PATH}`);
      process.exit(1);
    }

    // Parse file
    const allRecords = parseCallLogs(DATA_FILE_PATH);

    // Send in batches
    let totalUpdated = 0;
    let totalSkipped = 0;
    const allUpdatedFields = {};
    const allSkippedReasons = {};

    console.log(`🔄 Processing ${allRecords.length} records in batches of ${BATCH_SIZE}...\n`);

    for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
      const batch = allRecords.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allRecords.length / BATCH_SIZE);

      console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} records)...`);

      try {
        const result = await sendBatch(batch, DRY_RUN);

        if (result.success) {
          totalUpdated += result.summary.updated;
          totalSkipped += result.summary.skipped;

          // Merge updated fields
          Object.entries(result.updatedFields || {}).forEach(([field, count]) => {
            allUpdatedFields[field] = (allUpdatedFields[field] || 0) + count;
          });

          // Merge skipped reasons
          Object.entries(result.skippedReasons || {}).forEach(([reason, count]) => {
            allSkippedReasons[reason] = (allSkippedReasons[reason] || 0) + count;
          });

          console.log(`   ✓ Updated: ${result.summary.updated}, Skipped: ${result.summary.skipped}`);

          if (result.errors && result.errors.length > 0) {
            console.log(`   ⚠️  Errors:`, result.errors);
          }
        } else {
          console.error(`   ❌ Batch failed:`, result.message);
        }
      } catch (err) {
        console.error(`   ❌ Batch error:`, err.message);
      }

      // Small delay between batches
      if (i + BATCH_SIZE < allRecords.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Final report
    console.log('\n\n📊 BACKFILL COMPLETE!');
    console.log('=====================');
    console.log(`Total records processed: ${allRecords.length}`);
    console.log(`Records updated: ${totalUpdated}`);
    console.log(`Records skipped: ${totalSkipped}`);
    console.log('');

    if (Object.keys(allSkippedReasons).length > 0) {
      console.log('Skip reasons:');
      Object.entries(allSkippedReasons).forEach(([reason, count]) => {
        console.log(`  - ${reason}: ${count}`);
      });
      console.log('');
    }

    if (Object.keys(allUpdatedFields).length > 0) {
      console.log('Fields updated:');
      Object.entries(allUpdatedFields).forEach(([field, count]) => {
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
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
