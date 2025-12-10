#!/usr/bin/env node

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verify() {
  console.log('📊 Verifying saved analyses...\n');

  const result = await pool.query(`
    SELECT
      "vendorCallKey",
      "agentName",
      "agentSentiment",
      "agentSentimentScore",
      "customerSentiment",
      "customerSentimentScore",
      "aiDiscoveredTopic",
      "aiDiscoveredSubcategory"
    FROM "TranscriptAnalysis"
    ORDER BY "analyzedAt" DESC
    LIMIT 5
  `);

  console.log(`Found ${result.rows.length} analyses:\n`);

  result.rows.forEach((row, i) => {
    console.log(`${i + 1}. ${row.vendorCallKey}`);
    console.log(`   Agent: ${row.agentName}`);
    console.log(`   Agent Sentiment: ${row.agentSentiment} (${row.agentSentimentScore})`);
    console.log(`   Customer Sentiment: ${row.customerSentiment} (${row.customerSentimentScore})`);
    console.log(`   Topic: ${row.aiDiscoveredTopic} / ${row.aiDiscoveredSubcategory}`);
    console.log('');
  });

  // Also check total count
  const count = await pool.query('SELECT COUNT(*) FROM "TranscriptAnalysis"');
  console.log(`\n✅ Total analyses in database: ${count.rows[0].count}\n`);

  await pool.end();
}

verify().catch(error => {
  console.error('Error:', error);
  pool.end();
  process.exit(1);
});
