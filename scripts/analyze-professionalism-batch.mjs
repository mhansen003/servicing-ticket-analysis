/**
 * Parallelized Agent Professionalism Analysis
 *
 * Analyzes 100 calls per agent using parallel batch processing.
 * Run multiple instances with different agent ranges for speed.
 *
 * Usage:
 *   node scripts/analyze-professionalism-batch.mjs --batch 1 --total-batches 4
 *   node scripts/analyze-professionalism-batch.mjs --batch 2 --total-batches 4
 *   etc.
 *
 * Or run all at once:
 *   node scripts/analyze-professionalism-batch.mjs --all
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  transcriptsFile: path.join(__dirname, '..', 'public', 'data', 'transcript-analysis.json'),
  conversationsDir: path.join(__dirname, '..', 'public', 'data'),
  outputDir: path.join(__dirname, '..', 'public', 'data', 'professionalism-batches'),
  apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
  model: 'anthropic/claude-3-haiku',
  callsPerAgent: 100,
  concurrentRequests: 5, // Run 5 API calls at once
  batchDelay: 50, // ms between batches
};

// Ensure output directory exists
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

// Load all conversations into memory
function loadConversations() {
  console.log('📂 Loading conversations...');
  const indexPath = path.join(CONFIG.conversationsDir, 'transcript-conversations-index.json');
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

  const conversations = new Map();
  for (let i = 0; i < index.numChunks; i++) {
    const chunkPath = path.join(CONFIG.conversationsDir, `transcript-conversations-${i}.json`);
    const chunk = JSON.parse(fs.readFileSync(chunkPath, 'utf-8'));
    Object.entries(chunk).forEach(([id, convo]) => {
      conversations.set(id, convo);
    });
  }
  console.log(`   Loaded ${conversations.size} conversations`);
  return conversations;
}

/**
 * Analyze a single call for agent professionalism
 */
async function analyzeCall(conversation, apiKey, retries = 2) {
  if (!conversation || conversation.length < 4) {
    return null;
  }

  const conversationText = conversation
    .map(msg => `${msg.role.toUpperCase()}: ${msg.text}`)
    .join('\n');

  const prompt = `Evaluate the AGENT's professionalism in this mortgage service call.

IMPORTANT: Judge the AGENT's behavior, NOT the call outcome. Customers may arrive frustrated - that's not the agent's fault. We're measuring:
- Did the agent behave professionally?
- Did the agent CAUSE or WORSEN frustration?
- Did the agent handle difficulties well?

TRANSCRIPT:
${conversationText.substring(0, 3500)}

Return ONLY valid JSON:
{
  "professionalism": <1-5>,
  "causedFrustration": <true/false>,
  "deEscalation": <1-5 or null if customer wasn't upset>,
  "clarity": <1-5>,
  "empathy": <1-5>,
  "listening": <1-5>,
  "issues": ["<problems if any>"],
  "strengths": ["<positives>"]
}

Scoring: 5=exemplary, 4=professional, 3=adequate, 2=below-standard, 1=unprofessional`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(CONFIG.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://servicing-ticket-analysis.vercel.app',
          'X-Title': 'Agent Professionalism Analysis',
        },
        body: JSON.stringify({
          model: CONFIG.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 400,
        }),
      });

      if (!response.ok) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        return null;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (content) {
        let jsonStr = content.trim();
        if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '');
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
      return null;
    } catch (error) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

/**
 * Process calls in parallel batches
 */
async function processCallsBatch(calls, conversations, apiKey) {
  const results = [];

  for (let i = 0; i < calls.length; i += CONFIG.concurrentRequests) {
    const batch = calls.slice(i, i + CONFIG.concurrentRequests);

    const promises = batch.map(async (call) => {
      const conversation = conversations.get(call.id);
      const result = await analyzeCall(conversation, apiKey);
      return result ? { callId: call.id, sentiment: call.basicSentiment, ...result } : null;
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter(r => r));

    // Small delay between batches
    if (i + CONFIG.concurrentRequests < calls.length) {
      await new Promise(r => setTimeout(r, CONFIG.batchDelay));
    }
  }

  return results;
}

/**
 * Calculate agent scores from analyses
 */
function calculateAgentScores(analyses, totalCalls) {
  if (analyses.length === 0) return null;

  const avg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const profScores = analyses.map(a => a.professionalism).filter(s => s);
  const clarityScores = analyses.map(a => a.clarity).filter(s => s);
  const empathyScores = analyses.map(a => a.empathy).filter(s => s);
  const listeningScores = analyses.map(a => a.listening).filter(s => s);
  const deescScores = analyses.map(a => a.deEscalation).filter(s => s && s !== null);
  const causedFrustration = analyses.filter(a => a.causedFrustration).length;

  // Aggregate issues and strengths
  const issueFreq = {};
  const strengthFreq = {};
  analyses.forEach(a => {
    (a.issues || []).forEach(i => { issueFreq[i] = (issueFreq[i] || 0) + 1; });
    (a.strengths || []).forEach(s => { strengthFreq[s] = (strengthFreq[s] || 0) + 1; });
  });

  const scores = {
    professionalism: parseFloat(avg(profScores).toFixed(2)),
    clarity: parseFloat(avg(clarityScores).toFixed(2)),
    empathy: parseFloat(avg(empathyScores).toFixed(2)),
    listening: parseFloat(avg(listeningScores).toFixed(2)),
    deEscalation: deescScores.length > 0 ? parseFloat(avg(deescScores).toFixed(2)) : null,
  };

  // Calculate overall score (weighted)
  const baseScore = (
    (scores.professionalism * 3) +
    (scores.empathy * 2) +
    (scores.listening * 2) +
    (scores.clarity * 1.5) +
    ((scores.deEscalation || 3) * 1.5)
  ) / 10;

  // Penalty for causing frustration
  const frustrationRate = (causedFrustration / analyses.length) * 100;
  const frustrationPenalty = frustrationRate * 0.02;

  const overallScore = Math.max(0, Math.min(5, baseScore - frustrationPenalty));

  // Determine tier
  let tier;
  if (overallScore >= 4.2) tier = 'exemplary';
  else if (overallScore >= 3.5) tier = 'professional';
  else if (overallScore >= 2.8) tier = 'adequate';
  else if (overallScore >= 2.0) tier = 'needs-coaching';
  else tier = 'critical';

  return {
    totalCalls,
    analyzedCalls: analyses.length,
    scores,
    frustrationCaused: causedFrustration,
    frustrationRate: frustrationRate.toFixed(1),
    overallScore: overallScore.toFixed(2),
    tier,
    commonIssues: Object.entries(issueFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue, count]) => ({ issue, count })),
    commonStrengths: Object.entries(strengthFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([strength, count]) => ({ strength, count })),
  };
}

/**
 * Process a single agent
 */
async function processAgent(agentName, agentCalls, conversations, apiKey) {
  // Select diverse sample: prioritize negative calls, then mix
  const negative = agentCalls.filter(t => t.basicSentiment === 'negative');
  const positive = agentCalls.filter(t => t.basicSentiment === 'positive');
  const neutral = agentCalls.filter(t => t.basicSentiment === 'neutral');

  // Take up to 100 calls, prioritizing negative (where professionalism matters most)
  const maxCalls = CONFIG.callsPerAgent;
  const negCount = Math.min(negative.length, Math.floor(maxCalls * 0.5)); // 50% negative
  const posCount = Math.min(positive.length, Math.floor(maxCalls * 0.3)); // 30% positive
  const neuCount = Math.min(neutral.length, maxCalls - negCount - posCount); // Rest neutral

  const toAnalyze = [
    ...negative.slice(0, negCount),
    ...positive.slice(0, posCount),
    ...neutral.slice(0, neuCount),
  ];

  if (toAnalyze.length === 0) {
    return null;
  }

  console.log(`   Analyzing ${toAnalyze.length} calls (${negCount} neg, ${posCount} pos, ${neuCount} neu)...`);

  const analyses = await processCallsBatch(toAnalyze, conversations, apiKey);
  const scores = calculateAgentScores(analyses, agentCalls.length);

  if (scores) {
    const tierEmoji = {
      'exemplary': '🌟',
      'professional': '✅',
      'adequate': '📝',
      'needs-coaching': '⚠️',
      'critical': '🚨',
    }[scores.tier];
    console.log(`   ${tierEmoji} Score: ${scores.overallScore} | Prof: ${scores.scores.professionalism} | Frust: ${scores.frustrationRate}%`);
  }

  return scores;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const batchNum = args.includes('--batch') ? parseInt(args[args.indexOf('--batch') + 1]) : 1;
  const totalBatches = args.includes('--total-batches') ? parseInt(args[args.indexOf('--total-batches') + 1]) : 1;
  const runAll = args.includes('--all');

  console.log('🎯 Agent Professionalism Analysis (Parallel)');
  console.log('=============================================\n');

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY not found');
    process.exit(1);
  }

  // Load data
  const transcripts = JSON.parse(fs.readFileSync(CONFIG.transcriptsFile, 'utf-8'));
  const conversations = loadConversations();

  // Group by agent
  const agentTranscripts = new Map();
  transcripts.forEach(t => {
    const name = t.agentName || 'Unknown';
    if (!agentTranscripts.has(name)) {
      agentTranscripts.set(name, []);
    }
    agentTranscripts.get(name).push(t);
  });

  const allAgents = Array.from(agentTranscripts.keys()).sort();
  console.log(`📊 Total agents: ${allAgents.length}`);
  console.log(`📊 Total transcripts: ${transcripts.length}`);

  // Determine which agents this batch handles
  let agentsToProcess;
  if (runAll) {
    agentsToProcess = allAgents;
    console.log(`\n🔄 Processing ALL ${allAgents.length} agents...\n`);
  } else {
    const agentsPerBatch = Math.ceil(allAgents.length / totalBatches);
    const startIdx = (batchNum - 1) * agentsPerBatch;
    const endIdx = Math.min(startIdx + agentsPerBatch, allAgents.length);
    agentsToProcess = allAgents.slice(startIdx, endIdx);
    console.log(`\n🔄 Batch ${batchNum}/${totalBatches}: Agents ${startIdx + 1}-${endIdx} (${agentsToProcess.length} agents)\n`);
  }

  // Process agents
  const results = {};

  for (let i = 0; i < agentsToProcess.length; i++) {
    const agentName = agentsToProcess[i];
    const agentCalls = agentTranscripts.get(agentName);

    console.log(`\n[${i + 1}/${agentsToProcess.length}] 👤 ${agentName} (${agentCalls.length} total calls)`);

    const scores = await processAgent(agentName, agentCalls, conversations, apiKey);
    if (scores) {
      results[agentName] = scores;
    }

    // Save progress every 5 agents
    if ((i + 1) % 5 === 0 || i === agentsToProcess.length - 1) {
      const outputPath = runAll
        ? path.join(CONFIG.outputDir, 'all-agents.json')
        : path.join(CONFIG.outputDir, `batch-${batchNum}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
      console.log(`   💾 Progress saved (${Object.keys(results).length} agents)`);
    }
  }

  // Final save
  const outputPath = runAll
    ? path.join(CONFIG.outputDir, 'all-agents.json')
    : path.join(CONFIG.outputDir, `batch-${batchNum}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  console.log('\n\n📊 BATCH SUMMARY');
  console.log('================');

  const sortedResults = Object.entries(results)
    .sort((a, b) => parseFloat(b[1].overallScore) - parseFloat(a[1].overallScore));

  sortedResults.forEach(([name, data], idx) => {
    const tierEmoji = {
      'exemplary': '🌟',
      'professional': '✅',
      'adequate': '📝',
      'needs-coaching': '⚠️',
      'critical': '🚨',
    }[data.tier];
    console.log(`${idx + 1}. ${tierEmoji} ${name}: ${data.overallScore} (Calls: ${data.analyzedCalls})`);
  });

  const tierCounts = {};
  Object.values(results).forEach(a => {
    tierCounts[a.tier] = (tierCounts[a.tier] || 0) + 1;
  });

  console.log('\n📈 Tier Distribution:', tierCounts);
  console.log(`\n✨ Done! Results saved to ${outputPath}`);
}

main().catch(console.error);
