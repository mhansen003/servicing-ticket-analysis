import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 500 });
    }

    // Load transcript statistics from database instead of static files
    const [
      totalCalls,
      sentimentStats,
      topTopics,
      topAgents,
      topDepartments,
      sampleTranscripts,
      avgMetrics
    ] = await Promise.all([
      // Total calls
      prisma.transcripts.count(),

      // Sentiment distribution
      prisma.transcriptAnalysis.groupBy({
        by: ['customerSentiment'],
        _count: true,
      }),

      // Top topics
      prisma.transcriptAnalysis.groupBy({
        by: ['aiDiscoveredTopic', 'aiDiscoveredSubcategory'],
        _count: true,
        where: { aiDiscoveredTopic: { not: null } },
        orderBy: { _count: { aiDiscoveredTopic: 'desc' } },
        take: 10,
      }),

      // Top agents
      prisma.transcriptAnalysis.groupBy({
        by: ['agentName'],
        _count: true,
        where: { agentName: { not: null } },
        orderBy: { _count: { agentName: 'desc' } },
        take: 15,
      }),

      // Top departments
      prisma.$queryRaw`
        SELECT
          t.department,
          COUNT(*) as count,
          SUM(CASE WHEN ta."customerSentiment" = 'positive' THEN 1 ELSE 0 END) as positive,
          SUM(CASE WHEN ta."customerSentiment" = 'negative' THEN 1 ELSE 0 END) as negative
        FROM transcripts t
        INNER JOIN "TranscriptAnalysis" ta ON t.vendor_call_key = ta."vendorCallKey"
        WHERE t.department IS NOT NULL AND t.department != ''
        GROUP BY t.department
        ORDER BY count DESC
        LIMIT 10
      ` as Promise<any[]>,

      // Sample recent transcripts with analysis
      prisma.transcripts.findMany({
        take: 50,
        include: {
          TranscriptAnalysis: {
            take: 1,
          },
        },
        orderBy: {
          call_start: 'desc',
        },
      }),

      // Average metrics
      prisma.transcripts.aggregate({
        _avg: {
          duration_seconds: true,
        },
      }),
    ]);

    // Calculate sentiment breakdown
    const sentimentBreakdown = sentimentStats.reduce((acc, stat) => {
      acc[stat.customerSentiment || 'unknown'] = stat._count;
      return acc;
    }, {} as Record<string, number>);

    const avgDuration = avgMetrics._avg.duration_seconds || 0;

    const contextData = `
## Call Transcript Statistics Overview
- Total Calls: ${totalCalls.toLocaleString()}
- Average Call Duration: ${Math.floor(avgDuration / 60)}m ${avgDuration % 60}s

## Sentiment Distribution (from ${sentimentStats.reduce((sum, s) => sum + s._count, 0).toLocaleString()} analyzed calls)
${Object.entries(sentimentBreakdown).map(([sentiment, count]) => `- ${sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}: ${count} calls (${((count / totalCalls) * 100).toFixed(1)}%)`).join('\n')}

## Top Departments by Call Volume
${topDepartments.map((dept: any) => {
  const posRate = dept.count > 0 ? ((dept.positive / dept.count) * 100).toFixed(1) : '0.0';
  return `- ${dept.department.replace('SRVC - ', '').replace('SRVC/', '')}: ${dept.count} calls, ${posRate}% positive`;
}).join('\n')}

## Top Agents by Call Volume
${topAgents.filter(agent => agent._count >= 20).map((agent: any) => `- ${agent.agentName}: ${agent._count} calls`).join('\n')}

## Top Call Topics (AI-Discovered from Processed Transcripts)
${topTopics.map((topic: any, i: number) => `${i + 1}. ${topic.aiDiscoveredTopic}${topic.aiDiscoveredSubcategory ? ` → ${topic.aiDiscoveredSubcategory}` : ''}: ${topic._count} calls`).join('\n')}

## Sample Recent Calls
${sampleTranscripts.map((t: any) => {
  const analysis = t.TranscriptAnalysis?.[0];
  const duration = t.duration_seconds || 0;
  const sentiment = analysis?.customerSentiment || 'unknown';
  const topic = analysis?.aiDiscoveredTopic || 'Not analyzed';
  return `- ${t.vendor_call_key} | ${t.agent_name || 'Unknown'} | ${sentiment} | ${Math.floor(duration / 60)}m | Topic: ${topic}`;
}).join('\n')}
`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://servicing-ticket-analysis.vercel.app',
        'X-Title': 'Servicing Ticket Analysis',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          {
            role: 'system',
            content: `You are a helpful data analyst assistant specializing in call center transcript analysis. You have access to the following data about customer service call transcripts. Provide insightful, actionable analysis based on the user's questions.

${contextData}

When analyzing, focus on:
1. Identifying patterns in call sentiment and customer satisfaction
2. Highlighting agent performance trends and coaching opportunities
3. Spotting common customer issues and pain points
4. Suggesting actionable improvements for call quality and customer experience
5. Being specific with numbers, percentages, and metrics

Keep your responses concise but informative. Use bullet points and formatting for clarity.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenRouter API error:', errorData);
      return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 });
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || 'No analysis generated';

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('Error in analyze:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
