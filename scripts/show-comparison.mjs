#!/usr/bin/env node

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function showComparison() {
  console.log('📊 Comparing Raw Transcript vs AI-Enhanced Analysis\n');
  console.log('═══════════════════════════════════════════════════\n');

  // Get a transcript that has been analyzed
  const result = await pool.query(`
    SELECT
      t.vendor_call_key,
      t.agent_name,
      t.department,
      t.disposition,
      t.duration_seconds,
      t.call_start,
      t.messages,
      a."agentSentiment",
      a."agentSentimentScore",
      a."agentSentimentReason",
      a."customerSentiment",
      a."customerSentimentScore",
      a."customerSentimentReason",
      a."aiDiscoveredTopic",
      a."aiDiscoveredSubcategory",
      a."topicConfidence",
      a."keyIssues",
      a.resolution,
      a.tags,
      a."analyzedAt"
    FROM transcripts t
    INNER JOIN "TranscriptAnalysis" a ON t.vendor_call_key = a."vendorCallKey"
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    console.log('❌ No analyzed transcripts found yet\n');
    await pool.end();
    return;
  }

  const record = result.rows[0];

  console.log('🔵 RAW TRANSCRIPT DATA (from transcripts table):\n');
  console.log(`   Vendor Call Key: ${record.vendor_call_key}`);
  console.log(`   Agent: ${record.agent_name}`);
  console.log(`   Department: ${record.department}`);
  console.log(`   Disposition: ${record.disposition}`);
  console.log(`   Duration: ${record.duration_seconds} seconds`);
  console.log(`   Call Start: ${record.call_start}`);
  console.log(`   Message Count: ${record.messages.length} messages`);

  // Show first 3 and last 3 messages
  console.log(`\n   📝 Conversation Sample (first 3 messages):`);
  record.messages.slice(0, 3).forEach((msg, i) => {
    const text = msg.text.length > 100 ? msg.text.substring(0, 100) + '...' : msg.text;
    console.log(`      ${i + 1}. ${msg.speaker}: ${text}`);
  });

  if (record.messages.length > 3) {
    console.log(`      ... (${record.messages.length - 6} messages omitted)`);
    console.log(`\n   📝 Last 3 messages:`);
    record.messages.slice(-3).forEach((msg, i) => {
      const text = msg.text.length > 100 ? msg.text.substring(0, 100) + '...' : msg.text;
      console.log(`      ${record.messages.length - 3 + i + 1}. ${msg.speaker}: ${text}`);
    });
  }

  console.log('\n\n🟢 AI-ENHANCED ANALYSIS (from TranscriptAnalysis table):\n');
  console.log(`   Analyzed At: ${record.analyzedAt}`);
  console.log(`\n   👤 AGENT PERFORMANCE:`);
  console.log(`      Sentiment: ${record.agentSentiment} (Score: ${record.agentSentimentScore})`);
  console.log(`      Reason: ${record.agentSentimentReason}`);

  console.log(`\n   😊 CUSTOMER SATISFACTION:`);
  console.log(`      Sentiment: ${record.customerSentiment} (Score: ${record.customerSentimentScore})`);
  console.log(`      Reason: ${record.customerSentimentReason}`);

  console.log(`\n   🎯 TOPIC CLASSIFICATION:`);
  console.log(`      Topic: ${record.aiDiscoveredTopic}`);
  console.log(`      Subcategory: ${record.aiDiscoveredSubcategory}`);
  console.log(`      Confidence: ${record.topicConfidence}`);

  console.log(`\n   🔑 KEY ISSUES:`);
  record.keyIssues.forEach((issue, i) => {
    console.log(`      ${i + 1}. ${issue}`);
  });

  console.log(`\n   ✅ RESOLUTION: ${record.resolution}`);

  console.log(`\n   🏷️  TAGS: ${record.tags.join(', ')}`);

  console.log('\n\n═══════════════════════════════════════════════════\n');

  // Show count of analyzed vs unanalyzed
  const counts = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM transcripts) as total_transcripts,
      (SELECT COUNT(*) FROM "TranscriptAnalysis") as analyzed_transcripts
  `);

  console.log('📈 DATABASE STATS:\n');
  console.log(`   Total Transcripts: ${counts.rows[0].total_transcripts}`);
  console.log(`   AI-Enhanced: ${counts.rows[0].analyzed_transcripts}`);
  console.log(`   Remaining: ${counts.rows[0].total_transcripts - counts.rows[0].analyzed_transcripts}\n`);

  await pool.end();
}

showComparison().catch(error => {
  console.error('Error:', error);
  pool.end();
  process.exit(1);
});
