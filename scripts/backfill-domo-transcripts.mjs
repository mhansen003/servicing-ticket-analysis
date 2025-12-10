#!/usr/bin/env node

/**
 * Backfill Historical Transcripts from Domo
 *
 * Fetches and processes all transcripts from a start date through today
 * Use this once to backfill historical data, then use sync-domo-transcripts for ongoing updates
 *
 * Usage:
 *   node scripts/backfill-domo-transcripts.mjs --start-date 2024-12-03
 *   node scripts/backfill-domo-transcripts.mjs --start-date 2024-12-03 --dry-run
 */

import { syncTranscripts } from './sync-domo-transcripts.mjs';

const args = process.argv.slice(2);
const options = {
  endDate: new Date().toISOString().split('T')[0] // Today
};

console.log('🔄 Backfill Mode: Historical Data Import');
console.log('=========================================\n');

// Parse command line arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--start-date' && args[i + 1]) {
    options.startDate = args[i + 1];
    i++;
  } else if (args[i] === '--end-date' && args[i + 1]) {
    options.endDate = args[i + 1];
    i++;
  } else if (args[i] === '--dry-run') {
    options.dryRun = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log('Usage: node backfill-domo-transcripts.mjs [options]');
    console.log('');
    console.log('Options:');
    console.log('  --start-date YYYY-MM-DD  Start date for backfill (default: 2024-12-03)');
    console.log('  --end-date YYYY-MM-DD    End date for backfill (default: today)');
    console.log('  --dry-run                Show what would be done without actually doing it');
    console.log('  --help, -h               Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node backfill-domo-transcripts.mjs --start-date 2024-12-03');
    console.log('  node backfill-domo-transcripts.mjs --start-date 2024-12-01 --end-date 2024-12-31');
    console.log('  node backfill-domo-transcripts.mjs --start-date 2024-12-03 --dry-run');
    process.exit(0);
  }
}

// Default start date if not provided
if (!options.startDate) {
  options.startDate = '2024-12-03';
  console.log(`ℹ️  No start date provided, using default: ${options.startDate}`);
}

// Validate dates
const startDate = new Date(options.startDate);
const endDate = new Date(options.endDate);

if (isNaN(startDate.getTime())) {
  console.error('❌ Invalid start date format. Use YYYY-MM-DD');
  process.exit(1);
}

if (isNaN(endDate.getTime())) {
  console.error('❌ Invalid end date format. Use YYYY-MM-DD');
  process.exit(1);
}

if (startDate > endDate) {
  console.error('❌ Start date must be before end date');
  process.exit(1);
}

const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
console.log(`📅 Date Range: ${options.startDate} to ${options.endDate} (${daysDiff} days)`);
console.log(`🔍 Mode: ${options.dryRun ? 'DRY RUN (no changes)' : 'LIVE (will import and analyze)'}`);
console.log('');

// Confirm before proceeding (unless dry run)
if (!options.dryRun && daysDiff > 7) {
  console.log('⚠️  WARNING: This will process a large date range!');
  console.log('   This may take a significant amount of time and API calls.');
  console.log('');
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');

  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log('');
}

// Run the sync with specified date range
console.log('🚀 Starting backfill...\n');

syncTranscripts(options)
  .then((stats) => {
    console.log('\n✅ Backfill complete!');
    console.log('\nNext steps:');
    console.log('1. Verify data in your database');
    console.log('2. Set up hourly sync: node scripts/sync-domo-transcripts.mjs');
    console.log('3. Configure cron job for automatic hourly updates');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  });
