#!/usr/bin/env node

import { DomoAPI } from './scripts/domo-api.mjs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const domo = new DomoAPI(
  process.env.DOMO_CLIENT_ID,
  process.env.DOMO_CLIENT_SECRET,
  process.env.DOMO_ENVIRONMENT || 'cmgfi'
);

async function test() {
  try {
    console.log('🔍 Testing DOMO API connection...');
    console.log('   Fetching data from Dec 11-15, 2025');

    const data = await domo.exportDatasetFull(process.env.DOMO_DATASET_ID, {
      startDate: '2025-12-11',
      endDate: '2025-12-15'
    });

    console.log(`✅ Successfully fetched ${data.length} records from DOMO`);

    if (data.length > 0) {
      console.log(`   First record: ${data[0].CallStartDateTime}`);
      console.log(`   Last record: ${data[data.length-1].CallStartDateTime}`);
    } else {
      console.log('   No records found for this date range');
    }
  } catch (error) {
    console.error('❌ DOMO API Error:', error.message);
    console.error(error);
  }
}

test();
