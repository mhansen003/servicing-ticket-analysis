import { NextRequest, NextResponse } from 'next/server';
import {
  getTicketStats,
  getProjectBreakdown,
  getAssigneeBreakdown,
  getTicketSample,
} from '@/lib/data-loader';

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

    // Gather context data for the AI
    const [stats, projectBreakdown, assigneeBreakdown, ticketSample] = await Promise.all([
      getTicketStats(),
      getProjectBreakdown(),
      getAssigneeBreakdown(),
      getTicketSample(50),
    ]);

    const contextData = `
## Ticket Statistics Overview
- Total Tickets: ${stats.totalTickets.toLocaleString()}
- Completed Tickets: ${stats.completedTickets.toLocaleString()}
- Open Tickets: ${stats.openTickets.toLocaleString()}
- Completion Rate: ${stats.completionRate}%
- Average Response Time: ${stats.avgResponseTimeMinutes} minutes (${Math.round(stats.avgResponseTimeMinutes / 60)} hours)
- Average Resolution Time: ${stats.avgResolutionTimeMinutes} minutes (${Math.round(stats.avgResolutionTimeMinutes / 60)} hours)

## Project Breakdown (Top 10)
${projectBreakdown.map((p) => `- ${p.project}: ${p.total} total, ${p.completed} completed, avg resolution: ${p.avgResolutionHours} hours`).join('\n')}

## Top Assignees (Top 15)
${assigneeBreakdown.map((a) => `- ${a.name}: ${a.total} tickets, ${a.completed} completed, avg resolution: ${a.avgResolutionHours} hours`).join('\n')}

## Sample Tickets (50 recent)
${ticketSample.map((t) => `- [${t.ticket_key}] ${t.ticket_title?.substring(0, 60)}... | ${t.ticket_status} | ${t.project_name}`).join('\n')}
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
            content: `You are a helpful data analyst assistant specializing in helpdesk ticket analysis. You have access to the following data about servicing helpdesk tickets. Provide insightful, actionable analysis based on the user's questions.

${contextData}

When analyzing, focus on:
1. Identifying patterns and trends
2. Highlighting potential issues or bottlenecks
3. Suggesting actionable improvements
4. Being specific with numbers and percentages

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
