/**
 * Agent Professionalism Analysis Script
 *
 * This script analyzes transcripts to score agents on PROFESSIONALISM,
 * not just call outcomes. An agent can have a negative call but still
 * be professional. We want to identify:
 *
 * 1. Agents who CAUSE customer frustration (bad)
 * 2. Agents who handle difficult customers professionally (good)
 * 3. Unprofessional behavior patterns
 *
 * Usage: node scripts/analyze-agent-professionalism.mjs [--sample N] [--agent "Name"]
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
  outputFile: path.join(__dirname, '..', 'public', 'data', 'agent-professionalism.json'),
  apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
  model: 'anthropic/claude-3-haiku',
  callsPerAgent: 8, // Analyze 8 calls per agent for scoring
  batchDelay: 100, // ms between API calls
};

// Load all conversations into memory for quick access
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
async function analyzeAgentBehavior(conversation, apiKey) {
  if (!apiKey || !conversation || conversation.length < 4) {
    return null;
  }

  // Build conversation text with clear role labels
  const conversationText = conversation
    .map(msg => `${msg.role.toUpperCase()}: ${msg.text}`)
    .join('\n');

  const prompt = `You are evaluating an agent's PROFESSIONALISM in a mortgage customer service call.

IMPORTANT: We are NOT judging the agent by the customer's mood - customers may come in frustrated. We ARE judging:
1. Did the AGENT behave professionally?
2. Did the AGENT cause or worsen customer frustration?
3. Did the AGENT handle a difficult situation well?

TRANSCRIPT:
${conversationText.substring(0, 4000)}

Analyze ONLY the agent's behavior and return JSON:
{
  "agentProfessionalism": <1-5, 5=exemplary professional, 1=unprofessional>,
  "agentCausedFrustration": <true if agent made customer MORE upset, false otherwise>,
  "deEscalationSkill": <1-5, how well agent calmed upset customer, N/A if customer wasn't upset>,
  "communicationClarity": <1-5, clear explanations, no jargon confusion>,
  "activeListening": <1-5, addressed customer concerns, didn't ignore issues>,
  "empathy": <1-5, acknowledged feelings, showed understanding>,
  "customerStartMood": "<frustrated/neutral/positive - how customer started>",
  "customerEndMood": "<frustrated/neutral/positive - how customer ended>",
  "agentIssues": ["<specific unprofessional behaviors if any, empty array if professional>"],
  "agentStrengths": ["<specific good behaviors>"],
  "summary": "<1 sentence: What the agent did well or poorly>"
}

SCORING GUIDE:
5 = Exemplary - went above and beyond, excellent handling
4 = Professional - proper tone, helpful, no issues
3 = Adequate - got the job done, minor issues
2 = Below standard - noticeable problems, customer impact
1 = Unprofessional - rude, dismissive, caused problems

Return ONLY valid JSON.`;

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
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      console.error(`API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (content) {
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
  const sampleSize = args.includes('--sample') ? parseInt(args[args.indexOf('--sample') + 1]) : null;
  const specificAgent = args.includes('--agent') ? args[args.indexOf('--agent') + 1] : null;

  console.log('🎯 Agent Professionalism Analysis');
  console.log('==================================\n');

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY not found');
    process.exit(1);
  }

  // Load data
  const transcripts = JSON.parse(fs.readFileSync(CONFIG.transcriptsFile, 'utf-8'));
  const conversations = loadConversations();

  console.log(`📊 Total transcripts: ${transcripts.length}`);

  // Group transcripts by agent
  const agentTranscripts = new Map();
  transcripts.forEach(t => {
    const name = t.agentName || 'Unknown';
    if (!agentTranscripts.has(name)) {
      agentTranscripts.set(name, []);
    }
    agentTranscripts.get(name).push(t);
  });

  console.log(`👥 Total agents: ${agentTranscripts.size}`);

  // Filter to specific agent if requested
  let agentsToProcess = Array.from(agentTranscripts.keys());
  if (specificAgent) {
    agentsToProcess = agentsToProcess.filter(a =>
      a.toLowerCase().includes(specificAgent.toLowerCase())
    );
    console.log(`🔍 Filtering to agent: ${agentsToProcess.join(', ')}`);
  }

  if (sampleSize) {
    agentsToProcess = agentsToProcess.slice(0, sampleSize);
    console.log(`📊 Sampling ${sampleSize} agents`);
  }

  // Results storage
  const agentResults = {};
  let totalAnalyzed = 0;
  let totalCalls = 0;

  // Process each agent
  for (const agentName of agentsToProcess) {
    const agentCalls = agentTranscripts.get(agentName);
    console.log(`\n👤 ${agentName} (${agentCalls.length} total calls)`);

    // Select diverse sample: some negative, some positive, some neutral
    const negative = agentCalls.filter(t => t.basicSentiment === 'negative');
    const positive = agentCalls.filter(t => t.basicSentiment === 'positive');
    const neutral = agentCalls.filter(t => t.basicSentiment === 'neutral');

    // Prioritize negative calls (where professionalism matters most), then mix
    const toAnalyze = [
      ...negative.slice(0, Math.min(4, negative.length)),
      ...positive.slice(0, Math.min(2, positive.length)),
      ...neutral.slice(0, Math.min(2, neutral.length)),
    ].slice(0, CONFIG.callsPerAgent);

    if (toAnalyze.length === 0) {
      console.log('   ⚠️ No calls to analyze');
      continue;
    }

    const analyses = [];

    for (const transcript of toAnalyze) {
      const conversation = conversations.get(transcript.id);
      if (!conversation || conversation.length < 4) {
        continue;
      }

      const result = await analyzeAgentBehavior(conversation, apiKey);
      if (result) {
        analyses.push({
          callId: transcript.id,
          callSentiment: transcript.basicSentiment,
          ...result,
        });
        totalAnalyzed++;

        const icon = result.agentProfessionalism >= 4 ? '✅' :
                     result.agentProfessionalism <= 2 ? '⚠️' : '📝';
        console.log(`   ${icon} Prof:${result.agentProfessionalism} | ${result.summary?.substring(0, 50)}...`);
      }

      totalCalls++;
      await new Promise(resolve => setTimeout(resolve, CONFIG.batchDelay));
    }

    if (analyses.length === 0) {
      continue;
    }

    // Calculate agent scores
    const profScores = analyses.map(a => a.agentProfessionalism).filter(s => s);
    const clarityScores = analyses.map(a => a.communicationClarity).filter(s => s);
    const empathyScores = analyses.map(a => a.empathy).filter(s => s);
    const listeningScores = analyses.map(a => a.activeListening).filter(s => s);
    const deescScores = analyses.map(a => a.deEscalationSkill).filter(s => s && s !== 'N/A');
    const causedFrustration = analyses.filter(a => a.agentCausedFrustration).length;

    // Aggregate issues and strengths
    const allIssues = analyses.flatMap(a => a.agentIssues || []);
    const allStrengths = analyses.flatMap(a => a.agentStrengths || []);

    // Count common patterns
    const issueFreq = {};
    allIssues.forEach(i => { issueFreq[i] = (issueFreq[i] || 0) + 1; });
    const strengthFreq = {};
    allStrengths.forEach(s => { strengthFreq[s] = (strengthFreq[s] || 0) + 1; });

    const avgProf = profScores.length > 0 ?
      (profScores.reduce((a, b) => a + b, 0) / profScores.length).toFixed(2) : null;
    const avgClarity = clarityScores.length > 0 ?
      (clarityScores.reduce((a, b) => a + b, 0) / clarityScores.length).toFixed(2) : null;
    const avgEmpathy = empathyScores.length > 0 ?
      (empathyScores.reduce((a, b) => a + b, 0) / empathyScores.length).toFixed(2) : null;
    const avgListening = listeningScores.length > 0 ?
      (listeningScores.reduce((a, b) => a + b, 0) / listeningScores.length).toFixed(2) : null;
    const avgDeesc = deescScores.length > 0 ?
      (deescScores.reduce((a, b) => a + b, 0) / deescScores.length).toFixed(2) : null;

    agentResults[agentName] = {
      totalCalls: agentCalls.length,
      analyzedCalls: analyses.length,
      scores: {
        professionalism: parseFloat(avgProf) || 0,
        communicationClarity: parseFloat(avgClarity) || 0,
        empathy: parseFloat(avgEmpathy) || 0,
        activeListening: parseFloat(avgListening) || 0,
        deEscalation: parseFloat(avgDeesc) || 0,
      },
      frustrationCaused: causedFrustration,
      frustrationRate: ((causedFrustration / analyses.length) * 100).toFixed(1),
      commonIssues: Object.entries(issueFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([issue, count]) => ({ issue, count })),
      commonStrengths: Object.entries(strengthFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([strength, count]) => ({ strength, count })),
      sampleAnalyses: analyses.slice(0, 3), // Keep a few for reference
    };

    console.log(`   📊 Avg Professionalism: ${avgProf} | Frustration Caused: ${causedFrustration}/${analyses.length}`);
  }

  // Calculate overall professionalism score (weighted)
  Object.values(agentResults).forEach(agent => {
    const s = agent.scores;
    // Weight: professionalism most important, then empathy/listening, then clarity
    // Subtract points for causing frustration
    const baseScore = (
      (s.professionalism * 3) +
      (s.empathy * 2) +
      (s.activeListening * 2) +
      (s.communicationClarity * 1.5) +
      (s.deEscalation || 3) * 1.5 // Default to 3 if N/A
    ) / 10;

    // Penalty for causing frustration (big deal!)
    const frustrationPenalty = parseFloat(agent.frustrationRate) * 0.02;

    agent.overallScore = Math.max(0, Math.min(5, baseScore - frustrationPenalty)).toFixed(2);

    // Determine tier based on overall score
    const score = parseFloat(agent.overallScore);
    if (score >= 4.2) agent.tier = 'exemplary';
    else if (score >= 3.5) agent.tier = 'professional';
    else if (score >= 2.8) agent.tier = 'adequate';
    else if (score >= 2.0) agent.tier = 'needs-coaching';
    else agent.tier = 'critical';
  });

  // Sort by overall score
  const sortedAgents = Object.entries(agentResults)
    .sort((a, b) => parseFloat(b[1].overallScore) - parseFloat(a[1].overallScore));

  console.log('\n\n📊 FINAL RANKINGS (by Professionalism)');
  console.log('=========================================');
  sortedAgents.forEach(([name, data], idx) => {
    const tierEmoji = {
      'exemplary': '🌟',
      'professional': '✅',
      'adequate': '📝',
      'needs-coaching': '⚠️',
      'critical': '🚨',
    }[data.tier];
    console.log(`${idx + 1}. ${tierEmoji} ${name}: ${data.overallScore} (Prof:${data.scores.professionalism}, Frust:${data.frustrationRate}%)`);
  });

  // Save results
  const output = {
    generatedAt: new Date().toISOString(),
    totalAgentsAnalyzed: Object.keys(agentResults).length,
    totalCallsAnalyzed: totalAnalyzed,
    methodology: 'AI analysis of agent behavior in calls, focusing on professionalism not call outcomes',
    scoringWeights: {
      professionalism: 3,
      empathy: 2,
      activeListening: 2,
      communicationClarity: 1.5,
      deEscalation: 1.5,
      frustrationPenalty: '-2% per incident',
    },
    tiers: {
      exemplary: '4.2+',
      professional: '3.5-4.2',
      adequate: '2.8-3.5',
      'needs-coaching': '2.0-2.8',
      critical: '<2.0',
    },
    agents: Object.fromEntries(sortedAgents),
  };

  fs.writeFileSync(CONFIG.outputFile, JSON.stringify(output, null, 2));
  console.log(`\n💾 Saved to ${CONFIG.outputFile}`);

  // Summary stats
  const tierCounts = {};
  Object.values(agentResults).forEach(a => {
    tierCounts[a.tier] = (tierCounts[a.tier] || 0) + 1;
  });
  console.log('\n📈 Tier Distribution:', tierCounts);
  console.log(`\n✨ Done! Analyzed ${totalAnalyzed} calls across ${Object.keys(agentResults).length} agents.`);
}

main().catch(console.error);
