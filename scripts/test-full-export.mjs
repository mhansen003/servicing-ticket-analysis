#!/usr/bin/env node

/**
 * Test Full Dataset Export (No Truncation)
 *
 * Tests if the Domo Data Export API gives us complete Conversation fields
 */

import dotenv from 'dotenv';
import { DomoAPI } from './domo-api.mjs';

dotenv.config({ path: '.env.local' });

const domo = new DomoAPI(
  process.env.DOMO_CLIENT_ID,
  process.env.DOMO_CLIENT_SECRET,
  process.env.DOMO_ENVIRONMENT || 'cmgfi'
);

async function testFullExport() {
  try {
    console.log('🧪 Testing Full Dataset Export...\n');

    // This exports the ENTIRE dataset (no filtering)
    // We'll just check the first few records
    console.log('⚠️  WARNING: This exports the entire dataset');
    console.log('   We will check first 3 records for conversation completeness\n');

    const records = await domo.exportDatasetFull(process.env.DOMO_DATASET_ID);

    console.log(`\n✅ Exported ${records.length.toLocaleString()} total records`);
    console.log('\n📋 Analyzing first 3 records...\n');

    for (let i = 0; i < Math.min(3, records.length); i++) {
      const record = records[i];
      console.log(`\n${'='.repeat(80)}`);
      console.log(`RECORD ${i + 1}: ${record.VendorCallKey}`);
      console.log('-'.repeat(80));

      if (record.Conversation) {
        const convLength = record.Conversation.length;
        console.log(`✅ Conversation field length: ${convLength} chars`);

        if (convLength > 1024) {
          console.log('🎉 SUCCESS! Conversation is LONGER than 1024 chars (not truncated)');
        } else if (convLength === 1024) {
          console.log('⚠️  WARNING: Exactly 1024 chars - might still be truncated');
        } else {
          console.log('✅ Shorter conversation (may be complete)');
        }

        // Try to parse
        try {
          const parsed = JSON.parse(record.Conversation);
          if (parsed.conversationEntries) {
            console.log(`✅ Successfully parsed! Has ${parsed.conversationEntries.length} message entries`);

            // Show a sample message
            if (parsed.conversationEntries.length > 0) {
              const firstMsg = parsed.conversationEntries[0];
              console.log(`\nSample message:`);
              console.log(`  Speaker: ${firstMsg.sender?.role || 'Unknown'}`);
              console.log(`  Text: ${firstMsg.messageText?.substring(0, 100)}...`);
            }
          }
        } catch (e) {
          console.log(`❌ Parse FAILED: ${e.message}`);
        }
      } else {
        console.log('❌ No Conversation field');
      }
    }

    // Check date range
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('📅 DATE RANGE CHECK');
    console.log('-'.repeat(80));

    const dates = records
      .map(r => r.CallStartDateTime)
      .filter(Boolean)
      .sort();

    if (dates.length > 0) {
      console.log(`Oldest: ${dates[0]}`);
      console.log(`Newest: ${dates[dates.length - 1]}`);

      const dec1Count = records.filter(r =>
        r.CallStartDateTime && r.CallStartDateTime >= '2025-12-01'
      ).length;

      console.log(`\n✅ Records from Dec 1, 2025 forward: ${dec1Count.toLocaleString()}`);
    }

    console.log('\n✅ Test complete!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

testFullExport();
