#!/usr/bin/env node

import dotenv from 'dotenv';
import { DomoAPI } from './domo-api.mjs';

dotenv.config({ path: '.env.local' });

const domo = new DomoAPI(
  process.env.DOMO_CLIENT_ID,
  process.env.DOMO_CLIENT_SECRET,
  process.env.DOMO_ENVIRONMENT || 'cmgfi'
);

async function verifyConversation() {
  console.log('🧪 Verifying complete conversation data...\n');

  // Get first 3 records from Dec 9
  const records = await domo.exportDatasetFull(process.env.DOMO_DATASET_ID, {
    startDate: '2025-12-09',
    limit: 3
  });

  console.log(`\n${'='.repeat(80)}`);

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    console.log(`\nRECORD ${i + 1}: ${record.VendorCallKey}`);
    console.log('-'.repeat(80));

    if (record.Conversation) {
      const convLength = record.Conversation.length;
      console.log(`✅ Conversation field length: ${convLength.toLocaleString()} chars`);

      if (convLength > 1024) {
        console.log('🎉 SUCCESS! Conversation is COMPLETE (longer than 1024 chars)');
      } else if (convLength === 1024) {
        console.log('⚠️  WARNING: Exactly 1024 chars - might be truncated');
      } else {
        console.log('✅ Short conversation (complete)');
      }

      // Try to parse
      try {
        const parsed = JSON.parse(record.Conversation);
        if (parsed.conversationEntries) {
          console.log(`✅ Parsed successfully! Has ${parsed.conversationEntries.length} messages`);

          // Calculate total text length
          const totalText = parsed.conversationEntries
            .map(e => e.messageText || '')
            .join(' ')
            .length;

          console.log(`✅ Total conversation text: ${totalText.toLocaleString()} chars`);

          // Show first message
          if (parsed.conversationEntries.length > 0) {
            const first = parsed.conversationEntries[0];
            console.log(`\nFirst message:`);
            console.log(`  Speaker: ${first.sender?.role || 'Unknown'}`);
            console.log(`  Text: ${(first.messageText || '').substring(0, 80)}...`);
          }
        }
      } catch (e) {
        console.log(`❌ Parse FAILED: ${e.message}`);
      }
    } else {
      console.log('❌ No Conversation field');
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('\n✅ Verification complete!');
}

verifyConversation();
