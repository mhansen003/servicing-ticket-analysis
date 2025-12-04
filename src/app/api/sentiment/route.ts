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
            content: `You are a sentiment analyzer for mortgage customer service calls. Be CRITICAL and sensitive to customer dissatisfaction - these are high-stakes financial conversations where even mild frustration matters.

SCORING GUIDELINES (be aggressive, NOT conservative):
- Score from -1.0 (furious) to +1.0 (delighted). Reserve 0 for truly emotionless statements.
- Customers calling about problems START at slightly negative (-0.2) unless they sound happy
- Any complaint, inconvenience, or "I don't like" = at least -0.4
- "Disappointed", "frustrated", "upset" = -0.5 to -0.7
- Sarcasm, passive-aggressive comments = -0.4 to -0.6
- Polite thanks at end of negative call = still negative (-0.2) not positive
- Genuine gratitude, "you've been so helpful" = +0.5 to +0.8

NEGATIVE SIGNALS (score -0.3 to -0.8):
- "I don't like that", "that's frustrating", "I wasn't informed"
- Having to re-enter information, repeat themselves, or call back
- Inconvenience, extra work required, system problems
- "I guess I'll have to...", resigned acceptance = -0.3
- Complaints about company/process/website
- "disappointed", "annoyed", "ridiculous", "unacceptable"

AGENT SCORING:
- Helpful, empathetic agents = +0.3 to +0.5
- Robotic/cold responses = -0.1 to 0
- Defensive or dismissive = -0.3 to -0.5
- Simple acknowledgments like "uh-huh", "yes" = 0

Return JSON array with one object per message:
- "score": number (-1 to 1)
- "emotion": string (frustrated, disappointed, annoyed, resigned, confused, neutral, satisfied, grateful, relieved, helpful, professional, empathetic)

Return ONLY valid JSON array. Example:
[{"score": -0.1, "emotion": "professional"}, {"score": -0.5, "emotion": "frustrated"}, {"score": -0.3, "emotion": "resigned"}]`,
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
      // Clean up the response - sometimes models add markdown code blocks or preamble
      let jsonStr = content.trim();

      // Remove markdown code blocks
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      }
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }

      // Extract JSON array from response - handle preamble text like "Here is the analysis:"
      const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        jsonStr = arrayMatch[0];
      }

      // Fix common JSON syntax errors from AI
      // Fix missing quotes after "score: (should be "score":)
      jsonStr = jsonStr.replace(/"score:\s*/g, '"score": ');
      // Fix missing quotes after "emotion: (should be "emotion":)
      jsonStr = jsonStr.replace(/"emotion:\s*/g, '"emotion": ');

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
