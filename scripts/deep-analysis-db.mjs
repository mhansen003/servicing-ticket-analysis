#!/usr/bin/env node

/**
 * Deep AI Analysis Script for 23k+ Tickets - DATABASE VERSION
 *
 * Features:
 * - Writes directly to PostgreSQL database (NO file-based checkpoints!)
 * - Dual sentiment analysis (Agent vs Customer)
 * - AI-discovered topics/subcategories
 * - Automatic resume capability (checks database for existing tickets)
 * - Zero data loss - every ticket saved immediately
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Prisma client
const prisma = new PrismaClient();

// Configuration
const CONFIG = {
  // API Configuration
  API_URL: 'https://openrouter.ai/api/v1/chat/completions',
  API_KEY: process.env.OPENROUTER_API_KEY,
  MODEL: 'anthropic/claude-3.5-sonnet',

  // Batch Processing
  BATCH_SIZE: 50,
  MAX_CONCURRENT: 5,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000,

  // Analysis Parameters
  LAST_N_CHARS: 1000,

  // File Paths
  INPUT_CSV: path.join(__dirname, '..', 'data', 'tickets.csv'),
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
 * Check which tickets are already analyzed in the database
 */
async function getAnalyzedTickets() {
  const analyzed = await prisma.ticketAnalysis.findMany({
    select: { ticketKey: true }
  });
  return new Set(analyzed.map(t => t.ticketKey));
}

/**
 * Save ticket analysis to database
 */
async function saveToDatabase(analysis) {
  try {
    await prisma.ticketAnalysis.upsert({
      where: { ticketKey: analysis.ticketKey },
      update: {
        ticketTitle: analysis.ticketTitle,
        assignedAgent: analysis.assignedAgent,
        originalDisposition: analysis.originalDisposition,
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
        ticketKey: analysis.ticketKey,
        ticketTitle: analysis.ticketTitle,
        assignedAgent: analysis.assignedAgent,
        originalDisposition: analysis.originalDisposition,
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
    console.error(`❌ Database error for ticket ${analysis.ticketKey}:`, error.message);
    return false;
  }
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
      ticketKey: ticket.ticket_key,
      ticketTitle: ticket_title,
      assignedAgent: assigned_user_name,
      originalDisposition: disposition,
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
            console.error(`\n❌ Error analyzing ticket ${ticket.ticket_key}:`, error.message);
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
  console.log('🚀 Deep AI Analysis Script for Servicing Tickets (DATABASE VERSION)\n');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Validate API key
  if (!CONFIG.API_KEY) {
    console.error('❌ Error: OPENROUTER_API_KEY not found in environment');
    console.error('   Please set it in .env.local file');
    process.exit(1);
  }

  try {
    // Load CSV data
    console.log('📊 Loading ticket data...');
    const csvContent = fs.readFileSync(CONFIG.INPUT_CSV, 'utf-8');
    const parsed = Papa.parse(csvContent, { header: true });
    const allTickets = parsed.data.filter(t => t.ticket_key);

    console.log(`   Loaded ${allTickets.length.toLocaleString()} tickets from CSV\n`);

    // Check which tickets are already analyzed
    console.log('🔍 Checking database for existing analysis...');
    const analyzedKeys = await getAnalyzedTickets();
    console.log(`   Found ${analyzedKeys.size.toLocaleString()} tickets already analyzed\n`);

    // Filter to only unanalyzed tickets
    const ticketsToProcess = allTickets.filter(t => !analyzedKeys.has(t.ticket_key));

    if (ticketsToProcess.length === 0) {
      console.log('✅ All tickets have been analyzed! Nothing to do.\n');
      await prisma.$disconnect();
      return;
    }

    stats.total = ticketsToProcess.length;
    stats.skipped = analyzedKeys.size;

    console.log(`📋 Tickets to process: ${ticketsToProcess.length.toLocaleString()}`);
    console.log(`⏭️  Skipped (already done): ${analyzedKeys.size.toLocaleString()}\n`);

    // Estimate cost and time
    const estimatedTokensPerTicket = 800;
    const estimatedTotalTokens = ticketsToProcess.length * estimatedTokensPerTicket;
    const estimatedCost = (estimatedTotalTokens * 3 / 1_000_000) + (ticketsToProcess.length * 400 * 15 / 1_000_000);
    const estimatedMinutes = Math.ceil(ticketsToProcess.length / (CONFIG.MAX_CONCURRENT * 60));

    console.log('💰 Cost Estimate:');
    console.log(`   Tickets to analyze: ${ticketsToProcess.length.toLocaleString()}`);
    console.log(`   Estimated tokens: ${estimatedTotalTokens.toLocaleString()}`);
    console.log(`   Estimated cost: $${estimatedCost.toFixed(2)}`);
    console.log(`   Estimated time: ${estimatedMinutes} minutes\n`);

    // Process in batches
    const batches = [];
    for (let i = 0; i < ticketsToProcess.length; i += CONFIG.BATCH_SIZE) {
      batches.push(ticketsToProcess.slice(i, i + CONFIG.BATCH_SIZE));
    }

    console.log(`📦 Processing ${batches.length} batches of ${CONFIG.BATCH_SIZE} tickets each\n`);

    const startTime = Date.now();

    for (let i = 0; i < batches.length; i++) {
      await processBatch(batches[i], i + 1);

      // Show stats
      const elapsed = Date.now() - startTime;
      const rate = stats.processed / (elapsed / 1000 / 60);
      const remaining = ticketsToProcess.length - stats.processed;
      const eta = Math.ceil(remaining / rate);

      console.log(`\n   📊 Stats: ${stats.apiCalls} API calls, ${stats.totalTokens.toLocaleString()} tokens, $${stats.estimatedCost.toFixed(2)} cost`);
      console.log(`   ⏱️  Rate: ${rate.toFixed(1)} tickets/min, ETA: ${eta} minutes\n`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════════\n');
    console.log('✅ ANALYSIS COMPLETE!\n');
    console.log(`📊 Analyzed: ${stats.processed.toLocaleString()} tickets`);
    console.log(`❌ Failed: ${stats.failed.toLocaleString()} tickets`);
    console.log(`💰 Total cost: $${stats.estimatedCost.toFixed(2)}`);
    console.log(`⏱️  Total time: ${Math.ceil((Date.now() - startTime) / 1000 / 60)} minutes\n`);
    console.log(`💾 All results saved to database: TicketAnalysis table\n`);

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
