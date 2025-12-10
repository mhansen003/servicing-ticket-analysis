#!/usr/bin/env node

/**
 * Test Backfill with 10 Records
 * Send just 10 records to see debug output
 */

import fs from 'fs';

const DATA_FILE_PATH = 'C:\\Users\\Mark Hansen\\Downloads\\Nov 1 to Date Call Logs.txt';
const API_URL = 'https://servicing-ticket-analysis-gvxni3gxd-cmgprojects.vercel.app/api/backfill';

console.log('🔍 Testing backfill with 10 records...\n');

// Parse TSV
const content = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
const lines = content.split('\n');
const headers = lines[0].split('\t');

console.log(`Headers: ${headers.length} columns`);
console.log(`CallDurationInSeconds at index: ${headers.indexOf('CallDurationInSeconds')}\n`);

// Get first 10 records
const records = [];
for (let i = 1; i <= 10 && i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const values = line.split('\t');
  const record = {};

  headers.forEach((header, index) => {
    record[header] = values[index] || null;
  });

  records.push(record);
  console.log(`Record ${i}: VendorCallKey=${record.VendorCallKey}, CallDurationInSeconds="${record.CallDurationInSeconds}"`);
}

console.log('\n📤 Sending to API in DRY RUN mode...\n');

// Send to API
const response = await fetch(API_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    records,
    dryRun: true, // DRY RUN MODE
  }),
});

if (!response.ok) {
  console.error(`❌ API error: ${response.status} ${response.statusText}`);
  const text = await response.text();
  console.error(text);
  process.exit(1);
}

const result = await response.json();
console.log('✅ API Response:');
console.log(JSON.stringify(result, null, 2));
