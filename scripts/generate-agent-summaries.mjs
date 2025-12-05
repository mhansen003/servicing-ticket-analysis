/**
 * Generate AI Summaries for Agent Recent Calls
 *
 * This script analyzes a subset of calls per agent to generate AI summaries
 * for display in agent profile cards. It's more efficient than analyzing
 * all 27k transcripts.
 *
 * Usage: node scripts/generate-agent-summaries.mjs [--calls-per-agent N]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  transcriptsFile: path.join(__dirname, '..', 'public', 'data', 'transcript-analysis.json'),
  conversationsIndexFile: path.join(__dirname, '..', 'public', 'data', 'transcript-conversations-index.json'),
  agentRankingsFile: path.join(__dirname, '..', 'public', 'data', 'agent-rankings.json'),
  outputFile: path.join(__dirname, '..', 'public', 'data', 'agent-rankings.json'),
  callsPerAgent: 10, // How many recent calls per agent to analyze
  apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
  model: 'anthropic/claude-3-haiku', // Fast and cheap for summaries
};

/**
 * Load conversation for a specific transcript ID
 */
async function loadConversation(transcriptId) {
  try {
    const indexData = JSON.parse(fs.readFileSync(CONFIG.conversationsIndexFile, 'utf-8'));

    // Search through chunks
    for (let i = 0; i < indexData.numChunks; i++) {
      const chunkPath = path.join(__dirname, '..', 'public', 'data', `transcript-conversations-${i}.json`);
      const chunkData = JSON.parse(fs.readFileSync(chunkPath, 'utf-8'));

      if (chunkData[transcriptId]) {
        return chunkData[transcriptId];
      }
    }

    return null;
  } catch (error) {
    console.error(`Error loading conversation ${transcriptId}:`, error.message);
    return null;
  }
}

/**
 * Generate AI summary for a call
 */
async function generateSummary(conversation, apiKey) {
  if (!apiKey || !conversation || conversation.length === 0) {
    return null;
  }

  // Build conversation text
  const conversationText = conversation
    .map(msg => `${msg.role.toUpperCase()}: ${msg.text}`)
    .join('\n');

  const prompt = `Analyze this customer service call and provide a brief JSON response:

TRANSCRIPT:
${conversationText.substring(0, 2500)}

Return ONLY valid JSON with these fields:
{
  "summary": "<One sentence (15-25 words) describing what happened in this call>",
  "sentiment": "positive|negative|neutral",
  "keyIssue": "<5-8 word description of main issue>",
  "resolution": "resolved|partially_resolved|unresolved|callback_needed"
}

Focus the summary on what the customer needed and the outcome.`;

  try {
    const response = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://servicing-ticket-analysis.vercel.app',
        'X-Title': 'Agent Summary Generator',
      },
      body: JSON.stringify({
        model: CONFIG.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      console.error(`API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (content) {
      // Parse JSON response
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
      if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);

      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }

    return null;
  } catch (error) {
    console.error(`AI error: ${error.message}`);
    return null;
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const callsPerAgent = args.includes('--calls-per-agent')
    ? parseInt(args[args.indexOf('--calls-per-agent') + 1])
    : CONFIG.callsPerAgent;

  console.log('🤖 Agent Summary Generator');
  console.log('===========================\n');

  // Check API key
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY not found in environment');
    console.error('   Please set it in .env.local');
    process.exit(1);
  }

  // Load existing data
  console.log('📂 Loading transcripts and agent rankings...');
  const transcripts = JSON.parse(fs.readFileSync(CONFIG.transcriptsFile, 'utf-8'));
  const agentRankings = JSON.parse(fs.readFileSync(CONFIG.agentRankingsFile, 'utf-8'));

  console.log(`   Found ${transcripts.length} transcripts`);
  console.log(`   Found ${agentRankings.allAgents.length} agents`);
  console.log(`   Will analyze ${callsPerAgent} calls per agent\n`);

  // Create a map of transcripts by ID for quick lookup
  const transcriptMap = new Map(transcripts.map(t => [t.id, t]));

  // Process each agent
  let totalCalls = 0;
  let processedCalls = 0;
  let failedCalls = 0;

  for (const agent of agentRankings.allAgents) {
    console.log(`\n👤 Processing ${agent.name}...`);

    // Get transcripts for this agent, sorted by date (newest first)
    const agentTranscripts = transcripts
      .filter(t => t.agentName === agent.name)
      .sort((a, b) => new Date(b.callStart) - new Date(a.callStart))
      .slice(0, callsPerAgent);

    if (agentTranscripts.length === 0) {
      console.log('   No transcripts found');
      continue;
    }

    totalCalls += agentTranscripts.length;

    // Update recentCalls with AI summaries
    const updatedRecentCalls = [];

    for (const transcript of agentTranscripts) {
      // Load the conversation
      const conversation = await loadConversation(transcript.id);

      if (!conversation || conversation.length === 0) {
        // Keep existing data without summary
        updatedRecentCalls.push({
          id: transcript.id,
          date: transcript.callStart,
          duration: transcript.durationSeconds,
          sentiment: transcript.basicSentiment,
          summary: transcript.aiAnalysis?.summary || '',
        });
        continue;
      }

      // Generate AI summary
      const aiResult = await generateSummary(conversation, apiKey);

      if (aiResult) {
        updatedRecentCalls.push({
          id: transcript.id,
          date: transcript.callStart,
          duration: transcript.durationSeconds,
          sentiment: aiResult.sentiment || transcript.basicSentiment,
          summary: aiResult.summary || '',
          keyIssue: aiResult.keyIssue || '',
          resolution: aiResult.resolution || '',
        });
        processedCalls++;
        console.log(`   ✓ ${aiResult.summary?.substring(0, 60)}...`);
      } else {
        updatedRecentCalls.push({
          id: transcript.id,
          date: transcript.callStart,
          duration: transcript.durationSeconds,
          sentiment: transcript.basicSentiment,
          summary: '',
        });
        failedCalls++;
      }

      // Rate limit - 100ms between calls
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Update agent's recentCalls
    agent.recentCalls = updatedRecentCalls;
  }

  // Also update the topPerformers and needsImprovement lists
  const agentMap = new Map(agentRankings.allAgents.map(a => [a.name, a]));

  agentRankings.topPerformers = agentRankings.topPerformers.map(agent => {
    const updated = agentMap.get(agent.name);
    return updated ? { ...agent, recentCalls: updated.recentCalls } : agent;
  });

  agentRankings.needsImprovement = agentRankings.needsImprovement.map(agent => {
    const updated = agentMap.get(agent.name);
    return updated ? { ...agent, recentCalls: updated.recentCalls } : agent;
  });

  agentRankings.highestVolume = agentRankings.highestVolume.map(agent => {
    const updated = agentMap.get(agent.name);
    return updated ? { ...agent, recentCalls: updated.recentCalls } : agent;
  });

  // Save updated rankings
  console.log('\n💾 Saving updated agent rankings...');
  fs.writeFileSync(CONFIG.outputFile, JSON.stringify(agentRankings, null, 2));

  // Summary
  console.log('\n📊 Summary:');
  console.log('============');
  console.log(`Total calls to analyze: ${totalCalls}`);
  console.log(`Successfully processed: ${processedCalls}`);
  console.log(`Failed: ${failedCalls}`);
  console.log(`\n✨ Done! Agent rankings updated with AI summaries.\n`);
}

main().catch(console.error);
