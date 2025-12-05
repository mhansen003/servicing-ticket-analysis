/**
 * Fast AI-Based Sentiment Discovery
 *
 * Quick, cheap AI analysis of ALL transcripts to get better sentiment data.
 * Uses minimal tokens by:
 * - Sending only first ~300 chars of each transcript
 * - Batching multiple transcripts per API call
 * - Requesting minimal JSON response
 *
 * Captures:
 * - Customer mood at START (1-5)
 * - Customer mood at END (1-5)
 * - Was issue resolved? (true/false)
 * - Call type (inquiry, complaint, payment, etc.)
 *
 * Usage: node scripts/fast-sentiment-discovery.mjs
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
  outputFile: path.join(__dirname, '..', 'public', 'data', 'sentiment-discovery.json'),
  progressFile: path.join(__dirname, '..', 'public', 'data', 'sentiment-progress.json'),
  apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
  model: 'anthropic/claude-3-haiku', // Cheapest/fastest
  batchSize: 10, // Analyze 10 transcripts per API call
  concurrentRequests: 5,
  batchDelay: 50,
  charsPerTranscript: 400, // First 400 chars per transcript
  saveInterval: 100, // Save every 100 batches
};

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
 * Get a condensed version of the conversation for analysis
 */
function getConversationSummary(conversation) {
  if (!conversation || conversation.length < 2) return null;

  // Get first and last parts of conversation
  const messages = conversation.slice(0, 4).concat(conversation.slice(-2));
  const text = messages
    .map(msg => `${msg.role.toUpperCase()}: ${msg.text.substring(0, 100)}`)
    .join('\n');

  return text.substring(0, CONFIG.charsPerTranscript);
}

/**
 * Analyze a batch of transcripts
 */
async function analyzeBatch(transcripts, conversations, apiKey) {
  // Build batch data
  const batchData = transcripts.map((t, idx) => {
    const convo = conversations.get(t.id);
    const summary = getConversationSummary(convo);
    return summary ? { idx, id: t.id, text: summary } : null;
  }).filter(x => x);

  if (batchData.length === 0) return [];

  const prompt = `Rate each call (1=negative, 3=neutral, 5=positive). Return JSON array:

${batchData.map((d, i) => `[${i}] ${d.text}`).join('\n\n---\n\n')}

Return ONLY valid JSON array with one object per call:
[{"start":1-5,"end":1-5,"resolved":true/false,"type":"payment|complaint|inquiry|transfer|escrow|other"}]`;

  try {
    const response = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://servicing-ticket-analysis.vercel.app',
        'X-Title': 'Fast Sentiment Discovery',
      },
      body: JSON.stringify({
        model: CONFIG.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error(`API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (content) {
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '');

      const match = jsonStr.match(/\[[\s\S]*\]/);
      if (match) {
        const results = JSON.parse(match[0]);
        // Map back to transcript IDs
        return batchData.map((d, i) => ({
          id: d.id,
          ...results[i]
        })).filter(r => r && typeof r.start === 'number');
      }
    }
    return [];
  } catch (error) {
    console.error(`Batch error: ${error.message}`);
    return [];
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Fast Sentiment Discovery');
  console.log('============================\n');

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY not found');
    process.exit(1);
  }

  // Load data
  const transcripts = JSON.parse(fs.readFileSync(CONFIG.transcriptsFile, 'utf-8'));
  const conversations = loadConversations();

  console.log(`📊 Total transcripts: ${transcripts.length}`);

  // Check for existing progress
  let results = {};
  let startIdx = 0;
  if (fs.existsSync(CONFIG.progressFile)) {
    try {
      const progress = JSON.parse(fs.readFileSync(CONFIG.progressFile, 'utf-8'));
      results = progress.results || {};
      startIdx = progress.lastBatchIdx || 0;
      console.log(`📥 Resuming from batch ${startIdx} (${Object.keys(results).length} already analyzed)`);
    } catch (e) {
      console.log('📥 Starting fresh');
    }
  }

  // Create batches
  const batches = [];
  for (let i = 0; i < transcripts.length; i += CONFIG.batchSize) {
    batches.push(transcripts.slice(i, i + CONFIG.batchSize));
  }

  console.log(`📦 Total batches: ${batches.length}`);
  console.log(`⚡ Processing ${CONFIG.concurrentRequests} batches concurrently\n`);

  let processed = Object.keys(results).length;
  const startTime = Date.now();

  // Process batches with concurrency
  for (let i = startIdx; i < batches.length; i += CONFIG.concurrentRequests) {
    const batchGroup = batches.slice(i, i + CONFIG.concurrentRequests);

    const promises = batchGroup.map(async (batch) => {
      return analyzeBatch(batch, conversations, apiKey);
    });

    const batchResults = await Promise.all(promises);

    // Collect results
    batchResults.flat().forEach(r => {
      if (r && r.id) {
        results[r.id] = {
          startMood: r.start,
          endMood: r.end,
          resolved: r.resolved,
          callType: r.type
        };
        processed++;
      }
    });

    // Progress update
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = (processed - Object.keys(results).length) / elapsed * 60;
    const remaining = transcripts.length - processed;
    const eta = remaining / rate;

    process.stdout.write(`\r📊 Processed: ${processed}/${transcripts.length} (${((processed/transcripts.length)*100).toFixed(1)}%) | Rate: ${rate.toFixed(0)}/min | ETA: ${eta.toFixed(1)}min`);

    // Save progress periodically
    if ((i + CONFIG.concurrentRequests) % CONFIG.saveInterval === 0) {
      fs.writeFileSync(CONFIG.progressFile, JSON.stringify({
        lastBatchIdx: i + CONFIG.concurrentRequests,
        results,
        lastUpdate: new Date().toISOString()
      }));
      console.log(`\n   💾 Progress saved at batch ${i + CONFIG.concurrentRequests}`);
    }

    // Small delay between batch groups
    if (i + CONFIG.concurrentRequests < batches.length) {
      await new Promise(r => setTimeout(r, CONFIG.batchDelay));
    }
  }

  // Calculate stats
  const resultsList = Object.values(results);
  const avgStart = resultsList.reduce((a, r) => a + (r.startMood || 0), 0) / resultsList.length;
  const avgEnd = resultsList.reduce((a, r) => a + (r.endMood || 0), 0) / resultsList.length;
  const resolvedCount = resultsList.filter(r => r.resolved).length;

  const typeCount = {};
  resultsList.forEach(r => {
    if (r.callType) {
      typeCount[r.callType] = (typeCount[r.callType] || 0) + 1;
    }
  });

  // Mood shift analysis
  const improved = resultsList.filter(r => r.endMood > r.startMood).length;
  const worsened = resultsList.filter(r => r.endMood < r.startMood).length;
  const unchanged = resultsList.filter(r => r.endMood === r.startMood).length;

  console.log('\n\n📊 SENTIMENT DISCOVERY RESULTS');
  console.log('================================');
  console.log(`Total analyzed: ${resultsList.length}`);
  console.log(`\nAverage Start Mood: ${avgStart.toFixed(2)}`);
  console.log(`Average End Mood: ${avgEnd.toFixed(2)}`);
  console.log(`Mood Improvement: ${(avgEnd - avgStart).toFixed(2)}`);
  console.log(`\nResolved: ${resolvedCount} (${((resolvedCount/resultsList.length)*100).toFixed(1)}%)`);
  console.log(`\nMood Changes:`);
  console.log(`  📈 Improved: ${improved} (${((improved/resultsList.length)*100).toFixed(1)}%)`);
  console.log(`  📉 Worsened: ${worsened} (${((worsened/resultsList.length)*100).toFixed(1)}%)`);
  console.log(`  ➡️ Unchanged: ${unchanged} (${((unchanged/resultsList.length)*100).toFixed(1)}%)`);
  console.log(`\nCall Types:`, typeCount);

  // Save final results
  const output = {
    generatedAt: new Date().toISOString(),
    totalAnalyzed: resultsList.length,
    summary: {
      avgStartMood: parseFloat(avgStart.toFixed(2)),
      avgEndMood: parseFloat(avgEnd.toFixed(2)),
      moodImprovement: parseFloat((avgEnd - avgStart).toFixed(2)),
      resolutionRate: parseFloat(((resolvedCount/resultsList.length)*100).toFixed(1)),
      improved: improved,
      worsened: worsened,
      unchanged: unchanged,
      callTypes: typeCount
    },
    transcripts: results
  };

  fs.writeFileSync(CONFIG.outputFile, JSON.stringify(output, null, 2));
  console.log(`\n💾 Results saved to ${CONFIG.outputFile}`);

  // Clean up progress file
  if (fs.existsSync(CONFIG.progressFile)) {
    fs.unlinkSync(CONFIG.progressFile);
  }

  console.log('\n✨ Done!');
}

main().catch(console.error);
