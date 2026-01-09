#!/usr/bin/env node

/**
 * Check Voice_Call_Info__c Custom Object
 *
 * This custom object might store Amazon Connect recording URLs
 */

import dotenv from 'dotenv';
import { SalesforceAPI } from './salesforce-api.mjs';

dotenv.config({ path: '.env.local' });

async function checkVoiceCallInfo() {
  try {
    console.log('🔍 Checking Voice_Call_Info__c Custom Object...\n');

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

    console.log('📋 Describing Voice_Call_Info__c object...');
    const token = await salesforce.getAccessToken();
    const url = `${salesforce.instanceUrl}/services/data/${salesforce.apiVersion}/sobjects/Voice_Call_Info__c/describe`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.log('❌ Voice_Call_Info__c object not found or not accessible');
      return;
    }

    const describe = await response.json();

    console.log(`\n✅ Found ${describe.fields.length} fields:\n`);
    console.log('─'.repeat(100));

    // Show all fields
    describe.fields.forEach((field, idx) => {
      console.log(`\n${idx + 1}. ${field.label} (${field.name})`);
      console.log(`   Type: ${field.type}`);
      if (field.length) {
        console.log(`   Max Length: ${field.length}`);
      }
    });

    console.log('\n' + '─'.repeat(100));

    // Look for URL or recording fields
    console.log('\n🔍 Fields that might contain recording URLs:\n');
    const urlFields = describe.fields.filter(f =>
      f.name.toLowerCase().includes('url') ||
      f.name.toLowerCase().includes('recording') ||
      f.name.toLowerCase().includes('media') ||
      f.name.toLowerCase().includes('link') ||
      f.name.toLowerCase().includes('s3') ||
      f.name.toLowerCase().includes('amazon') ||
      f.name.toLowerCase().includes('connect')
    );

    if (urlFields.length > 0) {
      urlFields.forEach(field => {
        console.log(`   ✅ ${field.label} (${field.name}) - ${field.type}`);
      });
    } else {
      console.log('   ❌ No obvious URL fields found');
    }

    // Check if there are any records
    console.log('\n📊 Querying for Voice_Call_Info__c records...');
    try {
      const query = 'SELECT Id, Name FROM Voice_Call_Info__c LIMIT 5';
      const result = await salesforce.query(query);

      if (result.totalSize > 0) {
        console.log(`✅ Found ${result.totalSize} records`);

        // Get full details of first record
        const firstRecordQuery = `SELECT ${describe.fields.map(f => f.name).join(', ')} FROM Voice_Call_Info__c LIMIT 1`;
        const fullRecord = await salesforce.query(firstRecordQuery);

        if (fullRecord.totalSize > 0) {
          const record = fullRecord.records[0];
          console.log('\n📋 Sample record fields with values:\n');
          Object.keys(record).forEach(key => {
            if (record[key] && key !== 'attributes') {
              console.log(`   ${key}: ${JSON.stringify(record[key]).substring(0, 150)}`);
            }
          });
        }
      } else {
        console.log('⚠️  No Voice_Call_Info__c records found');
      }
    } catch (error) {
      console.log(`❌ Error querying: ${error.message}`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

checkVoiceCallInfo();
