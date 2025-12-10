#!/usr/bin/env node

/**
 * Check Duration Parsing
 * Verify what values we're getting for CallDurationInSeconds
 */

import fs from 'fs';

const DATA_FILE_PATH = 'C:\\Users\\Mark Hansen\\Downloads\\Nov 1 to Date Call Logs.txt';

console.log('📊 Checking CallDurationInSeconds parsing...\n');

const content = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
const lines = content.split('\n');

const headers = lines[0].split('\t');
console.log('Headers found:', headers.length);
console.log('Headers:', headers.join(' | '));

const durationIndex = headers.indexOf('CallDurationInSeconds');
console.log(`\nCallDurationInSeconds is at index: ${durationIndex}\n`);

// Check first 5 data rows
console.log('First 5 data rows:');
for (let i = 1; i <= 5 && i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const values = line.split('\t');
  const vendorCallKey = values[1]; // VendorCallKey is column 2
  const duration = values[durationIndex];

  console.log(`Row ${i}:`);
  console.log(`  VendorCallKey: ${vendorCallKey}`);
  console.log(`  CallDurationInSeconds: "${duration}"`);
  console.log(`  Parsed as int: ${parseInt(duration)}`);
  console.log(`  Total columns in row: ${values.length}`);
  console.log('');
}
