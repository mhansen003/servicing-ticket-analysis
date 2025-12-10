#!/usr/bin/env node

/**
 * Count Duration Values
 * See how many records have real duration values vs NULL
 */

import fs from 'fs';

const DATA_FILE_PATH = 'C:\\Users\\Mark Hansen\\Downloads\\Nov 1 to Date Call Logs.txt';

console.log('📊 Counting CallDurationInSeconds values...\n');

const content = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
const lines = content.split('\n');

const headers = lines[0].split('\t');
const durationIndex = headers.indexOf('CallDurationInSeconds');

let totalRecords = 0;
let nullCount = 0;
let emptyCount = 0;
let validCount = 0;
let zeroCount = 0;

const sampleValid = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  totalRecords++;
  const values = line.split('\t');
  const duration = values[durationIndex];

  if (duration === 'NULL' || duration === 'null') {
    nullCount++;
  } else if (!duration || duration.trim() === '') {
    emptyCount++;
  } else {
    const num = parseInt(duration);
    if (!isNaN(num)) {
      if (num === 0) {
        zeroCount++;
      } else {
        validCount++;
        if (sampleValid.length < 10) {
          sampleValid.push({ vendorKey: values[1], duration: num });
        }
      }
    }
  }
}

console.log(`Total records: ${totalRecords}`);
console.log(`NULL values: ${nullCount} (${((nullCount / totalRecords) * 100).toFixed(1)}%)`);
console.log(`Empty values: ${emptyCount} (${((emptyCount / totalRecords) * 100).toFixed(1)}%)`);
console.log(`Zero values: ${zeroCount} (${((zeroCount / totalRecords) * 100).toFixed(1)}%)`);
console.log(`Valid non-zero values: ${validCount} (${((validCount / totalRecords) * 100).toFixed(1)}%)`);

console.log('\nSample valid values:');
sampleValid.forEach(s => {
  console.log(`  ${s.vendorKey}: ${s.duration} seconds (${Math.floor(s.duration / 60)}m ${s.duration % 60}s)`);
});
