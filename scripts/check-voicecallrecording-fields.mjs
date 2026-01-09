#!/usr/bin/env node

/**
 * Check VoiceCallRecording Object Fields
 *
 * Shows all available fields in the VoiceCallRecording object
 */

import dotenv from 'dotenv';
import { SalesforceAPI } from './salesforce-api.mjs';

dotenv.config({ path: '.env.local' });

async function checkFields() {
  try {
    console.log('🔍 Checking VoiceCallRecording Object Fields...\n');

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

    console.log('📋 Describing VoiceCallRecording object...');
    const describe = await salesforce.describeVoiceCallRecording();

    console.log(`\n✅ Found ${describe.fields.length} fields:\n`);
    console.log('─'.repeat(100));

    describe.fields.forEach((field, idx) => {
      console.log(`\n${idx + 1}. ${field.label} (${field.name})`);
      console.log(`   Type: ${field.type}`);
      console.log(`   Updateable: ${field.updateable ? '✅' : '❌'}`);
      console.log(`   Createable: ${field.createable ? '✅' : '❌'}`);
      if (field.type === 'reference' && field.referenceTo) {
        console.log(`   References: ${field.referenceTo.join(', ')}`);
      }
      if (field.length) {
        console.log(`   Max Length: ${field.length}`);
      }
    });

    console.log('\n' + '─'.repeat(100));

    // Look for any URL or recording related fields
    console.log('\n🔍 Fields that might contain recording URLs:\n');
    const urlFields = describe.fields.filter(f =>
      f.name.toLowerCase().includes('url') ||
      f.name.toLowerCase().includes('media') ||
      f.name.toLowerCase().includes('recording') ||
      f.name.toLowerCase().includes('link') ||
      f.name.toLowerCase().includes('source') ||
      f.name.toLowerCase().includes('location')
    );

    if (urlFields.length > 0) {
      urlFields.forEach(field => {
        console.log(`   ✅ ${field.label} (${field.name}) - ${field.type}`);
      });
    } else {
      console.log('   ❌ No obvious URL or recording location fields found');
      console.log('\n💡 Recording URLs might be stored in a different object or field name');
    }

    // Check if we can query for a sample record
    console.log('\n📊 Querying for sample VoiceCallRecording records...');
    try {
      const sampleQuery = 'SELECT Id, VoiceCallId, CreatedDate FROM VoiceCallRecording LIMIT 5';
      const sampleResult = await salesforce.query(sampleQuery);

      if (sampleResult.totalSize > 0) {
        console.log(`✅ Found ${sampleResult.totalSize} VoiceCallRecording records`);
        console.log('\nSample records:');
        sampleResult.records.forEach((rec, idx) => {
          console.log(`   ${idx + 1}. VoiceCallId: ${rec.VoiceCallId}, Created: ${rec.CreatedDate}`);
        });
      } else {
        console.log('⚠️  No VoiceCallRecording records found in org');
      }
    } catch (error) {
      console.log(`❌ Error querying: ${error.message}`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

checkFields();
