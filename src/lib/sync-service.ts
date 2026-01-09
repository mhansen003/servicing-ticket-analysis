/**
 * Sync Service - Daily DOMO Delta Sync Logic
 *
 * This module contains the core sync logic that can be called from:
 * - Cron jobs (serverless)
 * - API endpoints
 * - Scripts
 */

import prisma from '@/lib/db';

// Types for DOMO records
interface DomoRecord {
  VendorCallKey: string;
  CallStartDateTime: string;
  CallEndDateTime?: string;
  CallDurationInSeconds?: string | number;
  CallDispositionServicing?: string;
  NumberOfHolds?: string | number;
  CustomerHoldDuration?: string | number;
  Department?: string;
  VoiceCallStatus?: string;
  Name?: string;
  UserRoleName?: string;
  ProfileName?: string;
  Email?: string;
  Conversation?: string | any;
}

interface SyncStats {
  fetched: number;
  imported: number;
  analyzed: number;
  skipped: number;
  errors: number;
  startTime: number;
  syncStartDate: string | null;
  syncEndDate: string | null;
}

// BASELINE CUTOFF: Never sync data before this date
const BASELINE_DATE = '2025-12-01';

/**
 * Decode HTML entities in text
 */
function decodeHtmlEntities(text: string | null | undefined): string | null | undefined {
  if (!text) return text;
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

/**
 * Transform Domo record to match our transcripts schema
 */
function transformDomoRecord(domoRecord: DomoRecord) {
  // Parse Conversation JSON
  let messages = null;
  const conversationStr = domoRecord.Conversation;
  if (conversationStr) {
    try {
      const conversation = typeof conversationStr === 'string' ? JSON.parse(conversationStr) : conversationStr;
      if (conversation.conversationEntries && Array.isArray(conversation.conversationEntries)) {
        messages = conversation.conversationEntries.map((entry: any) => ({
          speaker: entry.sender?.role === 'Agent' ? 'agent' : 'customer',
          text: decodeHtmlEntities(entry.messageText || ''),
          timestamp: entry.clientTimestamp || entry.serverReceivedTimestamp || null
        }));
      }
    } catch (e) {
      console.warn(`⚠️  Failed to parse conversation for ${domoRecord.VendorCallKey}`);
    }
  }

  // Parse dates
  const parseDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  };

  // Parse integers
  const parseInt = (val: string | number | null | undefined) => {
    if (val === null || val === undefined || val === '') return null;
    const n = Number(val);
    return isNaN(n) ? null : Math.round(n);
  };

  return {
    vendor_call_key: domoRecord.VendorCallKey,
    call_start: parseDate(domoRecord.CallStartDateTime),
    call_end: parseDate(domoRecord.CallEndDateTime),
    duration_seconds: parseInt(domoRecord.CallDurationInSeconds),
    disposition: domoRecord.CallDispositionServicing || null,
    number_of_holds: parseInt(domoRecord.NumberOfHolds),
    hold_duration: parseInt(domoRecord.CustomerHoldDuration),
    department: domoRecord.Department || null,
    status: domoRecord.VoiceCallStatus || null,
    agent_name: domoRecord.Name || null,
    agent_role: domoRecord.UserRoleName || null,
    agent_profile: domoRecord.ProfileName || null,
    agent_email: domoRecord.Email || null,
    messages: messages
  };
}

/**
 * Get the most recent transcript date from the database
 */
async function getLastSyncDate(): Promise<string> {
  console.log('📅 Determining sync start date...');

  const mostRecent = await prisma.transcripts.findFirst({
    orderBy: { call_start: 'desc' },
    select: { call_start: true }
  });

  if (!mostRecent || !mostRecent.call_start) {
    console.log(`   No existing data found. Starting from baseline: ${BASELINE_DATE}`);
    return BASELINE_DATE;
  }

  const lastDate = mostRecent.call_start;
  const baselineDate = new Date(BASELINE_DATE);

  // Use the most recent date, but never go back before baseline
  if (lastDate < baselineDate) {
    console.log(`   Last sync date is before baseline. Starting from: ${BASELINE_DATE}`);
    return BASELINE_DATE;
  }

  // Format as YYYY-MM-DD for DOMO API
  const startDate = lastDate.toISOString().split('T')[0];
  console.log(`   Last transcript: ${startDate}`);
  console.log(`   Syncing delta since: ${startDate}`);
  return startDate;
}

/**
 * Import transcript to database (upsert)
 */
async function importTranscript(transcript: any, stats: SyncStats): Promise<boolean> {
  try {
    await prisma.transcripts.upsert({
      where: { vendor_call_key: transcript.vendor_call_key },
      update: transcript,
      create: transcript
    });
    stats.imported++;
    return true;
  } catch (error) {
    console.error(`❌ Error importing ${transcript.vendor_call_key}:`, (error as Error).message);
    stats.errors++;
    return false;
  }
}

/**
 * Check if transcript is already analyzed
 */
async function isAlreadyAnalyzed(vendorCallKey: string): Promise<boolean> {
  const existing = await prisma.transcriptAnalysis.findUnique({
    where: { vendorCallKey }
  });
  return !!existing;
}

/**
 * Analyze a transcript using OpenRouter API
 */
async function analyzeTranscript(transcript: any): Promise<any> {
  const messages = transcript.messages as any[];
  if (!messages || messages.length === 0) {
    throw new Error('No conversation messages');
  }

  // Build conversation text
  const conversationText = messages
    .map((m: any) => `${m.speaker}: ${m.text}`)
    .join('\n');

  const prompt = `Analyze this customer service call transcript and extract the following information in JSON format:

{
  "agentSentiment": "positive|neutral|negative",
  "agentSentimentScore": 0.0-1.0,
  "agentSentimentReason": "brief explanation",
  "customerSentiment": "positive|neutral|negative",
  "customerSentimentScore": 0.0-1.0,
  "customerSentimentReason": "brief explanation",
  "aiDiscoveredTopic": "main topic",
  "aiDiscoveredSubcategory": "subcategory if applicable",
  "topicConfidence": 0.0-1.0,
  "keyIssues": ["issue1", "issue2"],
  "resolution": "how was it resolved",
  "tags": ["tag1", "tag2"]
}

Transcript:
${conversationText}`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://servicing-tickets.cmgfinancial.ai',
      'X-Title': 'CMG Servicing Tickets'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No content in response');
  }

  return JSON.parse(content);
}

/**
 * Analyze transcripts in batch with concurrency control
 */
async function analyzeTranscriptBatch(
  transcripts: any[],
  maxConcurrent: number = 20,
  onProgress?: (processed: number, total: number) => void
): Promise<{ results: any[]; errors: any[] }> {
  const results: any[] = [];
  const errors: any[] = [];
  let processed = 0;

  // Process in chunks
  for (let i = 0; i < transcripts.length; i += maxConcurrent) {
    const chunk = transcripts.slice(i, i + maxConcurrent);

    const promises = chunk.map(async (transcript) => {
      try {
        const analysis = await analyzeTranscript(transcript);

        // Save to database
        await prisma.transcriptAnalysis.upsert({
          where: { vendorCallKey: transcript.vendor_call_key },
          create: {
            vendorCallKey: transcript.vendor_call_key,
            agentName: transcript.agent_name,
            ...analysis
          },
          update: analysis
        });

        return { success: true, vendorCallKey: transcript.vendor_call_key };
      } catch (error) {
        return {
          success: false,
          vendorCallKey: transcript.vendor_call_key,
          error: (error as Error).message
        };
      }
    });

    const chunkResults = await Promise.all(promises);

    chunkResults.forEach(result => {
      if (result.success) {
        results.push(result);
      } else {
        errors.push(result);
      }
    });

    processed += chunk.length;
    if (onProgress) {
      onProgress(processed, transcripts.length);
    }
  }

  return { results, errors };
}

/**
 * Fetch data from DOMO using their API
 */
async function fetchFromDomo(startDate: string, endDate: string): Promise<DomoRecord[]> {
  // This is a simplified version - you'll need to implement DOMO API client
  // For now, return empty array and implement based on your DOMO API setup
  console.log('⚠️  DOMO API integration needed - implement fetchFromDomo()');
  return [];
}

/**
 * Main sync function - can be called from cron jobs, API endpoints, or scripts
 */
export async function runDailySync(): Promise<SyncStats> {
  const stats: SyncStats = {
    fetched: 0,
    imported: 0,
    analyzed: 0,
    skipped: 0,
    errors: 0,
    startTime: Date.now(),
    syncStartDate: null,
    syncEndDate: null
  };

  try {
    console.log('🔄 Starting daily delta sync...');

    // Step 1: Determine start date
    const startDate = await getLastSyncDate();
    stats.syncStartDate = startDate;

    // End date is today
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    stats.syncEndDate = endDate;

    console.log(`📅 Sync range: ${startDate} to ${endDate}`);

    // Step 2: Fetch from DOMO
    console.log('📥 Fetching from DOMO...');
    const domoRecords = await fetchFromDomo(startDate, endDate);
    stats.fetched = domoRecords.length;
    console.log(`✅ Fetched ${stats.fetched} records`);

    if (stats.fetched === 0) {
      console.log('✨ No new records - database is up to date!');
      return stats;
    }

    // Step 3: Import to database
    console.log('💾 Importing transcripts...');
    for (const domoRecord of domoRecords) {
      if (!domoRecord.VendorCallKey) {
        stats.skipped++;
        continue;
      }

      const transcript = transformDomoRecord(domoRecord);
      await importTranscript(transcript, stats);
    }
    console.log(`✅ Imported ${stats.imported} transcripts`);

    // Step 4: Analyze new transcripts
    console.log('🤖 Running AI analysis...');
    const transcriptsToAnalyze = await prisma.transcripts.findMany({
      where: {
        vendor_call_key: {
          in: domoRecords.map(r => r.VendorCallKey).filter(Boolean)
        }
      }
    });

    // Filter out already analyzed
    const needsAnalysis: any[] = [];
    for (const transcript of transcriptsToAnalyze) {
      if (await isAlreadyAnalyzed(transcript.vendor_call_key)) {
        stats.skipped++;
      } else {
        needsAnalysis.push(transcript);
      }
    }

    if (needsAnalysis.length > 0) {
      const { results, errors } = await analyzeTranscriptBatch(
        needsAnalysis,
        20,
        (processed, total) => {
          if (processed % 50 === 0 || processed === total) {
            console.log(`   Analyzed ${processed}/${total}...`);
          }
        }
      );

      stats.analyzed = results.length;
      stats.errors += errors.length;
    }

    console.log(`✅ Analyzed ${stats.analyzed} transcripts`);

    const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    console.log(`⏱️  Completed in ${elapsed}s`);

    return stats;

  } catch (error) {
    console.error('❌ Sync failed:', error);
    throw error;
  }
}
