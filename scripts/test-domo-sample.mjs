#!/usr/bin/env node

/**
 * Test script to fetch sample data and see column names
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

async function authenticate() {
  const authUrl = 'https://api.domo.com/oauth/token';
  const credentials = Buffer.from(`${process.env.DOMO_CLIENT_ID}:${process.env.DOMO_CLIENT_SECRET}`).toString('base64');

  const response = await fetch(`${authUrl}?grant_type=client_credentials`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();
  return data.access_token;
}

async function fetchSample() {
  try {
    console.log('🔍 Fetching sample data from Domo...\n');

    const token = await authenticate();
    console.log('✅ Authenticated\n');

    // Try simple SELECT * with LIMIT
    const query = 'SELECT * FROM table LIMIT 5';
    const url = `https://api.domo.com/v1/datasets/query/execute/${process.env.DOMO_DATASET_ID}`;

    console.log('📥 Running query:', query, '\n');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: query })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed: ${response.status} - ${error}`);
    }

    const data = await response.json();

    console.log('✅ Sample data fetched!\n');
    console.log('📋 Columns:', data.columns);
    console.log('\n📊 First row sample:');
    if (data.rows && data.rows[0]) {
      data.columns.forEach((col, idx) => {
        console.log(`   ${col}: ${data.rows[0][idx]}`);
      });
    }

    console.log('\n✅ Schema discovered!');
    console.log('\n🔧 Update your sync script to use these column names.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fetchSample();
