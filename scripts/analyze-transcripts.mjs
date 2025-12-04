/**
 * Transcript Analysis Script
 *
 * This script parses call transcripts and uses AI to analyze:
 * - Overall sentiment (positive, negative, neutral)
 * - Customer emotion (angry, frustrated, satisfied, confused, etc.)
 * - Call resolution status
 * - Key topics discussed
 * - Agent performance indicators
 *
 * Usage: node scripts/analyze-transcripts.mjs [--sample N] [--resume]
 *
 * Options:
 *   --sample N   Only process N random records (for testing)
 *   --resume     Continue from last processed record
 *   --skip-ai    Skip AI analysis (just parse and extract metadata)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  inputFile: process.env.TRANSCRIPT_FILE || 'C:\\Users\\Mark Hansen\\Downloads\\Nov 1 to Date Call Logs.txt',
  outputDir: path.join(__dirname, '..', 'public', 'data'),
  outputFile: 'transcript-analysis.json',       // Metadata only (smaller)
  conversationsFile: 'transcript-conversations.json',  // Full conversations (larger, split into chunks)
  statsFile: 'transcript-stats.json',
  progressFile: path.join(__dirname, '.transcript-progress.json'),
  batchSize: 50,  // Process in batches for API calls
  conversationChunkSize: 5000, // Split conversations into chunks for loading
  // OpenRouter API for AI analysis
  apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
  model: 'anthropic/claude-3-haiku', // Fast and cost-effective for classification
};

// Sentiment and emotion categories
const SENTIMENTS = ['positive', 'negative', 'neutral', 'mixed'];
const EMOTIONS = ['satisfied', 'grateful', 'neutral', 'confused', 'frustrated', 'angry', 'anxious', 'disappointed'];
const RESOLUTION_STATUS = ['resolved', 'partially_resolved', 'unresolved', 'escalated', 'callback_needed'];
const TOPICS = [
  'payment_inquiry', 'escrow', 'loan_assumption', 'refinance', 'account_access',
  'statement_request', 'payoff_quote', 'insurance', 'property_taxes', 'loan_modification',
  'complaint', 'general_inquiry', 'technical_issue', 'transfer', 'other'
];

/**
 * Parse TSV file and extract call records
 */
function parseTranscriptFile(filePath) {
  console.log(`📂 Reading transcript file: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const headers = lines[0].split('\t');

  console.log(`📋 Found ${lines.length - 1} records`);
  console.log(`📋 Columns: ${headers.join(', ')}`);

  const records = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const values = lines[i].split('\t');
    const record = {};

    headers.forEach((header, idx) => {
      record[header.trim()] = values[idx] || '';
    });

    // Parse the JSON conversation if present
    if (record.Conversation) {
      try {
        record.parsedConversation = JSON.parse(record.Conversation);
      } catch (e) {
        record.parsedConversation = null;
      }
    }

    records.push(record);
  }

  return records;
}

/**
 * Extract clean conversation text from parsed conversation
 */
function extractConversationText(record) {
  if (!record.parsedConversation?.conversationEntries) {
    return null;
  }

  const entries = record.parsedConversation.conversationEntries;

  // Sort by timestamp (newest first in data, we want oldest first)
  const sorted = [...entries].sort((a, b) =>
    (a.clientTimestamp || 0) - (b.clientTimestamp || 0)
  );

  // Build conversation transcript
  const transcript = sorted.map(entry => {
    const role = entry.sender?.role === 'Agent' ? 'Agent' : 'Customer';
    const text = (entry.messageText || '')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    return `${role}: ${text}`;
  }).join('\n');

  return transcript;
}

/**
 * Extract basic metadata without AI
 */
function extractBasicMetadata(record) {
  const conversation = record.parsedConversation?.conversationEntries || [];

  // Count messages by role
  const customerMessages = conversation.filter(e => e.sender?.role !== 'Agent').length;
  const agentMessages = conversation.filter(e => e.sender?.role === 'Agent').length;

  // Get all message text
  const allText = conversation.map(e => e.messageText || '').join(' ').toLowerCase();

  // Basic keyword-based topic detection
  const detectedTopics = [];
  if (allText.includes('payment') || allText.includes('pay')) detectedTopics.push('payment_inquiry');
  if (allText.includes('escrow')) detectedTopics.push('escrow');
  if (allText.includes('assumption') || allText.includes('assume')) detectedTopics.push('loan_assumption');
  if (allText.includes('refinance') || allText.includes('refi')) detectedTopics.push('refinance');
  if (allText.includes('login') || allText.includes('password') || allText.includes('access')) detectedTopics.push('account_access');
  if (allText.includes('statement')) detectedTopics.push('statement_request');
  if (allText.includes('payoff')) detectedTopics.push('payoff_quote');
  if (allText.includes('insurance') || allText.includes('hazard')) detectedTopics.push('insurance');
  if (allText.includes('tax') || allText.includes('property tax')) detectedTopics.push('property_taxes');
  if (allText.includes('modification') || allText.includes('hardship')) detectedTopics.push('loan_modification');
  if (allText.includes('complaint') || allText.includes('supervisor') || allText.includes('manager')) detectedTopics.push('complaint');
  if (allText.includes('transfer')) detectedTopics.push('transfer');

  // Enhanced sentiment analysis - be more CRITICAL
  // Only count as positive if genuinely expressing satisfaction
  const strongPositiveWords = ['excellent', 'wonderful', 'amazing', 'fantastic', 'perfect', 'awesome'];
  const mildPositiveWords = ['thank', 'thanks', 'appreciate', 'great', 'good', 'helpful', 'happy'];

  // Expanded negative indicators - catch subtle frustration
  const strongNegativeWords = [
    'frustrated', 'frustrating', 'angry', 'furious', 'livid', 'outraged',
    'terrible', 'horrible', 'awful', 'worst', 'ridiculous', 'unacceptable',
    'incompetent', 'useless', 'pathetic', 'disgraceful', 'disgusting'
  ];
  const negativeExperience = [
    'been waiting', 'still waiting', 'waited', 'waiting for',
    'no one', 'nobody', 'never called', 'never received', 'never got',
    'called multiple', 'called several', 'called many', 'keep calling',
    'third time', 'fourth time', 'fifth time', 'again and again',
    'not resolved', 'still not', 'hasn\'t been', 'hasn\'t happened',
    'wrong', 'incorrect', 'error', 'mistake', 'messed up',
    'overcharged', 'charged twice', 'double charged',
    'disappointed', 'disappointing', 'let down',
    'don\'t understand', 'doesn\'t make sense', 'confused',
    'not what i', 'not what was', 'that\'s not',
    'lied', 'lying', 'dishonest', 'misleading', 'misled',
    'complaint', 'complain', 'supervisor', 'manager', 'escalate',
    'cancel', 'closing', 'refinance away', 'going elsewhere', 'another company',
    'wasting my time', 'waste of time', 'taking forever',
    'unresponsive', 'no response', 'no reply', 'ignored',
    'rude', 'disrespectful', 'unprofessional',
    'problem', 'issue', 'trouble', 'difficult', 'hassle',
    'can\'t believe', 'cannot believe', 'seriously',
    'this is crazy', 'this is insane', 'how is this',
    'for weeks', 'for months', 'over a month', 'over a week'
  ];
  const negativeEmotion = [
    'upset', 'unhappy', 'annoyed', 'irritated', 'aggravated',
    'stressed', 'worried', 'concerned', 'anxious', 'nervous',
    'tired of', 'sick of', 'fed up', 'had enough', 'done with'
  ];

  // Count indicators
  const strongPositiveCount = strongPositiveWords.filter(w => allText.includes(w)).length;
  const mildPositiveCount = mildPositiveWords.filter(w => allText.includes(w)).length;
  const strongNegativeCount = strongNegativeWords.filter(w => allText.includes(w)).length;
  const negativeExpCount = negativeExperience.filter(phrase => allText.includes(phrase)).length;
  const negativeEmotionCount = negativeEmotion.filter(w => allText.includes(w)).length;

  // Calculate scores - weight negative experience phrases heavily
  const positiveScore = strongPositiveCount * 3 + mildPositiveCount * 1;
  const negativeScore = strongNegativeCount * 4 + negativeExpCount * 3 + negativeEmotionCount * 2;

  // Determine sentiment with critical eye
  let basicSentiment = 'neutral';
  if (negativeScore >= 3) {
    basicSentiment = 'negative';  // Any significant negative signals = negative
  } else if (negativeScore >= 1 && positiveScore < 5) {
    basicSentiment = 'negative';  // Some negative without strong positive = negative
  } else if (positiveScore >= 5 && negativeScore === 0) {
    basicSentiment = 'positive';  // Strong positive with NO negative = positive
  } else if (positiveScore >= 2 && negativeScore === 0) {
    basicSentiment = 'positive';  // Mild positive with no negative
  }
  // Otherwise stays neutral

  // Build structured conversation messages for display
  const conversationMessages = conversation
    .sort((a, b) => (a.clientTimestamp || 0) - (b.clientTimestamp || 0))
    .map(entry => ({
      role: entry.sender?.role === 'Agent' ? 'agent' : 'customer',
      text: (entry.messageText || '')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>'),
      timestamp: entry.clientTimestamp || null,
    }))
    .filter(msg => msg.text.trim());

  return {
    id: record.VoiceCallId,
    vendorCallKey: record.VendorCallKey,
    callStart: record.CallStartDateTime,
    callEnd: record.CallEndDateTime,
    durationSeconds: parseInt(record.CallDurationInSeconds) || 0,
    disposition: record.CallDispositionServicing,
    numberOfHolds: parseInt(record.NumberOfHolds) || 0,
    holdDuration: parseInt(record.CustomerHoldDuration) || 0,
    department: record.Department,
    status: record.VoiceCallStatus,
    agentName: record.Name,
    agentRole: record.UserRoleName,
    agentProfile: record.ProfileName,
    agentEmail: record.Email,
    messageCount: conversation.length,
    customerMessages,
    agentMessages,
    detectedTopics: detectedTopics.length > 0 ? detectedTopics : ['general_inquiry'],
    basicSentiment,
    // Include conversation for drill-down display
    conversation: conversationMessages,
    // These will be filled by AI analysis
    aiAnalysis: null,
  };
}

/**
 * AI-powered analysis using OpenRouter API
 */
async function analyzeWithAI(conversationText, apiKey) {
  if (!apiKey) {
    return null;
  }

  const prompt = `Analyze this customer service call transcript and provide a JSON response with:

1. sentiment: Overall sentiment (positive, negative, neutral, mixed)
2. customerEmotion: Primary customer emotion (satisfied, grateful, neutral, confused, frustrated, angry, anxious, disappointed)
3. emotionIntensity: 1-5 scale (1=mild, 5=extreme)
4. resolution: Call resolution (resolved, partially_resolved, unresolved, escalated, callback_needed)
5. topics: Array of topics discussed from: payment_inquiry, escrow, loan_assumption, refinance, account_access, statement_request, payoff_quote, insurance, property_taxes, loan_modification, complaint, general_inquiry, technical_issue, transfer, other
6. agentPerformance: Rate 1-5 (professionalism, helpfulness, clarity)
7. summary: One sentence summary of the call
8. keyIssue: The main customer issue in 5-10 words
9. escalationRisk: low, medium, high - likelihood customer will escalate/complain

TRANSCRIPT:
${conversationText.substring(0, 3000)}

Respond ONLY with valid JSON, no markdown or explanation.`;

  try {
    const response = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://servicing-ticket-analysis.vercel.app',
      },
      body: JSON.stringify({
        model: CONFIG.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
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
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }

    return null;
  } catch (error) {
    console.error(`AI analysis error: ${error.message}`);
    return null;
  }
}

/**
 * Generate aggregate statistics
 */
function generateStats(analyzedRecords) {
  const stats = {
    totalCalls: analyzedRecords.length,
    generatedAt: new Date().toISOString(),

    // Sentiment distribution
    sentimentDistribution: {},

    // Emotion distribution
    emotionDistribution: {},

    // Resolution distribution
    resolutionDistribution: {},

    // Topic distribution
    topicDistribution: {},

    // Escalation risk
    escalationRiskDistribution: {},

    // By department
    byDepartment: {},

    // By agent
    byAgent: {},

    // Time-based
    byDayOfWeek: {},
    byHour: {},

    // Call metrics
    avgDuration: 0,
    avgHoldTime: 0,
    avgMessagesPerCall: 0,

    // Agent performance (if AI analysis done)
    avgAgentPerformance: null,

    // Trends (daily aggregates)
    dailyTrends: [],
  };

  let totalDuration = 0;
  let totalHold = 0;
  let totalMessages = 0;
  let totalAgentPerf = 0;
  let agentPerfCount = 0;

  const dailyMap = new Map();

  analyzedRecords.forEach(record => {
    // Sentiment
    const sentiment = record.aiAnalysis?.sentiment || record.basicSentiment || 'neutral';
    stats.sentimentDistribution[sentiment] = (stats.sentimentDistribution[sentiment] || 0) + 1;

    // Emotion
    const emotion = record.aiAnalysis?.customerEmotion || 'neutral';
    stats.emotionDistribution[emotion] = (stats.emotionDistribution[emotion] || 0) + 1;

    // Resolution
    const resolution = record.aiAnalysis?.resolution || 'unknown';
    stats.resolutionDistribution[resolution] = (stats.resolutionDistribution[resolution] || 0) + 1;

    // Topics
    const topics = record.aiAnalysis?.topics || record.detectedTopics || [];
    topics.forEach(topic => {
      stats.topicDistribution[topic] = (stats.topicDistribution[topic] || 0) + 1;
    });

    // Escalation risk
    const risk = record.aiAnalysis?.escalationRisk || 'unknown';
    stats.escalationRiskDistribution[risk] = (stats.escalationRiskDistribution[risk] || 0) + 1;

    // Department
    if (record.department) {
      if (!stats.byDepartment[record.department]) {
        stats.byDepartment[record.department] = { count: 0, negative: 0, positive: 0 };
      }
      stats.byDepartment[record.department].count++;
      if (sentiment === 'negative') stats.byDepartment[record.department].negative++;
      if (sentiment === 'positive') stats.byDepartment[record.department].positive++;
    }

    // Agent
    if (record.agentName) {
      if (!stats.byAgent[record.agentName]) {
        stats.byAgent[record.agentName] = { count: 0, avgPerformance: 0, perfSum: 0 };
      }
      stats.byAgent[record.agentName].count++;
      if (record.aiAnalysis?.agentPerformance) {
        stats.byAgent[record.agentName].perfSum += record.aiAnalysis.agentPerformance;
      }
    }

    // Time analysis
    if (record.callStart) {
      const date = new Date(record.callStart);
      if (!isNaN(date.getTime())) {
        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
        const hour = date.getHours();
        // Extract date directly from callStart string to avoid timezone issues
        // callStart format: "2025-11-29 16:46:04.000"
        const dateKey = record.callStart.split(' ')[0];

        stats.byDayOfWeek[dayName] = (stats.byDayOfWeek[dayName] || 0) + 1;
        stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;

        // Daily trends
        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, { date: dateKey, total: 0, positive: 0, negative: 0, neutral: 0 });
        }
        const daily = dailyMap.get(dateKey);
        daily.total++;
        if (sentiment === 'positive') daily.positive++;
        else if (sentiment === 'negative') daily.negative++;
        else daily.neutral++;
      }
    }

    // Metrics
    totalDuration += record.durationSeconds || 0;
    totalHold += record.holdDuration || 0;
    totalMessages += record.messageCount || 0;

    if (record.aiAnalysis?.agentPerformance) {
      totalAgentPerf += record.aiAnalysis.agentPerformance;
      agentPerfCount++;
    }
  });

  // Calculate averages
  stats.avgDuration = Math.round(totalDuration / analyzedRecords.length);
  stats.avgHoldTime = Math.round(totalHold / analyzedRecords.length);
  stats.avgMessagesPerCall = Math.round(totalMessages / analyzedRecords.length);

  if (agentPerfCount > 0) {
    stats.avgAgentPerformance = (totalAgentPerf / agentPerfCount).toFixed(2);
  }

  // Finalize agent averages
  Object.keys(stats.byAgent).forEach(agent => {
    const agentData = stats.byAgent[agent];
    if (agentData.perfSum > 0) {
      agentData.avgPerformance = (agentData.perfSum / agentData.count).toFixed(2);
    }
    delete agentData.perfSum;
  });

  // Sort daily trends
  stats.dailyTrends = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return stats;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const sampleSize = args.includes('--sample') ? parseInt(args[args.indexOf('--sample') + 1]) : null;
  const resume = args.includes('--resume');
  const skipAI = args.includes('--skip-ai');

  console.log('🎙️  Transcript Analysis Script');
  console.log('================================\n');

  // Check for API key
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey && !skipAI) {
    console.log('⚠️  No OPENROUTER_API_KEY found. Running with basic analysis only.');
    console.log('   Set the environment variable for AI-powered sentiment analysis.\n');
  }

  // Parse transcripts
  const records = parseTranscriptFile(CONFIG.inputFile);
  console.log(`\n✅ Parsed ${records.length} call records\n`);

  // Sample if requested
  let toProcess = records;
  if (sampleSize) {
    console.log(`📊 Sampling ${sampleSize} records for analysis...\n`);
    toProcess = records.sort(() => Math.random() - 0.5).slice(0, sampleSize);
  }

  // Load progress if resuming
  let startIndex = 0;
  let existingResults = [];
  if (resume && fs.existsSync(CONFIG.progressFile)) {
    const progress = JSON.parse(fs.readFileSync(CONFIG.progressFile, 'utf-8'));
    startIndex = progress.lastIndex || 0;
    existingResults = progress.results || [];
    console.log(`📂 Resuming from record ${startIndex}...\n`);
  }

  // Process records
  const results = [...existingResults];
  let processedCount = existingResults.length;

  console.log('🔄 Processing transcripts...\n');

  for (let i = startIndex; i < toProcess.length; i++) {
    const record = toProcess[i];

    // Extract basic metadata
    const metadata = extractBasicMetadata(record);

    // Extract conversation text for AI analysis
    const conversationText = extractConversationText(record);

    // AI analysis if enabled and we have API key
    if (!skipAI && apiKey && conversationText && conversationText.length > 100) {
      try {
        const aiResult = await analyzeWithAI(conversationText, apiKey);
        if (aiResult) {
          metadata.aiAnalysis = aiResult;
        }

        // Rate limit - small delay between API calls
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`  Error analyzing record ${i}: ${error.message}`);
      }
    }

    results.push(metadata);
    processedCount++;

    // Progress update
    if (processedCount % 100 === 0) {
      console.log(`  Processed ${processedCount}/${toProcess.length} records...`);

      // Save progress
      fs.writeFileSync(CONFIG.progressFile, JSON.stringify({
        lastIndex: i + 1,
        results,
      }));
    }
  }

  console.log(`\n✅ Processed ${results.length} records\n`);

  // Generate statistics
  console.log('📊 Generating statistics...\n');
  const stats = generateStats(results);

  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // Split results: metadata (small) and conversations (large)
  const metadataResults = results.map(r => {
    const { conversation, ...metadata } = r;
    return metadata;
  });

  // Save metadata (without conversations) - small file
  const outputPath = path.join(CONFIG.outputDir, CONFIG.outputFile);
  fs.writeFileSync(outputPath, JSON.stringify(metadataResults, null, 2));
  console.log(`💾 Saved analysis metadata to: ${outputPath}`);

  // Save conversations in chunks to avoid large file issues
  const conversationMap = {};
  results.forEach(r => {
    if (r.conversation && r.conversation.length > 0) {
      conversationMap[r.id] = r.conversation;
    }
  });

  // Split into chunks of ~5000 conversations each
  const ids = Object.keys(conversationMap);
  const chunkSize = CONFIG.conversationChunkSize;
  const numChunks = Math.ceil(ids.length / chunkSize);

  for (let i = 0; i < numChunks; i++) {
    const chunkIds = ids.slice(i * chunkSize, (i + 1) * chunkSize);
    const chunkData = {};
    chunkIds.forEach(id => {
      chunkData[id] = conversationMap[id];
    });

    const chunkPath = path.join(CONFIG.outputDir, `transcript-conversations-${i}.json`);
    fs.writeFileSync(chunkPath, JSON.stringify(chunkData));
    console.log(`💾 Saved conversations chunk ${i + 1}/${numChunks} to: ${chunkPath}`);
  }

  // Save chunk index for the frontend
  const indexPath = path.join(CONFIG.outputDir, 'transcript-conversations-index.json');
  fs.writeFileSync(indexPath, JSON.stringify({
    numChunks,
    chunkSize,
    totalConversations: ids.length,
  }));
  console.log(`💾 Saved conversation index to: ${indexPath}`);

  const statsPath = path.join(CONFIG.outputDir, CONFIG.statsFile);
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
  console.log(`💾 Saved statistics to: ${statsPath}`);

  // Clean up progress file
  if (fs.existsSync(CONFIG.progressFile)) {
    fs.unlinkSync(CONFIG.progressFile);
  }

  // Print summary
  console.log('\n📈 Analysis Summary:');
  console.log('====================');
  console.log(`Total Calls: ${stats.totalCalls}`);
  console.log(`Avg Duration: ${Math.round(stats.avgDuration / 60)} minutes`);
  console.log(`Avg Hold Time: ${stats.avgHoldTime} seconds`);
  console.log('\nSentiment Distribution:');
  Object.entries(stats.sentimentDistribution).forEach(([k, v]) => {
    console.log(`  ${k}: ${v} (${((v / stats.totalCalls) * 100).toFixed(1)}%)`);
  });

  console.log('\n✨ Done!\n');
}

main().catch(console.error);
