import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

interface Message {
  role: 'agent' | 'customer';
  text: string;
}

interface CallMetadata {
  agentName?: string;
  department?: string;
  durationSeconds?: number;
  callStart?: string;
}

// Comprehensive call analysis response structure
export interface CallAnalysis {
  // Overall Scores (1-5 scale)
  overallScores: {
    customerSatisfaction: number;
    resolutionConfidence: number;
    agentProfessionalism: number;
    empathyConnection: number;
    communicationClarity: number;
    overallCallImpact: number;
  };

  // Executive Summary
  executiveSummary: {
    overview: string;
    reasonForContact: string;
    mainActions: string;
    resolutionOutcome: string;
    emotionalTrajectory: string;
  };

  // Key Interaction Points
  keyInteractionPoints: string[];

  // Follow-up Items
  followUpItems: Array<{
    party: 'Agent' | 'Customer' | 'Back Office';
    action: string;
    context: string;
    deadline: string;
  }>;

  // Sentiment Progression
  sentimentProgression: {
    customer: {
      start: { tone: string; score: number };
      mid: { tone: string; score: number };
      end: { tone: string; score: number };
    };
    agent: {
      start: { tone: string; score: number };
      mid: { tone: string; score: number };
      end: { tone: string; score: number };
    };
  };

  // Communication Quality (1-5 each)
  communicationQuality: {
    customer: {
      clarity: number;
      empathy: number;
      activeListening: number;
      respectfulness: number;
      emotionalRegulation: number;
      responsiveness: number;
    };
    agent: {
      clarity: number;
      empathy: number;
      activeListening: number;
      respectfulness: number;
      emotionalRegulation: number;
      responsiveness: number;
    };
  };

  // Behavioral Summaries
  agentSummary: {
    toneProfessionalism: string;
    problemSolving: string;
    empathyConnection: string;
    deEscalation: string;
    closure: string;
  };

  customerSummary: {
    initialDisposition: string;
    engagementCooperation: string;
    toneEvolution: string;
    satisfactionLevel: string;
  };

  // Insights
  insights: {
    relationalFlow: string;
    conflictRecovery: string;
    psychologicalCommentary: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { messages, metadata, sentimentContext } = await request.json() as {
      messages: Message[];
      metadata?: CallMetadata;
      sentimentContext?: string;
    };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 500 });
    }

    // Fetch processed transcript statistics for context and consistency
    let processedDataContext = '';
    try {
      // Get aggregate statistics from processed transcripts
      const [
        totalProcessed,
        sentimentStats,
        topTopics,
        agentStats,
        departmentStats
      ] = await Promise.all([
        // Total processed transcripts
        prisma.transcriptAnalysis.count(),

        // Sentiment distribution
        prisma.transcriptAnalysis.groupBy({
          by: ['agentSentiment', 'customerSentiment'],
          _count: true,
        }),

        // Top discovered topics
        prisma.transcriptAnalysis.groupBy({
          by: ['aiDiscoveredTopic', 'aiDiscoveredSubcategory'],
          _count: true,
          where: {
            aiDiscoveredTopic: { not: null },
          },
          orderBy: {
            _count: {
              aiDiscoveredTopic: 'desc',
            },
          },
          take: 10,
        }),

        // Agent-specific stats if we have agent name
        metadata?.agentName ? prisma.transcriptAnalysis.groupBy({
          by: ['agentSentiment', 'customerSentiment'],
          _count: true,
          where: {
            agentName: { contains: metadata.agentName, mode: 'insensitive' },
          },
        }) : Promise.resolve([]),

        // Department-specific stats if we have department
        metadata?.department ? prisma.$queryRaw`
          SELECT
            ta."agentSentiment",
            ta."customerSentiment",
            COUNT(*) as count
          FROM "TranscriptAnalysis" ta
          INNER JOIN transcripts t ON ta."vendorCallKey" = t.vendor_call_key
          WHERE t.department ILIKE ${'%' + metadata.department + '%'}
          GROUP BY ta."agentSentiment", ta."customerSentiment"
        ` as Promise<any[]> : Promise.resolve([]),
      ]);

      // Build context from processed data
      const agentSentimentCounts = sentimentStats.reduce((acc, stat) => {
        acc[stat.agentSentiment || 'unknown'] = (acc[stat.agentSentiment || 'unknown'] || 0) + stat._count;
        return acc;
      }, {} as Record<string, number>);

      const customerSentimentCounts = sentimentStats.reduce((acc, stat) => {
        acc[stat.customerSentiment || 'unknown'] = (acc[stat.customerSentiment || 'unknown'] || 0) + stat._count;
        return acc;
      }, {} as Record<string, number>);

      processedDataContext = `
PROCESSED TRANSCRIPT DATA FOR CONSISTENCY:
We have analyzed ${totalProcessed.toLocaleString()} previous transcripts. Use these patterns as a guide for consistent scoring:

Overall Sentiment Patterns:
- Agent Sentiment: ${Object.entries(agentSentimentCounts).map(([k, v]) => `${k}: ${v} (${((v / totalProcessed) * 100).toFixed(1)}%)`).join(', ')}
- Customer Sentiment: ${Object.entries(customerSentimentCounts).map(([k, v]) => `${k}: ${v} (${((v / totalProcessed) * 100).toFixed(1)}%)`).join(', ')}

Common Topics Discovered:
${topTopics.slice(0, 5).map((t, i) => `${i + 1}. ${t.aiDiscoveredTopic}${t.aiDiscoveredSubcategory ? ` → ${t.aiDiscoveredSubcategory}` : ''}: ${t._count} calls`).join('\n')}
${metadata?.agentName && agentStats.length > 0 ? `
This Agent's Performance Pattern (${metadata.agentName}):
- Agent Sentiment: ${agentStats.map((s: any) => `${s.agentSentiment}: ${s._count}`).join(', ')}
- Customer Outcomes: ${agentStats.map((s: any) => `${s.customerSentiment}: ${s._count}`).join(', ')}
` : ''}
${metadata?.department && departmentStats.length > 0 ? `
This Department's Pattern (${metadata.department}):
- Typical Sentiment Distribution: ${departmentStats.map((s: any) => `Customer ${s.customerSentiment}: ${s.count}`).join(', ')}
` : ''}

SCORING CONSISTENCY GUIDANCE:
- Compare your scores to these historical patterns
- If this call seems significantly different from patterns, that's valuable to note
- Maintain consistency: similar interactions should receive similar scores across the ${totalProcessed.toLocaleString()} call dataset
`;
    } catch (error) {
      console.warn('Failed to fetch processed data context:', error);
      // Continue without context if database query fails
    }

    // Build the conversation text with clear role labels
    const conversationText = messages
      .map((msg: Message, idx: number) => `[${idx + 1}] ${msg.role.toUpperCase()}: ${msg.text}`)
      .join('\n\n');

    // Build metadata context
    const metadataContext = metadata
      ? `Call Metadata:
- Agent: ${metadata.agentName || 'Unknown'}
- Department: ${metadata.department || 'Unknown'}
- Duration: ${metadata.durationSeconds ? Math.floor(metadata.durationSeconds / 60) + ' minutes' : 'Unknown'}
- Date: ${metadata.callStart || 'Unknown'}

`
      : '';

    const systemPrompt = `You are an expert in conversation analysis, customer psychology, and service quality evaluation for mortgage customer service calls.

Analyze this customer service interaction and provide a comprehensive, executive-ready assessment.
${processedDataContext}
IMPORTANT: Return your analysis as a valid JSON object matching this exact structure. No markdown, no code blocks, just pure JSON:

{
  "overallScores": {
    "customerSatisfaction": <1-5>,
    "resolutionConfidence": <1-5>,
    "agentProfessionalism": <1-5>,
    "empathyConnection": <1-5>,
    "communicationClarity": <1-5>,
    "overallCallImpact": <1-5>
  },
  "executiveSummary": {
    "overview": "<3-4 sentence executive overview>",
    "reasonForContact": "<customer's goal or issue>",
    "mainActions": "<main actions taken by agent>",
    "resolutionOutcome": "<resolution status>",
    "emotionalTrajectory": "<how tone evolved>"
  },
  "keyInteractionPoints": [
    "<point 1>",
    "<point 2>",
    "..."
  ],
  "followUpItems": [
    {"party": "Agent|Customer|Back Office", "action": "<action>", "context": "<context>", "deadline": "<deadline>"}
  ],
  "sentimentProgression": {
    "customer": {
      "start": {"tone": "<emotional tone>", "score": <1-5>},
      "mid": {"tone": "<emotional tone>", "score": <1-5>},
      "end": {"tone": "<emotional tone>", "score": <1-5>}
    },
    "agent": {
      "start": {"tone": "<emotional tone>", "score": <1-5>},
      "mid": {"tone": "<emotional tone>", "score": <1-5>},
      "end": {"tone": "<emotional tone>", "score": <1-5>}
    }
  },
  "communicationQuality": {
    "customer": {
      "clarity": <1-5>,
      "empathy": <1-5>,
      "activeListening": <1-5>,
      "respectfulness": <1-5>,
      "emotionalRegulation": <1-5>,
      "responsiveness": <1-5>
    },
    "agent": {
      "clarity": <1-5>,
      "empathy": <1-5>,
      "activeListening": <1-5>,
      "respectfulness": <1-5>,
      "emotionalRegulation": <1-5>,
      "responsiveness": <1-5>
    }
  },
  "agentSummary": {
    "toneProfessionalism": "<evaluation>",
    "problemSolving": "<evaluation>",
    "empathyConnection": "<evaluation>",
    "deEscalation": "<evaluation>",
    "closure": "<evaluation>"
  },
  "customerSummary": {
    "initialDisposition": "<description>",
    "engagementCooperation": "<description>",
    "toneEvolution": "<description>",
    "satisfactionLevel": "<description>"
  },
  "insights": {
    "relationalFlow": "<how tone shifted and rapport developed>",
    "conflictRecovery": "<tension points and how managed>",
    "psychologicalCommentary": "<emotional intelligence observations>"
  }
}

SCORING GUIDE (1-5):
5 = Excellent (delight, confidence, trust reinforced)
4 = Good (satisfied, minor friction)
3 = Average (neutral, some confusion or delay)
2 = Poor (frustrated, unresolved or unclear)
1 = Very Poor (negative, escalated, or damaging experience)

Be critical but fair. Mortgage calls are high-stakes - customers are often stressed about their finances.
${sentimentContext || ''}
Return ONLY the JSON object, no other text.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://servicing-ticket-analysis.vercel.app',
        'X-Title': 'Servicing Ticket Analysis - Call Analysis',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet', // Using Sonnet for more complex analysis
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `${metadataContext}Analyze this customer service call transcript:\n\n${conversationText}`,
          },
        ],
        max_tokens: 4000,
        temperature: 0.1, // Low temperature for consistent structured output
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenRouter API error:', errorData);
      return NextResponse.json({ error: 'Call analysis failed' }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';

    // Parse the JSON response
    try {
      let jsonStr = content.trim();

      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      }
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }

      // Extract JSON object from response
      const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonStr = objectMatch[0];
      }

      jsonStr = jsonStr.trim();

      const analysis = JSON.parse(jsonStr) as CallAnalysis;
      return NextResponse.json({ analysis });
    } catch (parseError) {
      console.error('Failed to parse call analysis response:', content);
      return NextResponse.json({
        error: 'Failed to parse analysis',
        rawContent: content
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in call analysis:', error);
    return NextResponse.json({ error: 'Call analysis failed' }, { status: 500 });
  }
}
