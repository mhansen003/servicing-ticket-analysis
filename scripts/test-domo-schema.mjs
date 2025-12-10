#!/usr/bin/env node

/**
 * Test script to check Domo dataset schema
 */

import dotenv from 'dotenv';
import { DomoAPI } from './domo-api.mjs';

dotenv.config({ path: '.env.local' });

const domo = new DomoAPI(
  process.env.DOMO_CLIENT_ID,
  process.env.DOMO_CLIENT_SECRET,
  process.env.DOMO_ENVIRONMENT || 'cmgfi'
);

async function testSchema() {
  try {
    console.log('🔍 Checking Domo dataset schema...\n');

    // Get dataset info
    const info = await domo.getDatasetInfo(process.env.DOMO_DATASET_ID);

    console.log('📊 Dataset Information:');
    console.log(`   Name: ${info.name}`);
    console.log(`   Rows: ${info.rows?.toLocaleString()}`);
    console.log(`   Columns: ${info.columns?.length}\n`);

    console.log('📋 Available Columns:');
    info.columns.forEach((col, idx) => {
      console.log(`   ${idx + 1}. ${col.name} (${col.type})`);
    });

    console.log('\n✅ Schema check complete!');
    console.log('\nSuggested date column names to try:');
    const dateColumns = info.columns.filter(c =>
      c.type.toLowerCase().includes('date') ||
      c.type.toLowerCase().includes('time') ||
      c.name.toLowerCase().includes('date') ||
      c.name.toLowerCase().includes('time')
    );
    dateColumns.forEach(col => {
      console.log(`   - ${col.name} (${col.type})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSchema();
