#!/usr/bin/env node

/**
 * Export Database Analysis to JSON
 *
 * Reads all ticket analysis from PostgreSQL database
 * and generates the JSON file needed by the UI
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

const OUTPUT_JSON = path.join(__dirname, '..', 'public', 'data', 'deep-analysis.json');

async function main() {
  console.log('📤 Exporting ticket analysis from database...\n');

  try {
    // Fetch all analysis results from database
    const results = await prisma.ticketAnalysis.findMany({
      orderBy: { analyzedAt: 'asc' }
    });

    console.log(`   Found ${results.length.toLocaleString()} analyzed tickets\n`);

    if (results.length === 0) {
      console.log('⚠️  No analysis results found in database. Run deep-analysis-db.mjs first.\n');
      await prisma.$disconnect();
      return;
    }

    // Calculate summary statistics
    const agentSentiment = {
      positive: results.filter(r => r.agentSentiment === 'positive').length,
      neutral: results.filter(r => r.agentSentiment === 'neutral').length,
      negative: results.filter(r => r.agentSentiment === 'negative').length,
    };

    const customerSentiment = {
      positive: results.filter(r => r.customerSentiment === 'positive').length,
      neutral: results.filter(r => r.customerSentiment === 'neutral').length,
      negative: results.filter(r => r.customerSentiment === 'negative').length,
    };

    const avgAgentScore = results.reduce((sum, r) => sum + (r.agentSentimentScore || 0), 0) / results.length;
    const avgCustomerScore = results.reduce((sum, r) => sum + (r.customerSentimentScore || 0), 0) / results.length;

    // Extract topics
    const topics = extractTopics(results);

    // Build output structure
    const output = {
      metadata: {
        totalTickets: results.length,
        analyzedTickets: results.length,
        exportDate: new Date().toISOString(),
        source: 'PostgreSQL Database (TicketAnalysis table)',
      },

      summary: {
        agentSentiment,
        customerSentiment,
        avgAgentScore,
        avgCustomerScore,
      },

      topics,

      tickets: results.map(r => ({
        ticketKey: r.ticketKey,
        ticketTitle: r.ticketTitle,
        assignedAgent: r.assignedAgent,
        originalDisposition: r.originalDisposition,
        agentSentiment: r.agentSentiment,
        agentSentimentScore: r.agentSentimentScore,
        agentSentimentReason: r.agentSentimentReason,
        customerSentiment: r.customerSentiment,
        customerSentimentScore: r.customerSentimentScore,
        customerSentimentReason: r.customerSentimentReason,
        aiDiscoveredTopic: r.aiDiscoveredTopic,
        aiDiscoveredSubcategory: r.aiDiscoveredSubcategory,
        topicConfidence: r.topicConfidence,
        keyIssues: r.keyIssues,
        resolution: r.resolution,
        tags: r.tags,
        analyzedAt: r.analyzedAt.toISOString(),
      })),
    };

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_JSON);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write to file
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(output, null, 2));

    console.log('✅ Export complete!\n');
    console.log(`📁 Output saved to: ${OUTPUT_JSON}`);
    console.log(`📊 Exported: ${results.length.toLocaleString()} tickets`);
    console.log(`\n💡 Summary:`);
    console.log(`   Agent Sentiment: ${agentSentiment.positive} positive, ${agentSentiment.neutral} neutral, ${agentSentiment.negative} negative`);
    console.log(`   Customer Sentiment: ${customerSentiment.positive} positive, ${customerSentiment.neutral} neutral, ${customerSentiment.negative} negative`);
    console.log(`   Discovered Topics: ${topics.totalTopics}`);
    console.log(`   Discovered Subcategories: ${topics.totalSubcategories}\n`);

  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
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

main().catch(error => {
  console.error('Fatal error:', error);
  prisma.$disconnect();
  process.exit(1);
});
