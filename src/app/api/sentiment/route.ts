import { NextRequest, NextResponse } from 'next/server';

interface Message {
  role: 'agent' | 'customer';
  text: string;
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 500 });
    }

    // Build the conversation text with message indices
    const conversationText = messages
      .map((msg: Message, idx: number) => `[${idx}] ${msg.role.toUpperCase()}: ${msg.text}`)
      .join('\n\n');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://servicing-ticket-analysis.vercel.app',
        'X-Title': 'Servicing Ticket Analysis - Sentiment',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku',
        messages: [
          {
            role: 'system',
            content: `You are a sentiment analyzer for customer service conversations. For each message in the conversation, analyze the emotional tone and sentiment.

Return a JSON array with one object per message, in order. Each object should have:
- "score": A number from -1 (very negative/angry) to 1 (very positive/happy). 0 is neutral.
- "emotion": The primary emotion (e.g., "frustrated", "grateful", "neutral", "confused", "angry", "relieved", "satisfied", "annoyed")

Focus on customer messages more than agent messages. Look for:
- Frustration signals: complaints, repeated issues, waiting, escalation requests
- Positive signals: thanks, appreciation, resolution acknowledgment
- Intensity: ALL CAPS, exclamation marks, strong language

Return ONLY valid JSON array, no other text. Example:
[{"score": 0.2, "emotion": "neutral"}, {"score": -0.6, "emotion": "frustrated"}, ...]`,
          },
          {
            role: 'user',
            content: `Analyze the sentiment of each message in this customer service conversation:\n\n${conversationText}`,
          },
        ],
        max_tokens: 2000,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenRouter API error:', errorData);
      return NextResponse.json({ error: 'Sentiment analysis failed' }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';

    // Parse the JSON response
    try {
      // Clean up the response - sometimes models add markdown code blocks
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      }
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      const sentiments = JSON.parse(jsonStr);
      return NextResponse.json({ sentiments });
    } catch (parseError) {
      console.error('Failed to parse sentiment response:', content);
      // Return neutral sentiments as fallback
      const fallback = messages.map(() => ({ score: 0, emotion: 'neutral' }));
      return NextResponse.json({ sentiments: fallback });
    }
  } catch (error) {
    console.error('Error in sentiment analysis:', error);
    return NextResponse.json({ error: 'Sentiment analysis failed' }, { status: 500 });
  }
}
