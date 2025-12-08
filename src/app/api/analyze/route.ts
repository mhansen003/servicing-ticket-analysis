import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

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

    // Load transcript statistics and sample data
    const publicDir = path.join(process.cwd(), 'public', 'data');

    const [statsData, transcriptsData] = await Promise.all([
      fs.readFile(path.join(publicDir, 'transcript-stats.json'), 'utf-8'),
      fs.readFile(path.join(publicDir, 'transcript-analysis.json'), 'utf-8'),
    ]);

    const stats = JSON.parse(statsData);
    const allTranscripts = JSON.parse(transcriptsData);

    // Get sample of recent transcripts
    const sampleTranscripts = allTranscripts.slice(0, 50);

    // Calculate key metrics
    const totalCalls = stats.totalCalls;
    const sentimentBreakdown = stats.sentimentDistribution;
    const topDepartments = Object.entries(stats.byDepartment)
      .filter(([name]) => name !== 'NULL')
      .sort(([, a]: any, [, b]: any) => b.count - a.count)
      .slice(0, 10);
    const topAgents = Object.entries(stats.byAgent)
      .sort(([, a]: any, [, b]: any) => b.count - a.count)
      .slice(0, 15);

    const contextData = `
## Call Transcript Statistics Overview
- Total Calls: ${totalCalls.toLocaleString()}
- Average Call Duration: ${Math.floor(stats.avgDuration / 60)}m ${stats.avgDuration % 60}s
- Average Hold Time: ${Math.floor(stats.avgHoldTime / 60)}m ${stats.avgHoldTime % 60}s
- Average Messages Per Call: ${stats.avgMessagesPerCall}

## Sentiment Distribution
- Positive: ${sentimentBreakdown.positive} calls (${((sentimentBreakdown.positive / totalCalls) * 100).toFixed(1)}%)
- Negative: ${sentimentBreakdown.negative} calls (${((sentimentBreakdown.negative / totalCalls) * 100).toFixed(1)}%)
- Neutral: ${sentimentBreakdown.neutral} calls (${((sentimentBreakdown.neutral / totalCalls) * 100).toFixed(1)}%)
- Mixed: ${sentimentBreakdown.mixed} calls (${((sentimentBreakdown.mixed / totalCalls) * 100).toFixed(1)}%)

## Top Departments by Call Volume
${topDepartments.map(([name, data]: [string, any]) => `- ${name.replace('SRVC - ', '').replace('SRVC/', '')}: ${data.count} calls, ${((data.positive / data.count) * 100).toFixed(1)}% positive`).join('\n')}

## Top Agents by Call Volume (20+ calls minimum for ranking)
${topAgents.filter(([, data]: any) => data.count >= 20).map(([name, data]: [string, any]) => `- ${name}: ${data.count} calls, avg performance: ${data.avgPerformance?.toFixed(1) || 'N/A'}`).join('\n')}

## Top Call Topics
${Object.entries(stats.topicDistribution).sort(([, a]: any, [, b]: any) => b - a).slice(0, 10).map(([topic, count]) => `- ${topic}: ${count} calls`).join('\n')}

## Sample Recent Calls
${sampleTranscripts.map((t: any) => `- ${t.vendorCallKey} | ${t.agentName} | ${t.basicSentiment} | ${Math.floor(t.durationSeconds / 60)}m ${t.messageCount} msgs | ${t.aiAnalysis?.summary?.substring(0, 80) || 'No summary'}...`).join('\n')}
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
