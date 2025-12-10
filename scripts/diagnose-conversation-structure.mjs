#!/usr/bin/env node

/**
 * Diagnostic Script: Inspect Conversation Field Structure
 *
 * Fetches a few records from Domo and prints the Conversation field
 * to understand why parsing is failing
 */

import dotenv from 'dotenv';
import { DomoAPI } from './domo-api.mjs';

dotenv.config({ path: '.env.local' });

const domo = new DomoAPI(
  process.env.DOMO_CLIENT_ID,
  process.env.DOMO_CLIENT_SECRET,
  process.env.DOMO_ENVIRONMENT || 'cmgfi'
);

async function diagnoseConversations() {
  console.log('🔍 Fetching sample records from Domo...\n');

  // Fetch just 5 records for diagnosis
  const records = await domo.fetchDataset(process.env.DOMO_DATASET_ID, {
    startDate: '2025-12-01',
    limit: 5
  });

  console.log(`✅ Fetched ${records.length} records\n`);
  console.log('='.repeat(80));

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    console.log(`\nRECORD ${i + 1}: ${record.VendorCallKey}`);
    console.log('-'.repeat(80));

    console.log('\n📋 Available Fields:');
    console.log(Object.keys(record).join(', '));

    console.log('\n📝 Conversation Field:');
    if (record.Conversation) {
      console.log('Type:', typeof record.Conversation);
      console.log('Length:', record.Conversation.length || 'N/A');
      console.log('First 500 chars:', record.Conversation.substring(0, 500));

      // Try to parse
      try {
        const parsed = typeof record.Conversation === 'string'
          ? JSON.parse(record.Conversation)
          : record.Conversation;
        console.log('\n✅ PARSED SUCCESSFULLY!');
        console.log('Parsed Keys:', Object.keys(parsed).join(', '));

        // Check for conversationEntries
        if (parsed.conversationEntries) {
          console.log(`✅ Has conversationEntries (${parsed.conversationEntries.length} entries)`);
          if (parsed.conversationEntries.length > 0) {
            console.log('First Entry:', JSON.stringify(parsed.conversationEntries[0], null, 2));
          }
        } else {
          console.log('❌ NO conversationEntries field');
          console.log('Full structure:', JSON.stringify(parsed, null, 2).substring(0, 1000));
        }
      } catch (e) {
        console.log(`❌ FAILED TO PARSE: ${e.message}`);
      }
    } else {
      console.log('❌ Conversation field is null/undefined');
    }

    console.log('\n📝 ConversationEntries Field (if separate):');
    if (record.ConversationEntries) {
      console.log('Type:', typeof record.ConversationEntries);
      console.log('First 500 chars:', String(record.ConversationEntries).substring(0, 500));
    } else {
      console.log('Not present');
    }

    console.log('\n' + '='.repeat(80));
  }
}

diagnoseConversations()
  .then(() => {
    console.log('\n✅ Diagnosis complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Diagnosis failed:', error);
    process.exit(1);
  });
