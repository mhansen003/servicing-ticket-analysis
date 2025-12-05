import { NextRequest, NextResponse } from 'next/server';

interface AgentStats {
  name: string;
  email?: string;
  department?: string;
  callCount: number;
  avgDuration: number;
  positiveRate: number;
  negativeRate: number;
  neutralRate: number;
  sentimentScore: number;
  recentCalls: Array<{
    id: string;
    date: string;
    duration: number;
    sentiment: string;
    summary?: string;
  }>;
}

export interface AgentProfile {
  // Basic info
  name: string;
  email?: string;
  department?: string;

  // Performance metrics
  metrics: {
    totalCalls: number;
    avgCallDuration: number;
    positiveRate: number;
    negativeRate: number;
    neutralRate: number;
    sentimentScore: number;
    performanceTier: 'top' | 'good' | 'average' | 'needs-improvement' | 'critical';
  };

  // AI-generated insights
  strengths: string[];
  areasForImprovement: string[];
  recommendations: string[];
  overallAssessment: string;

  // Recent calls for context
  recentCalls: Array<{
    id: string;
    date: string;
    duration: number;
    sentiment: string;
    summary?: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const { agentStats } = await request.json() as { agentStats: AgentStats };

    if (!agentStats || !agentStats.name) {
      return NextResponse.json({ error: 'Agent stats required' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 500 });
    }

    // Determine performance tier
    let performanceTier: AgentProfile['metrics']['performanceTier'];
    if (agentStats.sentimentScore >= 30) performanceTier = 'top';
    else if (agentStats.sentimentScore >= 15) performanceTier = 'good';
    else if (agentStats.sentimentScore >= 0) performanceTier = 'average';
    else if (agentStats.sentimentScore >= -30) performanceTier = 'needs-improvement';
    else performanceTier = 'critical';

    // Build context for AI
    const recentCallSummaries = agentStats.recentCalls
      .slice(0, 10)
      .map((c, i) => `${i + 1}. ${c.sentiment} call (${Math.round(c.duration / 60)}min): ${c.summary || 'No summary'}`)
      .join('\n');

    const systemPrompt = `You are an expert customer service coach and performance analyst for a mortgage servicing company.

Analyze this agent's performance data and provide actionable coaching insights.

AGENT DATA:
- Name: ${agentStats.name}
- Department: ${agentStats.department || 'Unknown'}
- Total Calls: ${agentStats.callCount}
- Average Call Duration: ${Math.round(agentStats.avgDuration / 60)} minutes
- Positive Calls: ${agentStats.positiveRate}%
- Negative Calls: ${agentStats.negativeRate}%
- Neutral Calls: ${agentStats.neutralRate}%
- Sentiment Score: ${agentStats.sentimentScore} (range: -100 to +100)
- Performance Tier: ${performanceTier}

RECENT CALL SAMPLES:
${recentCallSummaries || 'No recent call data available'}

Based on this data, provide a coaching profile. Return ONLY valid JSON with this structure:
{
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "areasForImprovement": ["area 1", "area 2"],
  "recommendations": ["specific actionable recommendation 1", "recommendation 2", "recommendation 3"],
  "overallAssessment": "2-3 sentence executive summary of this agent's performance and potential"
}

GUIDELINES:
- For TOP performers: Focus on what makes them excellent and how to maintain/share their skills
- For GOOD performers: Acknowledge success while suggesting refinements
- For AVERAGE performers: Balanced feedback with clear improvement paths
- For NEEDS-IMPROVEMENT: Constructive, specific guidance without being harsh
- For CRITICAL: Urgent but supportive intervention recommendations

Be specific to mortgage customer service (payments, escrow, loan questions, frustrated homeowners).
Focus on actionable, measurable improvements.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://servicing-ticket-analysis.vercel.app',
        'X-Title': 'Servicing Ticket Analysis - Agent Profile',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate the coaching profile for this agent.' },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenRouter API error:', errorData);
      return NextResponse.json({ error: 'Profile analysis failed' }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';

    // Parse AI response
    let aiInsights;
    try {
      let jsonStr = content.trim();
      // Remove markdown code blocks
      if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
      if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
      // Extract JSON object
      const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objectMatch) jsonStr = objectMatch[0];
      aiInsights = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      // Provide fallback insights
      aiInsights = {
        strengths: performanceTier === 'top' || performanceTier === 'good'
          ? ['Maintains professional tone', 'Handles customer inquiries effectively']
          : ['Shows commitment to customer service'],
        areasForImprovement: performanceTier === 'needs-improvement' || performanceTier === 'critical'
          ? ['Customer satisfaction rates need attention', 'Consider additional training on de-escalation']
          : ['Continue developing advanced problem-solving skills'],
        recommendations: [
          'Review call recordings to identify improvement opportunities',
          'Shadow top-performing agents for best practices',
          'Focus on first-call resolution strategies',
        ],
        overallAssessment: `${agentStats.name} has handled ${agentStats.callCount} calls with a ${agentStats.positiveRate}% positive rate. ${performanceTier === 'critical' || performanceTier === 'needs-improvement' ? 'Targeted coaching recommended.' : 'Continue current performance trajectory.'}`,
      };
    }

    // Build complete profile
    const profile: AgentProfile = {
      name: agentStats.name,
      email: agentStats.email,
      department: agentStats.department,
      metrics: {
        totalCalls: agentStats.callCount,
        avgCallDuration: agentStats.avgDuration,
        positiveRate: agentStats.positiveRate,
        negativeRate: agentStats.negativeRate,
        neutralRate: agentStats.neutralRate,
        sentimentScore: agentStats.sentimentScore,
        performanceTier,
      },
      strengths: aiInsights.strengths || [],
      areasForImprovement: aiInsights.areasForImprovement || [],
      recommendations: aiInsights.recommendations || [],
      overallAssessment: aiInsights.overallAssessment || '',
      recentCalls: agentStats.recentCalls,
    };

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Error generating agent profile:', error);
    return NextResponse.json({ error: 'Profile generation failed' }, { status: 500 });
  }
}
