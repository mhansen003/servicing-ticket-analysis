#!/usr/bin/env node

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testAPIData() {
  console.log('📊 Testing Transcript Analytics Data\n');

  try {
    // Get counts
    const totalsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM transcripts) as total_transcripts,
        (SELECT COUNT(*) FROM "TranscriptAnalysis") as analyzed_count
    `);

    const { total_transcripts, analyzed_count } = totalsResult.rows[0];
    const progress = ((analyzed_count / total_transcripts) * 100).toFixed(1);

    console.log(`✅ Total Transcripts: ${total_transcripts.toLocaleString()}`);
    console.log(`✅ Analyzed Transcripts: ${analyzed_count.toLocaleString()}`);
    console.log(`✅ Progress: ${progress}%\n`);

    // Get sentiment breakdown
    const sentimentResult = await pool.query(`
      SELECT
        "agentSentiment",
        "customerSentiment",
        COUNT(*) as count
      FROM "TranscriptAnalysis"
      GROUP BY "agentSentiment", "customerSentiment"
      ORDER BY count DESC
      LIMIT 10
    `);

    console.log('📈 Top Sentiment Combinations:');
    sentimentResult.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. Agent: ${row.agentSentiment}, Customer: ${row.customerSentiment} - ${row.count} calls`);
    });

    //Get top topics
    const topicsResult = await pool.query(`
      SELECT
        "aiDiscoveredTopic",
        COUNT(*) as count,
        AVG("topicConfidence") as avg_confidence
      FROM "TranscriptAnalysis"
      WHERE "aiDiscoveredTopic" IS NOT NULL
      GROUP BY "aiDiscoveredTopic"
      ORDER BY count DESC
      LIMIT 10
    `);

    console.log(`\n🎯 Top 10 AI-Discovered Topics:`);
    topicsResult.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.aiDiscoveredTopic} - ${row.count} calls (${(row.avg_confidence * 100).toFixed(0)}% avg confidence)`);
    });

    console.log('\n✅ API data is ready!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testAPIData();
