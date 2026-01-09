#!/usr/bin/env node

/**
 * Check VoiceCall Object Fields
 *
 * Shows all available fields in the VoiceCall object (not VoiceCallRecording)
 */

import dotenv from 'dotenv';
import { SalesforceAPI } from './salesforce-api.mjs';

dotenv.config({ path: '.env.local' });

async function checkVoiceCallFields() {
  try {
    console.log('🔍 Checking VoiceCall Object Fields...\n');

    const salesforce = new SalesforceAPI(
      process.env.SALESFORCE_INSTANCE_URL,
      process.env.SALESFORCE_CLIENT_ID,
      process.env.SALESFORCE_CLIENT_SECRET,
      process.env.SALESFORCE_API_VERSION || 'v61.0',
      process.env.SALESFORCE_USERNAME,
      process.env.SALESFORCE_PASSWORD
    );

    console.log('🔐 Authenticating...');
    await salesforce.authenticate();
    console.log('✅ Authenticated\n');

    console.log('📋 Describing VoiceCall object...');
    const token = await salesforce.getAccessToken();
    const url = `${salesforce.instanceUrl}/services/data/${salesforce.apiVersion}/sobjects/VoiceCall/describe`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const describe = await response.json();

    console.log(`\n✅ Found ${describe.fields.length} fields:\n`);
    console.log('─'.repeat(100));

    describe.fields.forEach((field, idx) => {
      console.log(`\n${idx + 1}. ${field.label} (${field.name})`);
      console.log(`   Type: ${field.type}`);
      if (field.type === 'reference' && field.referenceTo) {
        console.log(`   References: ${field.referenceTo.join(', ')}`);
      }
      if (field.length) {
        console.log(`   Max Length: ${field.length}`);
      }
    });

    console.log('\n' + '─'.repeat(100));

    // Look for any URL, recording, or Amazon Connect related fields
    console.log('\n🔍 Fields that might contain recording URLs or Amazon Connect data:\n');
    const relevantFields = describe.fields.filter(f =>
      f.name.toLowerCase().includes('url') ||
      f.name.toLowerCase().includes('media') ||
      f.name.toLowerCase().includes('recording') ||
      f.name.toLowerCase().includes('link') ||
      f.name.toLowerCase().includes('source') ||
      f.name.toLowerCase().includes('location') ||
      f.name.toLowerCase().includes('amazon') ||
      f.name.toLowerCase().includes('connect') ||
      f.name.toLowerCase().includes('vendor') ||
      f.name.toLowerCase().includes('external')
    );

    if (relevantFields.length > 0) {
      relevantFields.forEach(field => {
        console.log(`   ✅ ${field.label} (${field.name}) - ${field.type}`);
      });
    } else {
      console.log('   ❌ No obvious URL or Amazon Connect fields found');
    }

    // Query for a sample VoiceCall record with the VendorCallKey from DOMO
    console.log('\n📊 Looking for VoiceCall records matching DOMO data...');
    try {
      // Use a VendorCallKey from DOMO sample we saw earlier
      const sampleVendorCallKey = '120f2505-00c8-4139-bba1-3153baf067f8';

      const sampleQuery = `SELECT Id, VendorCallKey, CallStartDateTime, CallEndDateTime, CallDurationInSeconds FROM VoiceCall WHERE VendorCallKey = '${sampleVendorCallKey}' LIMIT 1`;
      const sampleResult = await salesforce.query(sampleQuery);

      if (sampleResult.totalSize > 0) {
        console.log(`✅ Found VoiceCall record!`);
        const voiceCall = sampleResult.records[0];
        console.log(`   VoiceCall ID: ${voiceCall.Id}`);
        console.log(`   VendorCallKey: ${voiceCall.VendorCallKey}`);
        console.log(`   Call Start: ${voiceCall.CallStartDateTime}`);

        // Now get ALL fields for this record
        console.log('\n📋 Fetching all fields for this VoiceCall...');
        const allFieldsQuery = `SELECT ${describe.fields.map(f => f.name).join(', ')} FROM VoiceCall WHERE Id = '${voiceCall.Id}' LIMIT 1`;
        const fullRecord = await salesforce.query(allFieldsQuery);

        if (fullRecord.totalSize > 0) {
          const record = fullRecord.records[0];
          console.log('\n🔍 Fields with values:\n');
          Object.keys(record).forEach(key => {
            if (record[key] && key !== 'attributes') {
              console.log(`   ${key}: ${JSON.stringify(record[key]).substring(0, 100)}`);
            }
          });
        }
      } else {
        console.log('⚠️  No VoiceCall record found with that VendorCallKey');
        console.log('   Trying to find any VoiceCall records...');

        const anyQuery = 'SELECT Id, VendorCallKey FROM VoiceCall LIMIT 1';
        const anyResult = await salesforce.query(anyQuery);

        if (anyResult.totalSize > 0) {
          console.log(`✅ Found ${anyResult.totalSize} VoiceCall record(s)`);
          console.log(`   Sample VoiceCall ID: ${anyResult.records[0].Id}`);
          console.log(`   Sample VendorCallKey: ${anyResult.records[0].VendorCallKey}`);
        } else {
          console.log('❌ No VoiceCall records found in org');
        }
      }
    } catch (error) {
      console.log(`❌ Error querying: ${error.message}`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkVoiceCallFields();
