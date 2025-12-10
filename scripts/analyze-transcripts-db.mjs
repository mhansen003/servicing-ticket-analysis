#!/usr/bin/env node

/**
 * Deep AI Analysis Script for Transcripts - DATABASE VERSION
 *
 * Features:
 * - Reads transcripts from PostgreSQL `transcripts` table
 * - Writes analysis directly to `TranscriptAnalysis` table
 * - Dual sentiment analysis (Agent vs Customer)
 * - AI-discovered topics/subcategories
 * - Automatic resume capability
 * - Zero data loss - every transcript saved immediately
 */

import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
const { Pool } = pg;

// Load .env.local explicitly (dotenv/config only loads .env by default)
dotenv.config({ path: '.env.local' });

// Verify DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL not found in environment');
  console.error('   Please check .env.local file');
  process.exit(1);
}

// Create PostgreSQL pool and adapter for Prisma v7 (using pg driver for Node.js environment)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);

// Initialize Prisma Client with adapter
const prisma = new PrismaClient({ adapter });

// Configuration
const CONFIG = {
  // API Configuration
  API_URL: 'https://openrouter.ai/api/v1/chat/completions',
  API_KEY: process.env.OPENROUTER_API_KEY,
  MODEL: 'mistralai/ministral-3b-2512', // Free model to test if 403 is model-specific

  // Batch Processing
  BATCH_SIZE: 20,         // Process 20 at a time
  MAX_CONCURRENT: 3,      // 3 parallel API calls (very conservative to avoid 403)
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000,
  TEST_LIMIT: null,       // Set to null to process ALL transcripts

  // Analysis Parameters
  LAST_N_CHARS: 1500, // Analyze last 1500 chars for sentiment
};

// Statistics tracking
const stats = {
  total: 0,
  processed: 0,
  failed: 0,
  skipped: 0,
  apiCalls: 0,
  totalTokens: 0,
  startTime: Date.now(),
  estimatedCost: 0,
};

/**
 * Check which transcripts are already analyzed
 */
async function getAnalyzedTranscripts() {
  const analyzed = await prisma.transcriptAnalysis.findMany({
    select: { vendorCallKey: true }
  });
  return new Set(analyzed.map(t => t.vendorCallKey));
}

/**
 * Save transcript analysis to database
 */
async function saveToDatabase(analysis) {
  try {
    await prisma.transcriptAnalysis.upsert({
      where: { vendorCallKey: analysis.vendorCallKey },
      update: {
        agentName: analysis.agentName,
        agentSentiment: analysis.agentSentiment,
        agentSentimentScore: analysis.agentSentimentScore,
        agentSentimentReason: analysis.agentSentimentReason,
        customerSentiment: analysis.customerSentiment,
        customerSentimentScore: analysis.customerSentimentScore,
        customerSentimentReason: analysis.customerSentimentReason,
        aiDiscoveredTopic: analysis.aiDiscoveredTopic,
        aiDiscoveredSubcategory: analysis.aiDiscoveredSubcategory,
        topicConfidence: analysis.topicConfidence,
        keyIssues: analysis.keyIssues || [],
        resolution: analysis.resolution,
        tags: analysis.tags || [],
        model: CONFIG.MODEL,
      },
      create: {
        vendorCallKey: analysis.vendorCallKey,
        agentName: analysis.agentName,
        agentSentiment: analysis.agentSentiment,
        agentSentimentScore: analysis.agentSentimentScore,
        agentSentimentReason: analysis.agentSentimentReason,
        customerSentiment: analysis.customerSentiment,
        customerSentimentScore: analysis.customerSentimentScore,
        customerSentimentReason: analysis.customerSentimentReason,
        aiDiscoveredTopic: analysis.aiDiscoveredTopic,
        aiDiscoveredSubcategory: analysis.aiDiscoveredSubcategory,
        topicConfidence: analysis.topicConfidence,
        keyIssues: analysis.keyIssues || [],
        resolution: analysis.resolution,
        tags: analysis.tags || [],
        model: CONFIG.MODEL,
      },
    });
    return true;
  } catch (error) {
    console.error(`❌ Database error for transcript ${analysis.vendorCallKey}:`, error.message);
    return false;
  }
}

/**
 * Analyze a single transcript with AI
 */
async function analyzeTranscript(transcript) {
  // Extract the transcript text from messages
  const messages = transcript.messages || [];
  const fullText = messages.map(m => `${m.speaker}: ${m.text}`).join('\n');
  const lastChars = fullText.slice(-CONFIG.LAST_N_CHARS);

  const prompt = `Analyze this customer service call transcript and provide structured insights:

CALL INFORMATION:
Agent: ${transcript.agent_name || 'Unknown'}
Department: ${transcript.department || 'Unknown'}
Disposition: ${transcript.disposition || 'Unknown'}
Duration: ${transcript.duration_seconds || 0} seconds

LAST ${CONFIG.LAST_N_CHARS} CHARACTERS OF CONVERSATION:
${lastChars}

Please analyze and return a JSON object with these fields:

{
  "agentSentiment": "positive|neutral|negative",
  "agentSentimentScore": 0.0-1.0,
  "agentSentimentReason": "brief explanation",

  "customerSentiment": "positive|neutral|negative",
  "customerSentimentScore": 0.0-1.0,
  "customerSentimentReason": "brief explanation",

  "aiDiscoveredTopic": "specific topic discovered from content",
  "aiDiscoveredSubcategory": "more granular subcategory",
  "topicConfidence": 0.0-1.0,

  "keyIssues": ["issue1", "issue2"],
  "resolution": "brief resolution status",
  "tags": ["tag1", "tag2", "tag3"]
}

Focus on:
1. Agent performance: Was the agent helpful, professional, responsive?
2. Customer satisfaction: Is the customer satisfied, frustrated, neutral?
3. True topic: What is this REALLY about? (may be different from disposition)
4. Actionable insights: What are the key issues and resolution?

Return ONLY valid JSON, no other text.`;

  try {
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.API_KEY}`,
        'HTTP-Referer': 'https://servicing-tickets.cmgfinancial.ai',
        'X-Title': 'Transcript Deep Analysis',
      },
      body: JSON.stringify({
        model: CONFIG.MODEL,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    stats.apiCalls++;

    // Track tokens and cost
    const usage = data.usage || {};
    const tokens = usage.total_tokens || 0;
    stats.totalTokens += tokens;

    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;
    const cost = (inputTokens * 3 / 1_000_000) + (outputTokens * 15 / 1_000_000);
    stats.estimatedCost += cost;

    const content = data.choices[0]?.message?.content || '';

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```\n?/g, '');
    }

    const analysis = JSON.parse(jsonStr);

    const result = {
      vendorCallKey: transcript.vendor_call_key,
      agentName: transcript.agent_name,
      ...analysis,
    };

    // 🔥 IMMEDIATELY save to database
    const saved = await saveToDatabase(result);

    if (!saved) {
      throw new Error('Failed to save to database');
    }

    return result;

  } catch (error) {
    throw error;
  }
}

/**
 * Process a batch of transcripts with retry logic
 */
async function processBatch(transcripts, batchNum) {
  console.log(`\n📦 Processing batch ${batchNum} (${transcripts.length} transcripts)...`);

  const results = [];
  const errors = [];

  // Process with limited concurrency
  for (let i = 0; i < transcripts.length; i += CONFIG.MAX_CONCURRENT) {
    const chunk = transcripts.slice(i, i + CONFIG.MAX_CONCURRENT);

    const promises = chunk.map(async (transcript) => {
      for (let attempt = 1; attempt <= CONFIG.RETRY_ATTEMPTS; attempt++) {
        try {
          const result = await analyzeTranscript(transcript);
          stats.processed++;
          process.stdout.write(`\r   Progress: ${stats.processed}/${stats.total} (${((stats.processed / stats.total) * 100).toFixed(1)}%)`);
          return result;
        } catch (error) {
          if (attempt === CONFIG.RETRY_ATTEMPTS) {
            stats.failed++;
            console.error(`\n❌ Error analyzing transcript ${transcript.vendor_call_key}:`, error.message);
            errors.push({ transcript: transcript.vendor_call_key, error: error.message });
            return null;
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt));
        }
      }
    });

    const chunkResults = await Promise.all(promises);
    results.push(...chunkResults.filter(r => r !== null));

    // Small delay between chunks to avoid rate limits
    if (i + CONFIG.MAX_CONCURRENT < transcripts.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\n   ✅ Batch complete: ${results.length} success, ${errors.length} failed`);

  // 🔒 VERIFY DATABASE WRITE: Count actual records in database
  const dbCount = await prisma.transcriptAnalysis.count();
  console.log(`   💾 DATABASE VERIFICATION: ${dbCount.toLocaleString()} total records in TranscriptAnalysis table`);

  return { results, errors };
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Deep AI Analysis Script for Transcripts (DATABASE VERSION)\n');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Validate API key
  if (!CONFIG.API_KEY) {
    console.error('❌ Error: OPENROUTER_API_KEY not found in environment');
    console.error('   Please set it in .env.local file');
    process.exit(1);
  }

  try {
    // Load all transcripts from database
    console.log('📊 Loading transcripts from database...');
    const allTranscripts = await prisma.transcripts.findMany({
      orderBy: { call_start: 'asc' }
    });

    console.log(`   Loaded ${allTranscripts.length.toLocaleString()} transcripts from database\n`);

    // Check which transcripts are already analyzed
    console.log('🔍 Checking for existing analysis...');
    const analyzedKeys = await getAnalyzedTranscripts();
    console.log(`   Found ${analyzedKeys.size.toLocaleString()} transcripts already analyzed\n`);

    // Filter to only unanalyzed transcripts
    const transcriptsToProcess = allTranscripts.filter(t => !analyzedKeys.has(t.vendor_call_key));

    if (transcriptsToProcess.length === 0) {
      console.log('✅ All transcripts have been analyzed! Nothing to do.\n');
      await prisma.$disconnect();
      return;
    }

    // Apply TEST_LIMIT if set
    if (CONFIG.TEST_LIMIT && transcriptsToProcess.length > CONFIG.TEST_LIMIT) {
      console.log(`🧪 TEST MODE: Limiting to first ${CONFIG.TEST_LIMIT} transcripts\n`);
      transcriptsToProcess = transcriptsToProcess.slice(0, CONFIG.TEST_LIMIT);
    }

    stats.total = transcriptsToProcess.length;
    stats.skipped = analyzedKeys.size;

    console.log(`📋 Transcripts to process: ${transcriptsToProcess.length.toLocaleString()}`);
    console.log(`⏭️  Skipped (already done): ${analyzedKeys.size.toLocaleString()}\n`);

    // Estimate cost and time
    const estimatedTokensPerTranscript = 1000;
    const estimatedTotalTokens = transcriptsToProcess.length * estimatedTokensPerTranscript;
    const estimatedCost = (estimatedTotalTokens * 3 / 1_000_000) + (transcriptsToProcess.length * 400 * 15 / 1_000_000);
    const estimatedMinutes = Math.ceil(transcriptsToProcess.length / (CONFIG.MAX_CONCURRENT * 60));

    console.log('💰 Cost Estimate:');
    console.log(`   Transcripts to analyze: ${transcriptsToProcess.length.toLocaleString()}`);
    console.log(`   Estimated tokens: ${estimatedTotalTokens.toLocaleString()}`);
    console.log(`   Estimated cost: $${estimatedCost.toFixed(2)}`);
    console.log(`   Estimated time: ${estimatedMinutes} minutes\n`);

    // Process in batches
    const batches = [];
    for (let i = 0; i < transcriptsToProcess.length; i += CONFIG.BATCH_SIZE) {
      batches.push(transcriptsToProcess.slice(i, i + CONFIG.BATCH_SIZE));
    }

    console.log(`📦 Processing ${batches.length} batches of ${CONFIG.BATCH_SIZE} transcripts each\n`);

    const startTime = Date.now();

    for (let i = 0; i < batches.length; i++) {
      await processBatch(batches[i], i + 1);

      // Show stats
      const elapsed = Date.now() - startTime;
      const rate = stats.processed / (elapsed / 1000 / 60);
      const remaining = transcriptsToProcess.length - stats.processed;
      const eta = Math.ceil(remaining / rate);

      console.log(`\n   📊 Stats: ${stats.apiCalls} API calls, ${stats.totalTokens.toLocaleString()} tokens, $${stats.estimatedCost.toFixed(2)} cost`);
      console.log(`   ⏱️  Rate: ${rate.toFixed(1)} transcripts/min, ETA: ${eta} minutes\n`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════════\n');
    console.log('✅ ANALYSIS COMPLETE!\n');
    console.log(`📊 Analyzed: ${stats.processed.toLocaleString()} transcripts`);
    console.log(`❌ Failed: ${stats.failed.toLocaleString()} transcripts`);
    console.log(`💰 Total cost: $${stats.estimatedCost.toFixed(2)}`);
    console.log(`⏱️  Total time: ${Math.ceil((Date.now() - startTime) / 1000 / 60)} minutes\n`);
    console.log(`💾 All results saved to database: TranscriptAnalysis table\n`);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  prisma.$disconnect();
  process.exit(1);
});
