/**
 * PHASE 1: Transcript Analysis Utilities
 *
 * Advanced analysis functions for call transcripts including:
 * - Speaker turn counting
 * - Resolution detection
 * - Sentiment analysis
 * - Quality assessment
 * - Escalation detection
 */

export interface ConversationMessage {
  role: 'agent' | 'customer';
  text: string;
  timestamp?: string;
}

export interface TranscriptAnalysisResult {
  // Speaker metrics
  agentTurns: number;
  customerTurns: number;
  totalMessages: number;
  agentMessages: number;
  customerMessages: number;

  // Resolution detection
  resolutionStatus: 'Resolved' | 'Escalated' | 'Follow-up Required' | 'Unknown';
  wasResolved: boolean;
  wasEscalated: boolean;
  requiresFollowup: boolean;
  escalationReason?: string;

  // Sentiment
  overallSentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  sentimentScore: number; // -1.0 to 1.0
  customerSentiment: 'positive' | 'negative' | 'neutral';
  customerSentimentScore: number;

  // Quality
  transcriptQuality: 'high' | 'medium' | 'low';
  callQualityScore: number; // 0-100

  // Intent
  customerIntent: string;

  // Topics (enhanced in Phase 4)
  detectedTopics: string[];
  primaryTopic: string;
  topicScores?: { [topic: string]: number };

  // PHASE 4: Named Entity Recognition
  extractedEntities?: {
    loanNumbers: string[];
    customerNames: string[];
    emailAddresses: string[];
    phoneNumbers: string[];
    addresses: string[];
    dates: string[];
    amounts: string[];
  };

  // PHASE 4: Self-service opportunities
  selfServiceOpportunity?: {
    hasSelfServiceOpportunity: boolean;
    opportunities: string[];
    automationPotential: 'high' | 'medium' | 'low';
  };
}

/**
 * Normalize speaker labels in transcript text
 */
export function normalizeSpeakerLabels(text: string): string {
  let normalized = text;

  // Normalize various agent labels
  normalized = normalized.replace(/\brep:/gi, 'agent:');
  normalized = normalized.replace(/\brepresentative:/gi, 'agent:');
  normalized = normalized.replace(/\bagent\s+\d+:/gi, 'agent:');
  normalized = normalized.replace(/\b[a-z]+\s+\(agent\):/gi, 'agent:');

  // Normalize customer labels
  normalized = normalized.replace(/\bcaller:/gi, 'customer:');
  normalized = normalized.replace(/\bclient:/gi, 'customer:');
  normalized = normalized.replace(/\buser:/gi, 'customer:');

  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Parse conversation into structured messages
 */
export function parseConversation(transcriptText: string): ConversationMessage[] {
  const normalized = normalizeSpeakerLabels(transcriptText);
  const messages: ConversationMessage[] = [];

  // Split by speaker labels
  const parts = normalized.split(/\b(agent:|customer:)/gi);

  let currentRole: 'agent' | 'customer' | null = null;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim().toLowerCase();

    if (part === 'agent:') {
      currentRole = 'agent';
    } else if (part === 'customer:') {
      currentRole = 'customer';
    } else if (currentRole && part.length > 0) {
      messages.push({
        role: currentRole,
        text: parts[i].trim(), // Use original case
      });
    }
  }

  return messages;
}

/**
 * Count speaker turns and messages
 */
export function countSpeakerTurns(transcriptText: string): {
  agentTurns: number;
  customerTurns: number;
  agentMessages: number;
  customerMessages: number;
  totalMessages: number;
} {
  const normalized = normalizeSpeakerLabels(transcriptText).toLowerCase();

  const agentTurns = (normalized.match(/agent:/g) || []).length;
  const customerTurns = (normalized.match(/customer:/g) || []).length;

  return {
    agentTurns,
    customerTurns,
    agentMessages: agentTurns,
    customerMessages: customerTurns,
    totalMessages: agentTurns + customerTurns,
  };
}

/**
 * Detect resolution status from transcript
 */
export function detectResolutionStatus(transcriptText: string): {
  resolutionStatus: 'Resolved' | 'Escalated' | 'Follow-up Required' | 'Unknown';
  wasResolved: boolean;
  wasEscalated: boolean;
  requiresFollowup: boolean;
  escalationReason?: string;
} {
  const text = transcriptText.toLowerCase();

  // Check for escalation indicators
  const escalationPatterns = [
    'need to escalate',
    'transfer to supervisor',
    'speak to a manager',
    'talk to supervisor',
    'escalate this',
    'transfer to manager',
    'speak with supervisor',
    'i want to speak to',
    'let me talk to',
    'get me a supervisor',
  ];

  const hasEscalation = escalationPatterns.some(pattern => text.includes(pattern));

  if (hasEscalation) {
    // Determine escalation reason
    let reason = 'Customer requested escalation';
    if (text.includes('supervisor') || text.includes('manager')) {
      reason = 'Requested supervisor/manager';
    }

    return {
      resolutionStatus: 'Escalated',
      wasResolved: false,
      wasEscalated: true,
      requiresFollowup: true,
      escalationReason: reason,
    };
  }

  // Check for resolution indicators
  const resolutionPatterns = [
    'resolved',
    'all set',
    'that should do it',
    'you\'re all set',
    'is there anything else',
    'have i answered',
    'glad i could help',
    'problem solved',
    'issue resolved',
    'that takes care of',
    'you should be good',
    'everything is set',
  ];

  const hasResolution = resolutionPatterns.some(pattern => text.includes(pattern));

  if (hasResolution) {
    return {
      resolutionStatus: 'Resolved',
      wasResolved: true,
      wasEscalated: false,
      requiresFollowup: false,
    };
  }

  // Check for follow-up indicators
  const followupPatterns = [
    'call you back',
    'research this',
    'check and email',
    'need to investigate',
    'get back to you',
    'follow up',
    'look into this',
    'i\'ll check on',
    'let me find out',
    'need to verify',
  ];

  const hasFollowup = followupPatterns.some(pattern => text.includes(pattern));

  if (hasFollowup) {
    return {
      resolutionStatus: 'Follow-up Required',
      wasResolved: false,
      wasEscalated: false,
      requiresFollowup: true,
    };
  }

  // Default: Unknown
  return {
    resolutionStatus: 'Unknown',
    wasResolved: false,
    wasEscalated: false,
    requiresFollowup: false,
  };
}

/**
 * Simple sentiment analysis using keyword matching
 * Returns score from -1.0 (very negative) to 1.0 (very positive)
 */
export function analyzeSentiment(text: string): {
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  score: number;
} {
  const lowerText = text.toLowerCase();

  // Positive indicators
  const positiveKeywords = [
    'thank',
    'thanks',
    'appreciate',
    'helpful',
    'great',
    'excellent',
    'wonderful',
    'perfect',
    'good',
    'happy',
    'satisfied',
    'pleased',
    'awesome',
  ];

  // Negative indicators
  const negativeKeywords = [
    'frustrated',
    'angry',
    'upset',
    'terrible',
    'awful',
    'horrible',
    'worst',
    'unacceptable',
    'ridiculous',
    'disappointed',
    'dissatisfied',
    'complaint',
    'furious',
    'outraged',
  ];

  let positiveCount = 0;
  let negativeCount = 0;

  for (const keyword of positiveKeywords) {
    const matches = lowerText.match(new RegExp(keyword, 'g'));
    if (matches) positiveCount += matches.length;
  }

  for (const keyword of negativeKeywords) {
    const matches = lowerText.match(new RegExp(keyword, 'g'));
    if (matches) negativeCount += matches.length * 1.5; // Weight negative words more heavily
  }

  const totalWords = text.split(/\s+/).length;
  const sentimentDensity = (positiveCount - negativeCount) / Math.max(totalWords / 50, 1);

  // Calculate score
  let score = Math.max(-1, Math.min(1, sentimentDensity));

  // Determine sentiment label
  let sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  if (score > 0.2) {
    sentiment = 'positive';
  } else if (score < -0.2) {
    sentiment = 'negative';
  } else if (positiveCount > 0 && negativeCount > 0) {
    sentiment = 'mixed';
  } else {
    sentiment = 'neutral';
  }

  return { sentiment, score };
}

/**
 * Analyze customer sentiment separately from overall transcript
 */
export function analyzeCustomerSentiment(transcriptText: string): {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
} {
  const messages = parseConversation(transcriptText);
  const customerMessages = messages
    .filter(m => m.role === 'customer')
    .map(m => m.text)
    .join(' ');

  if (customerMessages.length === 0) {
    return { sentiment: 'neutral', score: 0 };
  }

  const result = analyzeSentiment(customerMessages);
  return {
    sentiment: result.sentiment === 'mixed' ? 'neutral' : result.sentiment,
    score: result.score,
  };
}

/**
 * Assess transcript quality
 */
export function assessTranscriptQuality(transcriptText: string): {
  quality: 'high' | 'medium' | 'low';
  score: number; // 0-100
  issues: string[];
} {
  const issues: string[] = [];
  let score = 100;

  // Check length
  const words = transcriptText.split(/\s+/);
  if (words.length < 10) {
    issues.push('Very short transcript (< 10 words)');
    score -= 40;
  } else if (words.length < 50) {
    issues.push('Short transcript (< 50 words)');
    score -= 20;
  }

  // Check for speaker labels
  const hasSpeakers = /\b(agent:|customer:)/i.test(transcriptText);
  if (!hasSpeakers) {
    issues.push('Missing speaker labels');
    score -= 30;
  }

  // Check average word length (gibberish detection)
  const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
  if (avgWordLength < 2) {
    issues.push('Very short average word length (possible gibberish)');
    score -= 25;
  } else if (avgWordLength > 15) {
    issues.push('Very long average word length (possible encoding issues)');
    score -= 15;
  }

  // Check for excessive special characters
  const specialCharRatio = (transcriptText.match(/[^a-zA-Z0-9\s:.,!?-]/g) || []).length / transcriptText.length;
  if (specialCharRatio > 0.1) {
    issues.push('Excessive special characters');
    score -= 15;
  }

  // Determine quality rating
  let quality: 'high' | 'medium' | 'low';
  if (score >= 80) {
    quality = 'high';
  } else if (score >= 50) {
    quality = 'medium';
  } else {
    quality = 'low';
  }

  return {
    quality,
    score: Math.max(0, score),
    issues,
  };
}

/**
 * Calculate call quality score based on various metrics
 */
export function calculateCallQualityScore(
  durationSeconds: number | null,
  turnCount: number,
  resolutionStatus: string,
  sentiment: string
): number {
  let score = 50; // Base score

  // Duration score (optimal range: 3-10 minutes)
  if (durationSeconds) {
    const minutes = durationSeconds / 60;
    if (minutes >= 3 && minutes <= 10) {
      score += 20;
    } else if (minutes >= 2 && minutes <= 15) {
      score += 10;
    } else if (minutes < 1) {
      score -= 20; // Too short
    } else if (minutes > 30) {
      score -= 10; // Too long
    }
  }

  // Turn count score (healthy back-and-forth)
  if (turnCount >= 8 && turnCount <= 30) {
    score += 15;
  } else if (turnCount >= 4 && turnCount <= 40) {
    score += 5;
  } else if (turnCount < 4) {
    score -= 10; // Too few exchanges
  }

  // Resolution score
  if (resolutionStatus === 'Resolved') {
    score += 20;
  } else if (resolutionStatus === 'Escalated') {
    score -= 15;
  } else if (resolutionStatus === 'Follow-up Required') {
    score -= 5;
  }

  // Sentiment score
  if (sentiment === 'positive') {
    score += 15;
  } else if (sentiment === 'negative') {
    score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * PHASE 4: Enhanced topic detection with more granular categorization
 */
export function detectTopics(transcriptText: string): {
  topics: string[];
  primaryTopic: string;
  topicScores: { [topic: string]: number };
} {
  const text = transcriptText.toLowerCase();
  const topics: Map<string, number> = new Map();

  const topicKeywords: { [topic: string]: string[] } = {
    // Payment related
    payment: ['payment', 'pay ', 'paying', 'paid'],
    autopay: ['autopay', 'automatic payment', 'recurring payment'],
    payment_failure: ['declined', 'failed payment', 'bounced', 'nsf'],
    first_payment: ['first payment', 'initial payment', 'where do i send'],

    // Escrow related
    escrow: ['escrow', 'impound'],
    escrow_shortage: ['shortage', 'escrow analysis', 'escrow increase'],
    property_tax: ['property tax', 'tax bill', 'taxes'],
    insurance: ['insurance', 'homeowner insurance', 'hazard insurance'],

    // Account access
    login: ['login', 'log in', 'sign in'],
    password: ['password', 'reset password', 'forgot password'],
    locked_account: ['locked', 'locked out', 'account locked'],

    // Loan transfer
    transfer: ['transfer', 'sold my loan', 'new servicer'],
    boarding: ['boarding', 'on-boarding', 'welcome letter'],
    subservicer: ['servicemac', 'cenlar', 'lakeview', 'subservicer'],

    // Documentation
    payoff: ['payoff', 'payoff quote', 'payoff statement'],
    statement: ['statement', 'mortgage statement', 'billing statement'],
    tax_documents: ['1098', 'tax form', 'tax document'],
    closing_documents: ['closing', 'final bill', 'satisfaction'],

    // Loan information
    balance: ['balance', 'how much do i owe', 'amount due'],
    interest_rate: ['interest rate', 'rate', 'apr'],
    loan_details: ['loan number', 'loan information', 'loan terms'],

    // Modifications
    modification: ['modification', 'loan mod'],
    forbearance: ['forbearance', 'payment relief', 'skip payment'],
    hardship: ['hardship', 'financial difficulty', 'cant pay'],

    // Issues & escalations
    complaint: ['complaint', 'file a complaint', 'better business bureau'],
    escalation: ['supervisor', 'manager', 'escalate'],
    legal: ['attorney', 'lawyer', 'legal'],

    // Self-service opportunities
    online_portal: ['website', 'online', 'portal', 'app'],
    voice_preference: ['call preference', 'do not call', 'text message'],
  };

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    let count = 0;
    for (const keyword of keywords) {
      const matches = text.match(new RegExp(keyword, 'g'));
      if (matches) count += matches.length;
    }
    if (count > 0) {
      topics.set(topic, count);
    }
  }

  const sortedTopics = Array.from(topics.entries()).sort((a, b) => b[1] - a[1]);
  const topicList = sortedTopics.map(([topic]) => topic);
  const topicScores = Object.fromEntries(topics.entries());

  return {
    topics: topicList,
    primaryTopic: topicList[0] || 'general',
    topicScores,
  };
}

/**
 * PHASE 4: Named Entity Recognition - Extract key entities from transcripts
 */
export function extractNamedEntities(transcriptText: string): {
  loanNumbers: string[];
  customerNames: string[];
  emailAddresses: string[];
  phoneNumbers: string[];
  addresses: string[];
  dates: string[];
  amounts: string[];
} {
  // Loan number patterns (common formats in mortgage servicing)
  const loanNumberPatterns = [
    /\b[0-9]{10,12}\b/g, // Standard 10-12 digit loan numbers
    /\b[rR][a-zA-Z]{2}[0-9]{7,10}\b/g, // Format: RXX1234567
    /\bloan\s*#?\s*([0-9]{7,12})\b/gi, // "loan # 1234567"
  ];

  const loanNumbers: Set<string> = new Set();
  for (const pattern of loanNumberPatterns) {
    const matches = transcriptText.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // Clean up and validate
        const cleaned = match.replace(/loan\s*#?\s*/gi, '').trim();
        if (cleaned.length >= 7) {
          loanNumbers.add(cleaned);
        }
      });
    }
  }

  // Customer names (simple pattern: capitalized words)
  const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g;
  const potentialNames = transcriptText.match(namePattern) || [];
  const customerNames: Set<string> = new Set();

  // Filter out common false positives
  const excludeWords = new Set(['Customer', 'Agent', 'Representative', 'Servicing', 'Payment', 'Escrow', 'Loan', 'Account', 'Service', 'Team']);
  potentialNames.forEach(name => {
    const words = name.split(' ');
    if (!words.some(word => excludeWords.has(word))) {
      customerNames.add(name);
    }
  });

  // Email addresses
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emailAddresses = Array.from(new Set(transcriptText.match(emailPattern) || []));

  // Phone numbers (various formats)
  const phonePattern = /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g;
  const phoneNumbers = Array.from(new Set((transcriptText.match(phonePattern) || []).map(p => p.replace(/\D/g, ''))));

  // Dollar amounts
  const amountPattern = /\$\s*([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{2})?)\b/g;
  const amounts = Array.from(new Set(transcriptText.match(amountPattern) || []));

  // Dates (various formats)
  const datePatterns = [
    /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12][0-9]|3[01])[\/\-]([0-9]{2,4})\b/g, // MM/DD/YYYY
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+([0-9]{1,2}),?\s+([0-9]{4})\b/gi, // Month DD, YYYY
  ];

  const dates: Set<string> = new Set();
  for (const pattern of datePatterns) {
    const matches = transcriptText.match(pattern);
    if (matches) {
      matches.forEach(match => dates.add(match));
    }
  }

  // Addresses (simplified - look for street/zip patterns)
  const addressPattern = /\b[0-9]+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Court|Ct)\.?\b/gi;
  const addresses = Array.from(new Set(transcriptText.match(addressPattern) || []));

  return {
    loanNumbers: Array.from(loanNumbers),
    customerNames: Array.from(customerNames).slice(0, 5), // Limit to top 5 most likely
    emailAddresses,
    phoneNumbers,
    addresses,
    dates: Array.from(dates),
    amounts,
  };
}

/**
 * PHASE 4: Self-service opportunity detection
 */
export function detectSelfServiceOpportunities(transcriptText: string): {
  hasSelfServiceOpportunity: boolean;
  opportunities: string[];
  automationPotential: 'high' | 'medium' | 'low';
} {
  const text = transcriptText.toLowerCase();
  const opportunities: string[] = [];

  // High-value self-service patterns
  const selfServiceIndicators = {
    'Online Payment Setup': ['where do i pay', 'how do i pay', 'payment address', 'send payment'],
    'Password Reset': ['reset password', 'forgot password', 'cant log in', 'locked out'],
    'Statement Request': ['need a statement', 'mortgage statement', 'billing statement'],
    'Balance Inquiry': ['how much do i owe', 'current balance', 'payoff amount'],
    'Payment History': ['payment history', 'past payments', 'what i paid'],
    'Account Setup': ['set up account', 'register', 'create account', 'sign up'],
    'AutoPay Enrollment': ['set up autopay', 'automatic payment', 'recurring payment'],
    'Document Download': ['download', 'need a copy', 'send me', 'email me'],
    'Tax Form Access': ['1098', 'tax form', 'tax document'],
    'Payoff Quote': ['payoff quote', 'payoff statement', 'payoff amount'],
  };

  let highValueCount = 0;
  for (const [opportunity, patterns] of Object.entries(selfServiceIndicators)) {
    const hasPattern = patterns.some(pattern => text.includes(pattern));
    if (hasPattern) {
      opportunities.push(opportunity);
      highValueCount++;
    }
  }

  // Determine automation potential
  let automationPotential: 'high' | 'medium' | 'low';
  if (highValueCount >= 3) {
    automationPotential = 'high';
  } else if (highValueCount >= 1) {
    automationPotential = 'medium';
  } else {
    automationPotential = 'low';
  }

  return {
    hasSelfServiceOpportunity: opportunities.length > 0,
    opportunities,
    automationPotential,
  };
}

/**
 * Complete transcript analysis - combines all metrics
 */
export function analyzeTranscript(
  transcriptText: string,
  durationSeconds?: number | null
): TranscriptAnalysisResult {
  const normalized = normalizeSpeakerLabels(transcriptText);

  // Speaker metrics
  const turns = countSpeakerTurns(normalized);

  // Resolution detection
  const resolution = detectResolutionStatus(normalized);

  // Sentiment analysis
  const overallSentiment = analyzeSentiment(normalized);
  const customerSentiment = analyzeCustomerSentiment(normalized);

  // Quality assessment
  const quality = assessTranscriptQuality(normalized);

  // Topic detection (enhanced)
  const topicAnalysis = detectTopics(normalized);

  // PHASE 4: Named entity recognition
  const entities = extractNamedEntities(transcriptText);

  // PHASE 4: Self-service opportunity detection
  const selfService = detectSelfServiceOpportunities(normalized);

  // Call quality score
  const callQualityScore = calculateCallQualityScore(
    durationSeconds || null,
    turns.totalMessages,
    resolution.resolutionStatus,
    overallSentiment.sentiment
  );

  return {
    // Speaker metrics
    agentTurns: turns.agentTurns,
    customerTurns: turns.customerTurns,
    totalMessages: turns.totalMessages,
    agentMessages: turns.agentMessages,
    customerMessages: turns.customerMessages,

    // Resolution
    resolutionStatus: resolution.resolutionStatus,
    wasResolved: resolution.wasResolved,
    wasEscalated: resolution.wasEscalated,
    requiresFollowup: resolution.requiresFollowup,
    escalationReason: resolution.escalationReason,

    // Sentiment
    overallSentiment: overallSentiment.sentiment,
    sentimentScore: overallSentiment.score,
    customerSentiment: customerSentiment.sentiment,
    customerSentimentScore: customerSentiment.score,

    // Quality
    transcriptQuality: quality.quality,
    callQualityScore,

    // Intent (placeholder - will be determined by categorization)
    customerIntent: 'other',

    // Topics (enhanced in Phase 4)
    detectedTopics: topicAnalysis.topics,
    primaryTopic: topicAnalysis.primaryTopic,
    topicScores: topicAnalysis.topicScores,

    // PHASE 4: Named Entity Recognition
    extractedEntities: entities,

    // PHASE 4: Self-service opportunities
    selfServiceOpportunity: selfService,
  };
}
