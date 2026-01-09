#!/usr/bin/env node

/**
 * Test Salesforce API Authentication
 *
 * Verifies Salesforce credentials and tests basic API connectivity
 */

import dotenv from 'dotenv';
import { SalesforceAPI } from './salesforce-api.mjs';

dotenv.config({ path: '.env.local' });

async function testAuth() {
  try {
    console.log('🔍 Testing Salesforce API Authentication...\n');

    // Check environment variables
    console.log('📋 Configuration:');
    console.log(`   Instance URL: ${process.env.SALESFORCE_INSTANCE_URL || '❌ Not set'}`);
    console.log(`   Client ID: ${process.env.SALESFORCE_CLIENT_ID ? '✅ Set' : '❌ Not set'}`);
    console.log(`   Client Secret: ${process.env.SALESFORCE_CLIENT_SECRET ? '✅ Set' : '❌ Not set'}`);
    console.log(`   Username: ${process.env.SALESFORCE_USERNAME ? '✅ Set' : '❌ Not set'}`);
    console.log(`   Password: ${process.env.SALESFORCE_PASSWORD ? '✅ Set' : '❌ Not set'}`);
    console.log(`   API Version: ${process.env.SALESFORCE_API_VERSION || 'v61.0 (default)'}\n`);

    if (!process.env.SALESFORCE_INSTANCE_URL || !process.env.SALESFORCE_CLIENT_ID || !process.env.SALESFORCE_CLIENT_SECRET) {
      console.error('❌ Missing required Salesforce credentials in .env.local');
      console.log('\nRequired environment variables:');
      console.log('   SALESFORCE_INSTANCE_URL=https://yourinstance.my.salesforce.com');
      console.log('   SALESFORCE_CLIENT_ID=your_consumer_key');
      console.log('   SALESFORCE_CLIENT_SECRET=your_consumer_secret');
      console.log('\nOptional (for Username-Password flow):');
      console.log('   SALESFORCE_USERNAME=your_username');
      console.log('   SALESFORCE_PASSWORD=your_password+security_token');
      console.log('   SALESFORCE_API_VERSION=v61.0');
      console.log('\nSee SALESFORCE_RECORDING_INTEGRATION.md for setup instructions.');
      process.exit(1);
    }

    // Initialize Salesforce API
    const salesforce = new SalesforceAPI(
      process.env.SALESFORCE_INSTANCE_URL,
      process.env.SALESFORCE_CLIENT_ID,
      process.env.SALESFORCE_CLIENT_SECRET,
      process.env.SALESFORCE_API_VERSION || 'v61.0',
      process.env.SALESFORCE_USERNAME,
      process.env.SALESFORCE_PASSWORD
    );

    // Test authentication
    console.log('🔐 Testing authentication...');
    await salesforce.authenticate();
    console.log(`   Access Token: ${salesforce.accessToken.substring(0, 20)}...`);
    console.log(`   Instance URL: ${salesforce.instanceUrl}\n`);

    // Test simple query
    console.log('🔍 Testing SOQL query...');
    const testQuery = 'SELECT Id, Name FROM User LIMIT 1';
    const result = await salesforce.query(testQuery);
    console.log(`   Query: ${testQuery}`);
    console.log(`   Results: ${result.totalSize} record(s)\n`);

    // Describe VoiceCallRecording object
    console.log('📋 Describing VoiceCallRecording object...');
    const describe = await salesforce.describeVoiceCallRecording();
    console.log(`   Label: ${describe.label}`);
    console.log(`   API Name: ${describe.name}`);
    console.log(`   Queryable: ${describe.queryable ? '✅' : '❌'}`);
    console.log(`   Fields: ${describe.fields.length}`);

    // Show important fields
    console.log('\n   Important Fields:');
    const importantFields = ['Id', 'VoiceCallId', 'MediaSrc', 'CallRecordingUrl', 'CreatedDate'];
    importantFields.forEach(fieldName => {
      const field = describe.fields.find(f => f.name === fieldName);
      if (field) {
        console.log(`      ${field.name.padEnd(20)} - ${field.type} ${field.label ? `(${field.label})` : ''}`);
      } else {
        console.log(`      ${fieldName.padEnd(20)} - ❌ Not found`);
      }
    });

    // Check if we have access to VoiceCallRecording records
    console.log('\n🔍 Checking VoiceCallRecording records...');
    const countQuery = 'SELECT COUNT() FROM VoiceCallRecording';
    const countResult = await salesforce.query(countQuery);
    console.log(`   Total VoiceCallRecording records: ${countResult.totalSize}\n`);

    if (countResult.totalSize > 0) {
      console.log('📊 Sample VoiceCallRecording record:');
      const sampleQuery = 'SELECT Id, VoiceCallId, MediaSrc, CallRecordingUrl, CreatedDate FROM VoiceCallRecording LIMIT 1';
      const sampleResult = await salesforce.query(sampleQuery);

      if (sampleResult.records && sampleResult.records.length > 0) {
        const sample = sampleResult.records[0];
        console.log(`   ID: ${sample.Id}`);
        console.log(`   VoiceCallId: ${sample.VoiceCallId}`);
        console.log(`   MediaSrc: ${sample.MediaSrc || 'null'}`);
        console.log(`   CallRecordingUrl: ${sample.CallRecordingUrl || 'null'}`);
        console.log(`   CreatedDate: ${sample.CreatedDate}\n`);
      }
    } else {
      console.log('⚠️  No VoiceCallRecording records found. This might be normal if:');
      console.log('   - Call recordings are not enabled');
      console.log('   - No calls have been recorded yet');
      console.log('   - The integration user lacks read permissions\n');
    }

    console.log('✅ All tests passed!');
    console.log('\n💡 Next steps:');
    console.log('   1. Run: node scripts/test-salesforce-recordings.mjs');
    console.log('   2. Update daily-sync-domo.mjs to fetch recording URLs');
    console.log('   3. See SALESFORCE_RECORDING_INTEGRATION.md for full implementation');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('   1. Verify credentials in .env.local');
    console.error('   2. Check Connected App is approved in Salesforce');
    console.error('   3. Ensure Client Credentials Flow is enabled');
    console.error('   4. Verify integration user has proper permissions');
    console.error('\nSee SALESFORCE_RECORDING_INTEGRATION.md for detailed setup instructions.');
    process.exit(1);
  }
}

testAuth();
