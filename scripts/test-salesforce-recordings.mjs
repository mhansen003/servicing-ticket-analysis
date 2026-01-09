#!/usr/bin/env node

/**
 * Test Salesforce Recording URL Retrieval
 *
 * Tests fetching recording URLs for VoiceCalls from DOMO data
 */

import dotenv from 'dotenv';
import { SalesforceAPI } from './salesforce-api.mjs';
import { DomoAPI } from './domo-api.mjs';

dotenv.config({ path: '.env.local' });

async function testRecordings() {
  try {
    console.log('🔍 Testing Salesforce Recording URL Retrieval...\n');

    // Initialize APIs
    const salesforce = new SalesforceAPI(
      process.env.SALESFORCE_INSTANCE_URL,
      process.env.SALESFORCE_CLIENT_ID,
      process.env.SALESFORCE_CLIENT_SECRET,
      process.env.SALESFORCE_API_VERSION || 'v61.0'
    );

    const domo = new DomoAPI(
      process.env.DOMO_CLIENT_ID,
      process.env.DOMO_CLIENT_SECRET,
      process.env.DOMO_ENVIRONMENT || 'cmgfi'
    );

    // Authenticate
    console.log('🔐 Authenticating...');
    await salesforce.authenticate();
    console.log('✅ Salesforce authenticated');

    // Fetch sample data from DOMO
    console.log('\n📥 Fetching sample calls from DOMO...');
    const sampleSize = 10;
    const domoData = await domo.fetchDataset({
      datasetId: process.env.DOMO_DATASET_ID,
      sql: `SELECT VoiceCallId, VendorCallKey, CallStartDateTime, Name
            FROM table
            WHERE VoiceCallId IS NOT NULL
            ORDER BY CallStartDateTime DESC
            LIMIT ${sampleSize}`
    });

    console.log(`✅ Fetched ${domoData.rows.length} calls from DOMO\n`);

    if (domoData.rows.length === 0) {
      console.log('⚠️  No calls with VoiceCallId found in DOMO data');
      process.exit(0);
    }

    // Extract VoiceCallIds
    const voiceCallIds = domoData.rows.map(row => row[0]).filter(Boolean);
    console.log(`📋 VoiceCallIds to lookup: ${voiceCallIds.length}`);
    voiceCallIds.forEach(id => console.log(`   - ${id}`));

    // Fetch recording URLs from Salesforce
    console.log('\n🔍 Fetching recording URLs from Salesforce...');
    const recordings = await salesforce.getRecordingUrls(voiceCallIds);

    console.log(`✅ Found ${recordings.length} recording(s)\n`);

    // Create lookup map
    const recordingMap = new Map(
      recordings.map(r => [r.VoiceCallId, r])
    );

    // Display results
    console.log('📊 Results:\n');
    console.log('─'.repeat(100));

    let foundCount = 0;
    let missingCount = 0;

    for (let i = 0; i < domoData.rows.length; i++) {
      const [voiceCallId, vendorCallKey, callStart, agentName] = domoData.rows[i];
      const recording = recordingMap.get(voiceCallId);

      console.log(`\n${i + 1}. VoiceCallId: ${voiceCallId}`);
      console.log(`   VendorCallKey: ${vendorCallKey}`);
      console.log(`   Call Start: ${callStart}`);
      console.log(`   Agent: ${agentName}`);

      if (recording) {
        foundCount++;
        console.log(`   ✅ Recording Found:`);
        console.log(`      Recording ID: ${recording.Id}`);
        console.log(`      MediaSrc: ${recording.MediaSrc || 'null'}`);
        console.log(`      CallRecordingUrl: ${recording.CallRecordingUrl || 'null'}`);

        // Show which field has a value
        if (recording.MediaSrc) {
          console.log(`      🎵 Recording URL available in MediaSrc`);
        } else if (recording.CallRecordingUrl) {
          console.log(`      🎵 Recording URL available in CallRecordingUrl`);
        } else {
          console.log(`      ⚠️  Recording exists but no URL found`);
        }
      } else {
        missingCount++;
        console.log(`   ❌ No recording found in Salesforce`);
      }
    }

    console.log('\n' + '─'.repeat(100));
    console.log(`\n📈 Summary:`);
    console.log(`   Total calls checked: ${domoData.rows.length}`);
    console.log(`   Recordings found: ${foundCount} (${Math.round(foundCount / domoData.rows.length * 100)}%)`);
    console.log(`   Recordings missing: ${missingCount} (${Math.round(missingCount / domoData.rows.length * 100)}%)`);

    if (foundCount === 0) {
      console.log('\n⚠️  No recordings found. Possible reasons:');
      console.log('   1. Call recording is not enabled in Salesforce/Amazon Connect');
      console.log('   2. VoiceCallRecording records are not being created');
      console.log('   3. There\'s a delay between call and recording creation');
      console.log('   4. The integration user lacks read permissions');
      console.log('\n💡 Check Salesforce Setup → Service Cloud Voice → Recording Settings');
    } else if (missingCount > 0) {
      console.log('\n💡 Some recordings are missing. This is normal if:');
      console.log('   - Call recording is enabled but not retroactive');
      console.log('   - Some calls opted out of recording');
      console.log('   - Recording processing is delayed');
    } else {
      console.log('\n✅ All calls have recordings! Integration is working perfectly.');
    }

    console.log('\n💡 Next steps:');
    console.log('   1. Add recording_url fields to database schema');
    console.log('   2. Update daily-sync-domo.mjs to enrich with recording URLs');
    console.log('   3. Update API endpoints to return recording URLs');
    console.log('   4. Add audio player component to frontend');
    console.log('\nSee SALESFORCE_RECORDING_INTEGRATION.md for implementation details.');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testRecordings();
