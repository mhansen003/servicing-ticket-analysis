#!/usr/bin/env node

/**
 * Check Domo Dataset Options
 *
 * Examines dataset metadata and explores API options for getting full conversation data
 */

import dotenv from 'dotenv';
import { DomoAPI } from './domo-api.mjs';

dotenv.config({ path: '.env.local' });

const domo = new DomoAPI(
  process.env.DOMO_CLIENT_ID,
  process.env.DOMO_CLIENT_SECRET,
  process.env.DOMO_ENVIRONMENT || 'cmgfi'
);

async function checkOptions() {
  try {
    console.log('🔍 Checking Domo Dataset Options...\n');

    // Get dataset metadata
    const info = await domo.getDatasetInfo(process.env.DOMO_DATASET_ID);

    console.log('📊 DATASET INFO:');
    console.log(`   Name: ${info.name}`);
    console.log(`   Owner: ${info.owner?.name || 'Unknown'}`);
    console.log(`   Rows: ${info.rows?.toLocaleString() || 'Unknown'}`);
    console.log(`   Columns: ${info.columns || 'Unknown'}`);
    console.log(`   Created: ${info.createdAt}`);
    console.log(`   Updated: ${info.updatedAt}`);

    if (info.schema && info.schema.columns) {
      console.log(`\n📋 SCHEMA (${info.schema.columns.length} columns):`);

      // Find the Conversation field
      const conversationCol = info.schema.columns.find(c => c.name === 'Conversation');

      if (conversationCol) {
        console.log('\n✅ Found Conversation column:');
        console.log(`   Type: ${conversationCol.type}`);
        console.log(`   Description: ${conversationCol.description || 'N/A'}`);

        // Check if there's a maxLength property
        if (conversationCol.maxLength) {
          console.log(`   Max Length: ${conversationCol.maxLength}`);
        } else {
          console.log(`   Max Length: Not specified (might be unlimited)`);
        }
      }

      // Show all column names and types
      console.log('\n📝 ALL COLUMNS:');
      info.schema.columns.forEach((col, idx) => {
        const typeInfo = col.maxLength ? `${col.type}(${col.maxLength})` : col.type;
        console.log(`   ${idx + 1}. ${col.name.padEnd(30)} - ${typeInfo}`);
      });
    }

    console.log('\n\n💡 RECOMMENDATIONS:');
    console.log('─'.repeat(80));

    console.log('\n1. **Full Export Method** (exportDatasetFull):');
    console.log('   ✅ Pros: Gets complete Conversation field (no truncation)');
    console.log('   ❌ Cons: Exports entire dataset, no date filtering');
    console.log('   💡 Use for: Initial backfill, filter dates client-side');

    console.log('\n2. **Query Method** (fetchDataset with SQL):');
    console.log('   ✅ Pros: Can filter by date, efficient');
    console.log('   ❌ Cons: Truncates at 1024 chars');
    console.log('   💡 Use for: Hourly syncs (if we can work with truncation)');

    console.log('\n3. **Hybrid Approach**:');
    console.log('   1. Use exportDatasetFull for initial backfill');
    console.log('   2. Filter to Dec 1, 2025 forward client-side');
    console.log('   3. For hourly syncs, use full export + filter (slow but complete)');
    console.log('   4. OR: Accept 1024-char limit for hourly syncs');

    console.log('\n\n📊 DATASET SIZE ESTIMATE:');
    if (info.rows) {
      const totalRows = info.rows;
      const dec1Estimate = Math.round(totalRows * 0.1); // Rough estimate
      console.log(`   Total rows: ${totalRows.toLocaleString()}`);
      console.log(`   Estimated Dec 1+ rows: ~${dec1Estimate.toLocaleString()}`);
      console.log(`   Download time: ${Math.round(totalRows / 1000)} - ${Math.round(totalRows / 500)} minutes`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

checkOptions();
