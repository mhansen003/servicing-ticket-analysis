/**
 * Transcript AI Analyzer Module
 *
 * Reusable module for analyzing transcripts with AI
 * Extracted from analyze-transcripts-db.mjs for use in sync scripts
 */

import fetch from 'node-fetch';

// Configuration
const CONFIG = {
  API_URL: 'https://openrouter.ai/api/v1/chat/completions',
  API_KEY: process.env.OPENROUTER_API_KEY,
  MODEL: 'anthropic/claude-3.5-sonnet',
  LAST_N_CHARS: 1500,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000,
};

/**
 * Analyze a single transcript with AI
 * @param {Object} transcript - The transcript record from database
 * @param {PrismaClient} prisma - Prisma client instance
 * @returns {Promise<Object>} Analysis result
 */
export async function analyzeTranscript(transcript, prisma) {
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

    // Save to database immediately
    await prisma.transcriptAnalysis.upsert({
      where: { vendorCallKey: result.vendorCallKey },
      update: {
        agentName: result.agentName,
        agentSentiment: result.agentSentiment,
        agentSentimentScore: result.agentSentimentScore,
        agentSentimentReason: result.agentSentimentReason,
        customerSentiment: result.customerSentiment,
        customerSentimentScore: result.customerSentimentScore,
        customerSentimentReason: result.customerSentimentReason,
        aiDiscoveredTopic: result.aiDiscoveredTopic,
        aiDiscoveredSubcategory: result.aiDiscoveredSubcategory,
        topicConfidence: result.topicConfidence,
        keyIssues: result.keyIssues || [],
        resolution: result.resolution,
        tags: result.tags || [],
        model: CONFIG.MODEL,
      },
      create: {
        vendorCallKey: result.vendorCallKey,
        agentName: result.agentName,
        agentSentiment: result.agentSentiment,
        agentSentimentScore: result.agentSentimentScore,
        agentSentimentReason: result.agentSentimentReason,
        customerSentiment: result.customerSentiment,
        customerSentimentScore: result.customerSentimentScore,
        customerSentimentReason: result.customerSentimentReason,
        aiDiscoveredTopic: result.aiDiscoveredTopic,
        aiDiscoveredSubcategory: result.aiDiscoveredSubcategory,
        topicConfidence: result.topicConfidence,
        keyIssues: result.keyIssues || [],
        resolution: result.resolution,
        tags: result.tags || [],
        model: CONFIG.MODEL,
      },
    });

    return result;

  } catch (error) {
    throw new Error(`Analysis failed for ${transcript.vendor_call_key}: ${error.message}`);
  }
}

/**
 * Analyze multiple transcripts with retry logic and concurrency control
 * @param {Array} transcripts - Array of transcript records
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {Object} options - Options for batch processing
 * @returns {Promise<Object>} Results and errors
 */
export async function analyzeTranscriptBatch(transcripts, prisma, options = {}) {
  const {
    maxConcurrent = 20,
    retryAttempts = CONFIG.RETRY_ATTEMPTS,
    retryDelay = CONFIG.RETRY_DELAY,
    onProgress = null
  } = options;

  const results = [];
  const errors = [];
  let processed = 0;

  for (let i = 0; i < transcripts.length; i += maxConcurrent) {
    const chunk = transcripts.slice(i, i + maxConcurrent);

    const promises = chunk.map(async (transcript) => {
      for (let attempt = 1; attempt <= retryAttempts; attempt++) {
        try {
          const result = await analyzeTranscript(transcript, prisma);
          processed++;
          if (onProgress) {
            onProgress(processed, transcripts.length);
          }
          return result;
        } catch (error) {
          if (attempt === retryAttempts) {
            errors.push({
              vendorCallKey: transcript.vendor_call_key,
              error: error.message
            });
            return null;
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
      }
    });

    const chunkResults = await Promise.all(promises);
    results.push(...chunkResults.filter(r => r !== null));

    // Small delay between chunks to avoid rate limits
    if (i + maxConcurrent < transcripts.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return { results, errors };
}
