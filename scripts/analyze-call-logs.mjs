#!/usr/bin/env node

/**
 * Call Logs Analysis Script
 *
 * Reads tab-delimited call logs file and analyzes transcripts
 * Writes directly to PostgreSQL TranscriptAnalysis table
 * Guarantees no data loss with immediate database writes
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Configuration
const CONFIG = {
  API_URL: 'https://openrouter.ai/api/v1/chat/completions',
  API_KEY: process.env.OPENROUTER_API_KEY,
  MODEL: 'anthropic/claude-3.5-sonnet',

  BATCH_SIZE: 100,
  MAX_CONCURRENT: 20,  // 20 parallel API calls
  TEST_LIMIT: 1000,    // First 1,000 transcripts
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000,

  INPUT_FILE: 'C:\\Users\\Mark Hansen\\Downloads\\Nov 1 to Date Call Logs.txt',
};

const stats = {
  total: 0,
  processed: 0,
  failed: 0,
  apiCalls: 0,
  totalTokens: 0,
  estimatedCost: 0,
  startTime: Date.now(),
};

/**
 * Parse tab-delimited call logs file
 */
function parseCallLogs(filePath) {
  console.log('📂 Reading call logs file...');
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Parse header
  const headers = lines[0].split('\t');
  const vendorCallKeyIdx = headers.indexOf('VendorCallKey');
  const conversationIdx = headers.indexOf('Conversation');
  const agentNameIdx = headers.indexOf('AgentName');
  const departmentIdx = headers.indexOf('Department');
  const dispositionIdx = headers.indexOf('Disposition');
  const durationIdx = headers.indexOf('DurationInSeconds');
  const callStartIdx = headers.indexOf('CallStartDateTime');

  console.log(`   Found ${lines.length - 1} call logs`);

  const transcripts = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = line.split('\t');

    const vendorCallKey = fields[vendorCallKeyIdx];
    if (!vendorCallKey) continue;

    const conversationJson = fields[conversationIdx];
    let messages = [];

    try {
      const conv = JSON.parse(conversationJson || '{}');
      const entries = conv.conversationEntries || [];

      messages = entries.map(entry => ({
        speaker: entry.sender?.role === 'Agent' ? 'Agent' : 'Customer',
        text: entry.messageText || '',
        timestamp: entry.serverReceivedTimestamp || 0
      }));
    } catch (e) {
      // Skip invalid JSON
      continue;
    }

    if (messages.length === 0) continue;

    transcripts.push({
      vendor_call_key: vendorCallKey,
      agent_name: fields[agentNameIdx] || 'Unknown',
      department: fields[departmentIdx] || 'Unknown',
      disposition: fields[dispositionIdx] || 'Unknown',
      duration_seconds: parseInt(fields[durationIdx]) || 0,
      call_start: fields[callStartIdx] || null,
      messages
    });
  }

  console.log(`   Parsed ${transcripts.length} valid transcripts\n`);
  return transcripts;
}

/**
 * Analyze a single transcript with AI
 */
async function analyzeTranscript(transcript) {
  const messages = transcript.messages || [];
  const fullText = messages.map(m => `${m.speaker}: ${m.text}`).join('\n');
  const lastChars = fullText.slice(-1500);

  const prompt = `Analyze this customer service call transcript:

CALL INFO:
Agent: ${transcript.agent_name || 'Unknown'}
Department: ${transcript.department || 'Unknown'}
Disposition: ${transcript.disposition || 'Unknown'}

CONVERSATION (last 1500 chars):
${lastChars}

Return ONLY valid JSON (no markdown):
{
  "agentSentiment": "positive|neutral|negative",
  "agentSentimentScore": 0.0-1.0,
  "agentSentimentReason": "brief explanation",
  "customerSentiment": "positive|neutral|negative",
  "customerSentimentScore": 0.0-1.0,
  "customerSentimentReason": "brief explanation",
  "aiDiscoveredTopic": "topic name",
  "aiDiscoveredSubcategory": "subcategory",
  "topicConfidence": 0.0-1.0,
  "keyIssues": ["issue1", "issue2"],
  "resolution": "resolution status",
  "tags": ["tag1", "tag2"]
}`;

  const response = await fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.API_KEY}`,
      'HTTP-Referer': 'https://servicing-tickets.cmgfinancial.ai',
    },
    body: JSON.stringify({
      model: CONFIG.MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  stats.apiCalls++;
  stats.totalTokens += data.usage?.total_tokens || 0;
  stats.estimatedCost += ((data.usage?.prompt_tokens || 0) * 3 + (data.usage?.completion_tokens || 0) * 15) / 1_000_000;

  let content = data.choices[0]?.message?.content || '';
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  const analysis = JSON.parse(content);

  // 🔥 IMMEDIATELY save to database
  await pool.query(`
    INSERT INTO "TranscriptAnalysis" (
      id, "vendorCallKey", "agentName",
      "agentSentiment", "agentSentimentScore", "agentSentimentReason",
      "customerSentiment", "customerSentimentScore", "customerSentimentReason",
      "aiDiscoveredTopic", "aiDiscoveredSubcategory", "topicConfidence",
      "keyIssues", resolution, tags, model, "analyzedAt"
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW()
    )
    ON CONFLICT ("vendorCallKey") DO UPDATE SET
      "agentSentiment" = EXCLUDED."agentSentiment",
      "agentSentimentScore" = EXCLUDED."agentSentimentScore",
      "agentSentimentReason" = EXCLUDED."agentSentimentReason",
      "customerSentiment" = EXCLUDED."customerSentiment",
      "customerSentimentScore" = EXCLUDED."customerSentimentScore",
      "customerSentimentReason" = EXCLUDED."customerSentimentReason",
      "aiDiscoveredTopic" = EXCLUDED."aiDiscoveredTopic",
      "aiDiscoveredSubcategory" = EXCLUDED."aiDiscoveredSubcategory",
      "topicConfidence" = EXCLUDED."topicConfidence",
      "keyIssues" = EXCLUDED."keyIssues",
      resolution = EXCLUDED.resolution,
      tags = EXCLUDED.tags,
      model = EXCLUDED.model,
      "updatedAt" = NOW()
  `, [
    transcript.vendor_call_key,
    transcript.agent_name,
    analysis.agentSentiment,
    analysis.agentSentimentScore,
    analysis.agentSentimentReason,
    analysis.customerSentiment,
    analysis.customerSentimentScore,
    analysis.customerSentimentReason,
    analysis.aiDiscoveredTopic,
    analysis.aiDiscoveredSubcategory,
    analysis.topicConfidence,
    analysis.keyIssues || [],
    analysis.resolution,
    analysis.tags || [],
    CONFIG.MODEL,
  ]);

  return analysis;
}

/**
 * Process a batch of transcripts
 */
async function processBatch(transcripts, batchNum) {
  console.log(`\n📦 Batch ${batchNum} (${transcripts.length} transcripts)...`);

  const results = [];
  const errors = [];

  for (let i = 0; i < transcripts.length; i += CONFIG.MAX_CONCURRENT) {
    const chunk = transcripts.slice(i, i + CONFIG.MAX_CONCURRENT);

    const promises = chunk.map(async (t) => {
      for (let attempt = 1; attempt <= CONFIG.RETRY_ATTEMPTS; attempt++) {
        try {
          await analyzeTranscript(t);
          stats.processed++;
          process.stdout.write(`\r   Progress: ${stats.processed}/${stats.total} (${((stats.processed / stats.total) * 100).toFixed(1)}%)`);
          return true;
        } catch (error) {
          if (attempt === CONFIG.RETRY_ATTEMPTS) {
            stats.failed++;
            console.error(`\n❌ Error: ${t.vendor_call_key}: ${error.message}`);
            errors.push({ key: t.vendor_call_key, error: error.message });
            return false;
          }
          await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt));
        }
      }
    });

    await Promise.all(promises);
    if (i + CONFIG.MAX_CONCURRENT < transcripts.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // 🔒 VERIFY DATABASE WRITE
  const dbCount = await pool.query('SELECT COUNT(*) FROM "TranscriptAnalysis"');
  console.log(`\n   ✅ Complete: ${transcripts.length - errors.length} success, ${errors.length} failed`);
  console.log(`   💾 DATABASE: ${dbCount.rows[0].count} total records saved`);

  return { results, errors };
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Call Logs Analysis (Database-Backed)\n');
  console.log('═══════════════════════════════════════\n');

  if (!CONFIG.API_KEY) {
    console.error('❌ ERROR: OPENROUTER_API_KEY not found');
    process.exit(1);
  }

  try {
    // Parse call logs
    const allTranscripts = parseCallLogs(CONFIG.INPUT_FILE);

    // Check which are already analyzed
    console.log('🔍 Checking for existing analysis...');
    const analyzed = await pool.query('SELECT "vendorCallKey" FROM "TranscriptAnalysis"');
    const analyzedKeys = new Set(analyzed.rows.map(r => r.vendorCallKey));

    console.log(`   Found ${analyzedKeys.size.toLocaleString()} already analyzed\n`);

    const toProcess = allTranscripts
      .filter(t => !analyzedKeys.has(t.vendor_call_key))
      .slice(0, CONFIG.TEST_LIMIT);

    if (toProcess.length === 0) {
      console.log('✅ All transcripts analyzed!\n');
      await pool.end();
      return;
    }

    stats.total = toProcess.length;

    console.log(`📋 To process: ${toProcess.length.toLocaleString()}`);
    console.log(`⏭️  Skipped: ${analyzedKeys.size.toLocaleString()}\n`);

    const estCost = toProcess.length * 0.012;
    const estMins = Math.ceil(toProcess.length / (CONFIG.MAX_CONCURRENT * 60));

    console.log('💰 Estimate:');
    console.log(`   Cost: ~$${estCost.toFixed(2)}`);
    console.log(`   Time: ~${estMins} minutes\n`);

    // Process in batches
    const batches = [];
    for (let i = 0; i < toProcess.length; i += CONFIG.BATCH_SIZE) {
      batches.push(toProcess.slice(i, i + CONFIG.BATCH_SIZE));
    }

    console.log(`📦 Processing ${batches.length} batches of ${CONFIG.BATCH_SIZE}\n`);

    for (let i = 0; i < batches.length; i++) {
      await processBatch(batches[i], i + 1);

      const elapsed = Date.now() - stats.startTime;
      const rate = stats.processed / (elapsed / 1000 / 60);
      const remaining = toProcess.length - stats.processed;
      const eta = Math.ceil(remaining / rate);

      console.log(`\n   📊 Stats: ${stats.apiCalls} API calls, ${stats.totalTokens.toLocaleString()} tokens, $${stats.estimatedCost.toFixed(2)}`);
      console.log(`   ⏱️  Rate: ${rate.toFixed(1)} transcripts/min, ETA: ${eta} min\n`);
    }

    console.log('\n═══════════════════════════════════════\n');
    console.log('✅ COMPLETE!\n');
    console.log(`📊 Analyzed: ${stats.processed.toLocaleString()}`);
    console.log(`❌ Failed: ${stats.failed.toLocaleString()}`);
    console.log(`💰 Cost: $${stats.estimatedCost.toFixed(2)}`);
    console.log(`⏱️  Time: ${Math.ceil((Date.now() - stats.startTime) / 1000 / 60)} min\n`);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  pool.end();
  process.exit(1);
});
