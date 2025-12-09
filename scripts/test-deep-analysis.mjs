#!/usr/bin/env node

/**
 * Test Deep Analysis Script - Run on 10 tickets first
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

const TEST_SIZE = 10; // Test with 10 tickets

async function testAnalysis() {
  console.log(`🧪 Testing Deep Analysis on ${TEST_SIZE} sample tickets\n`);

  // Load sample data
  const csvPath = path.join(__dirname, '..', 'data', 'tickets.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const parsed = Papa.parse(csvContent, { header: true });
  const allTickets = parsed.data.filter(t => t.ticket_key);

  // Get diverse sample (skip first few, they might be similar)
  const sampleTickets = [];
  const step = Math.floor(allTickets.length / TEST_SIZE);
  for (let i = 0; i < TEST_SIZE; i++) {
    sampleTickets.push(allTickets[i * step]);
  }

  console.log('Sample tickets selected:');
  sampleTickets.forEach((t, i) => {
    console.log(`${i + 1}. ${t.ticket_key}: ${t.ticket_title?.substring(0, 50)}...`);
  });

  console.log('\n📊 Analyzing...\n');

  const API_KEY = process.env.OPENROUTER_API_KEY;
  if (!API_KEY) {
    console.error('❌ OPENROUTER_API_KEY not set in environment');
    console.error('   Set it in .env.local and run: node scripts/test-deep-analysis.mjs');
    process.exit(1);
  }

  const results = [];

  for (let i = 0; i < sampleTickets.length; i++) {
    const ticket = sampleTickets[i];
    console.log(`\n[${i + 1}/${TEST_SIZE}] Analyzing ${ticket.ticket_key}...`);

    const fullText = `${ticket.ticket_title || ''}\n\n${ticket.ticket_description || ''}`;
    const lastChars = fullText.slice(-1000);

    let disposition = 'Unknown';
    try {
      if (ticket.custom_fields) {
        const fields = JSON.parse(ticket.custom_fields);
        disposition = fields.Category || 'Unknown';
      }
    } catch (e) {}

    const prompt = `Analyze this customer service ticket and provide structured insights:

TICKET INFORMATION:
Title: ${ticket.ticket_title || 'N/A'}
Status: ${ticket.ticket_status || 'N/A'}
Agent: ${ticket.assigned_user_name || 'Unassigned'}
Disposition: ${disposition}

LAST 1000 CHARACTERS:
${lastChars}

Return a JSON object with these fields:
{
  "agentSentiment": "positive|neutral|negative",
  "agentSentimentScore": 0.0-1.0,
  "agentSentimentReason": "brief explanation",
  "customerSentiment": "positive|neutral|negative",
  "customerSentimentScore": 0.0-1.0,
  "customerSentimentReason": "brief explanation",
  "aiDiscoveredTopic": "specific topic",
  "aiDiscoveredSubcategory": "granular subcategory",
  "topicConfidence": 0.0-1.0,
  "keyIssues": ["issue1", "issue2"],
  "resolution": "brief status",
  "tags": ["tag1", "tag2"]
}

Return ONLY valid JSON.`;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
          'HTTP-Referer': 'https://servicing-tickets.cmgfinancial.ai',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '';

      // Parse JSON
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '');
      }

      const analysis = JSON.parse(jsonStr);

      console.log(`   ✅ Agent: ${analysis.agentSentiment} (${(analysis.agentSentimentScore * 100).toFixed(0)}%)`);
      console.log(`   ✅ Customer: ${analysis.customerSentiment} (${(analysis.customerSentimentScore * 100).toFixed(0)}%)`);
      console.log(`   ✅ Topic: ${analysis.aiDiscoveredTopic}`);
      console.log(`   ✅ Subcategory: ${analysis.aiDiscoveredSubcategory}`);

      results.push({
        ticketKey: ticket.ticket_key,
        ...analysis,
      });

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Save test results
  const outputPath = path.join(__dirname, '..', 'data', 'test-analysis-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  console.log(`\n\n✅ Test complete! Results saved to: ${outputPath}`);
  console.log(`\n📊 Summary:`);
  console.log(`   Total analyzed: ${results.length}`);
  console.log(`   Agent sentiment: ${results.filter(r => r.agentSentiment === 'positive').length} positive, ${results.filter(r => r.agentSentiment === 'negative').length} negative`);
  console.log(`   Customer sentiment: ${results.filter(r => r.customerSentiment === 'positive').length} positive, ${results.filter(r => r.customerSentiment === 'negative').length} negative`);

  // Show discovered topics
  const topics = {};
  results.forEach(r => {
    topics[r.aiDiscoveredTopic] = (topics[r.aiDiscoveredTopic] || 0) + 1;
  });

  console.log(`\n🏷️  Discovered Topics:`);
  Object.entries(topics)
    .sort((a, b) => b[1] - a[1])
    .forEach(([topic, count]) => {
      console.log(`   - ${topic} (${count})`);
    });
}

testAnalysis().catch(console.error);
