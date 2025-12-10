#!/usr/bin/env node

/**
 * Test the transcripts API endpoint to diagnose raw data tab error
 */

import fetch from 'node-fetch';

async function testAPI() {
  console.log('🧪 Testing /api/transcript-analytics?type=transcripts...\n');

  try {
    const baseUrl = 'http://localhost:3000';
    const url = `${baseUrl}/api/transcript-analytics?type=transcripts&limit=10`;

    console.log(`📡 Fetching: ${url}\n`);

    const response = await fetch(url);

    console.log(`Response status: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:');
      console.error(errorText);

      try {
        const errorJson = JSON.parse(errorText);
        console.error('\nParsed error:', JSON.stringify(errorJson, null, 2));
      } catch (e) {
        console.error('\nRaw error text:', errorText);
      }
      return;
    }

    const data = await response.json();

    if (data.success) {
      console.log(`✅ Success! Got ${data.data?.length || 0} transcripts\n`);

      if (data.data && data.data.length > 0) {
        console.log('Sample record:');
        const sample = data.data[0];
        console.log(`  ID: ${sample.id}`);
        console.log(`  Vendor Call Key: ${sample.vendorCallKey}`);
        console.log(`  Agent: ${sample.agentName}`);
        console.log(`  Call Start: ${sample.callStart}`);
        console.log(`  Messages: ${sample.messageCount} messages`);
        console.log(`  Has Analysis: ${sample.agentSentiment ? 'Yes' : 'No'}`);
      }
    } else {
      console.error('❌ API returned success=false');
      console.error('Message:', data.message);
      console.error('Full response:', JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nFull error:', error);
  }
}

testAPI();
