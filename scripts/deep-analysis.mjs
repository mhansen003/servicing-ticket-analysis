#!/usr/bin/env node

/**
 * Deep AI Analysis Script for 23k+ Tickets
 *
 * Features:
 * - Dual sentiment analysis (Agent vs Customer) from last 1000 chars
 * - AI-discovered topics/subcategories from disposition + description
 * - Batch processing with progress tracking
 * - Cost optimization with OpenRouter API
 * - Resume capability for interrupted runs
 * - Performance metrics tracking
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  // API Configuration
  API_URL: 'https://openrouter.ai/api/v1/chat/completions',
  API_KEY: process.env.OPENROUTER_API_KEY,
  MODEL: 'anthropic/claude-3.5-sonnet', // Fast and accurate

  // Batch Processing
  BATCH_SIZE: 50, // Process 50 tickets at a time
  MAX_CONCURRENT: 5, // 5 parallel API calls
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000, // 2 seconds

  // Analysis Parameters
  LAST_N_CHARS: 1000, // Analyze last 1000 chars for sentiment

  // File Paths
  INPUT_CSV: path.join(__dirname, '..', 'data', 'tickets.csv'),
  OUTPUT_JSON: path.join(__dirname, '..', 'public', 'data', 'deep-analysis.json'),
  PROGRESS_FILE: path.join(__dirname, '..', 'data', 'analysis-progress.json'),
  CHECKPOINT_FILE: path.join(__dirname, '..', 'data', 'analysis-checkpoint.json'),
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
 * Load progress from previous run
 */
function loadProgress() {
  if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG.PROGRESS_FILE, 'utf-8'));
      console.log('📂 Resuming from previous run...');
      console.log(`   Already processed: ${data.processed} tickets`);
      return data;
    } catch (e) {
      console.warn('⚠️  Could not load progress file, starting fresh');
    }
  }
  return { processed: 0, results: [] };
}

/**
 * Save progress checkpoint
 */
function saveProgress(data) {
  fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(data, null, 2));
}

/**
 * Analyze a single ticket with AI
 */
async function analyzeTicket(ticket) {
  const { ticket_title, ticket_description, ticket_status, assigned_user_name, custom_fields } = ticket;

  // Extract last 1000 chars for sentiment analysis
  const fullText = `${ticket_title || ''}\n\n${ticket_description || ''}`;
  const lastChars = fullText.slice(-CONFIG.LAST_N_CHARS);

  // Parse custom fields for disposition
  let disposition = 'Unknown';
  try {
    if (custom_fields) {
      const fields = JSON.parse(custom_fields);
      disposition = fields.Category || fields.Disposition || 'Unknown';
    }
  } catch (e) {
    // Ignore parse errors
  }

  const prompt = `Analyze this customer service ticket and provide structured insights:

TICKET INFORMATION:
Title: ${ticket_title || 'N/A'}
Status: ${ticket_status || 'N/A'}
Agent: ${assigned_user_name || 'Unassigned'}
Disposition: ${disposition}

LAST 1000 CHARACTERS OF CONVERSATION:
${lastChars}

FULL DESCRIPTION (for context):
${(ticket_description || '').substring(0, 500)}...

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
        'X-Title': 'Servicing Ticket Deep Analysis',
      },
      body: JSON.stringify({
        model: CONFIG.MODEL,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent results
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

    // Rough cost estimate (Claude 3.5 Sonnet: ~$3/1M input, ~$15/1M output)
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

    return {
      ticketKey: ticket.ticket_key,
      ticketTitle: ticket_title,
      assignedAgent: assigned_user_name,
      originalDisposition: disposition,
      ...analysis,
      analyzedAt: new Date().toISOString(),
    };

  } catch (error) {
    console.error(`❌ Error analyzing ticket ${ticket.ticket_key}:`, error.message);
    throw error;
  }
}

/**
 * Process a batch of tickets with retry logic
 */
async function processBatch(tickets, batchNum) {
  console.log(`\n📦 Processing batch ${batchNum} (${tickets.length} tickets)...`);

  const results = [];
  const errors = [];

  // Process with limited concurrency
  for (let i = 0; i < tickets.length; i += CONFIG.MAX_CONCURRENT) {
    const chunk = tickets.slice(i, i + CONFIG.MAX_CONCURRENT);

    const promises = chunk.map(async (ticket) => {
      for (let attempt = 1; attempt <= CONFIG.RETRY_ATTEMPTS; attempt++) {
        try {
          const result = await analyzeTicket(ticket);
          stats.processed++;
          process.stdout.write(`\r   Progress: ${stats.processed}/${stats.total} (${((stats.processed / stats.total) * 100).toFixed(1)}%)`);
          return result;
        } catch (error) {
          if (attempt === CONFIG.RETRY_ATTEMPTS) {
            stats.failed++;
            errors.push({ ticket: ticket.ticket_key, error: error.message });
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
    if (i + CONFIG.MAX_CONCURRENT < tickets.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\n   ✅ Batch complete: ${results.length} success, ${errors.length} failed`);

  return { results, errors };
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Deep AI Analysis Script for Servicing Tickets\n');
  console.log('═══════════════════════════════════════════════\n');

  // Validate API key
  if (!CONFIG.API_KEY) {
    console.error('❌ Error: OPENROUTER_API_KEY not found in environment');
    console.error('   Please set it in .env.local file');
    process.exit(1);
  }

  // Load CSV data
  console.log('📊 Loading ticket data...');
  const csvContent = fs.readFileSync(CONFIG.INPUT_CSV, 'utf-8');
  const parsed = Papa.parse(csvContent, { header: true });
  const tickets = parsed.data.filter(t => t.ticket_key); // Filter out empty rows

  stats.total = tickets.length;
  console.log(`   Loaded ${stats.total.toLocaleString()} tickets\n`);

  // Load previous progress
  const progress = loadProgress();
  const startIndex = progress.processed;
  const allResults = progress.results || [];

  if (startIndex > 0) {
    console.log(`   Skipping first ${startIndex} tickets (already processed)\n`);
  }

  // Estimate cost and time
  const remainingTickets = tickets.slice(startIndex);
  const estimatedTokensPerTicket = 800; // Rough estimate
  const estimatedTotalTokens = remainingTickets.length * estimatedTokensPerTicket;
  const estimatedCost = (estimatedTotalTokens * 3 / 1_000_000) + (remainingTickets.length * 400 * 15 / 1_000_000);
  const estimatedMinutes = Math.ceil(remainingTickets.length / (CONFIG.MAX_CONCURRENT * 60));

  console.log('💰 Cost Estimate:');
  console.log(`   Remaining tickets: ${remainingTickets.length.toLocaleString()}`);
  console.log(`   Estimated tokens: ${estimatedTotalTokens.toLocaleString()}`);
  console.log(`   Estimated cost: $${estimatedCost.toFixed(2)}`);
  console.log(`   Estimated time: ${estimatedMinutes} minutes\n`);

  // Process in batches
  const batches = [];
  for (let i = 0; i < remainingTickets.length; i += CONFIG.BATCH_SIZE) {
    batches.push(remainingTickets.slice(i, i + CONFIG.BATCH_SIZE));
  }

  console.log(`📦 Processing ${batches.length} batches of ${CONFIG.BATCH_SIZE} tickets each\n`);

  const startTime = Date.now();

  for (let i = 0; i < batches.length; i++) {
    const batchResults = await processBatch(batches[i], i + 1);
    allResults.push(...batchResults.results);

    // Save checkpoint every batch
    saveProgress({
      processed: startIndex + (i + 1) * CONFIG.BATCH_SIZE,
      results: allResults,
      lastUpdated: new Date().toISOString(),
    });

    // Show stats
    const elapsed = Date.now() - startTime;
    const rate = stats.processed / (elapsed / 1000 / 60); // tickets per minute
    const remaining = remainingTickets.length - stats.processed;
    const eta = Math.ceil(remaining / rate);

    console.log(`\n   📊 Stats: ${stats.apiCalls} API calls, ${stats.totalTokens.toLocaleString()} tokens, $${stats.estimatedCost.toFixed(2)} cost`);
    console.log(`   ⏱️  Rate: ${rate.toFixed(1)} tickets/min, ETA: ${eta} minutes\n`);
  }

  // Generate final output
  console.log('\n✨ Analysis complete! Generating final output...\n');

  const output = {
    metadata: {
      totalTickets: stats.total,
      analyzedTickets: allResults.length,
      failedTickets: stats.failed,
      apiCalls: stats.apiCalls,
      totalTokens: stats.totalTokens,
      totalCost: stats.estimatedCost,
      analysisDate: new Date().toISOString(),
      model: CONFIG.MODEL,
      processingTime: Date.now() - startTime,
    },

    // Summary statistics
    summary: {
      agentSentiment: {
        positive: allResults.filter(r => r.agentSentiment === 'positive').length,
        neutral: allResults.filter(r => r.agentSentiment === 'neutral').length,
        negative: allResults.filter(r => r.agentSentiment === 'negative').length,
      },
      customerSentiment: {
        positive: allResults.filter(r => r.customerSentiment === 'positive').length,
        neutral: allResults.filter(r => r.customerSentiment === 'neutral').length,
        negative: allResults.filter(r => r.customerSentiment === 'negative').length,
      },
      avgAgentScore: allResults.reduce((sum, r) => sum + (r.agentSentimentScore || 0), 0) / allResults.length,
      avgCustomerScore: allResults.reduce((sum, r) => sum + (r.customerSentimentScore || 0), 0) / allResults.length,
    },

    // Discovered topics
    topics: extractTopics(allResults),

    // Full results
    tickets: allResults,
  };

  fs.writeFileSync(CONFIG.OUTPUT_JSON, JSON.stringify(output, null, 2));

  console.log('═══════════════════════════════════════════════\n');
  console.log('✅ ANALYSIS COMPLETE!\n');
  console.log(`📁 Output saved to: ${CONFIG.OUTPUT_JSON}`);
  console.log(`📊 Analyzed: ${allResults.length.toLocaleString()} tickets`);
  console.log(`💰 Total cost: $${stats.estimatedCost.toFixed(2)}`);
  console.log(`⏱️  Total time: ${Math.ceil((Date.now() - startTime) / 1000 / 60)} minutes\n`);

  // Clean up progress file
  if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
    fs.unlinkSync(CONFIG.PROGRESS_FILE);
  }
}

/**
 * Extract and aggregate discovered topics
 */
function extractTopics(results) {
  const topicMap = {};
  const subcategoryMap = {};

  results.forEach(result => {
    // Main topics
    const topic = result.aiDiscoveredTopic;
    if (topic) {
      if (!topicMap[topic]) {
        topicMap[topic] = { count: 0, avgConfidence: 0, tickets: [] };
      }
      topicMap[topic].count++;
      topicMap[topic].avgConfidence += result.topicConfidence || 0;
      topicMap[topic].tickets.push(result.ticketKey);
    }

    // Subcategories
    const subcat = result.aiDiscoveredSubcategory;
    if (subcat) {
      if (!subcategoryMap[subcat]) {
        subcategoryMap[subcat] = { count: 0, parentTopic: topic, tickets: [] };
      }
      subcategoryMap[subcat].count++;
      subcategoryMap[subcat].tickets.push(result.ticketKey);
    }
  });

  // Calculate averages
  Object.keys(topicMap).forEach(topic => {
    topicMap[topic].avgConfidence /= topicMap[topic].count;
  });

  // Sort by count
  const sortedTopics = Object.entries(topicMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count);

  const sortedSubcategories = Object.entries(subcategoryMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count);

  return {
    mainTopics: sortedTopics,
    subcategories: sortedSubcategories,
    totalTopics: sortedTopics.length,
    totalSubcategories: sortedSubcategories.length,
  };
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
