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
            content: `You are a sentiment analyzer for mortgage customer service calls. Each message is labeled as CUSTOMER or AGENT - apply DIFFERENT scoring rules for each.

CRITICAL: Messages are labeled [index] CUSTOMER: or [index] AGENT: - use these labels to apply correct rules.

=== CUSTOMER SCORING (be sensitive to frustration) ===
Emotions: frustrated, disappointed, annoyed, resigned, confused, anxious, neutral, satisfied, grateful, relieved
- Complaints, "I don't like", inconvenience = -0.4 to -0.6
- "Disappointed", "frustrated", "upset" = -0.5 to -0.7
- "I guess I'll have to...", resigned acceptance = -0.3
- Routine questions (asking for balance, payment info) = 0 neutral
- Simple confirmations like "OK", "Thank you" = 0 to +0.1
- Genuine gratitude, problem solved = +0.4 to +0.7

=== AGENT SCORING (evaluate helpfulness) ===
Emotions: helpful, professional, empathetic, apologetic, neutral, dismissive, confused
- Helpful explanations, solving problems = +0.3 to +0.5
- Professional, providing information = +0.2 to +0.3
- Empathetic responses, acknowledging feelings = +0.4 to +0.5
- Simple statements of fact = 0 to +0.1
- "Sorry", "I apologize" with action = +0.2
- Robotic/cold responses = 0
- Defensive or dismissive = -0.3 to -0.5

IMPORTANT:
- A CUSTOMER saying "thank you" after getting info = neutral to slightly positive
- An AGENT providing information helpfully = professional/helpful (+0.2 to +0.3)
- Don't confuse who said what - check the CUSTOMER/AGENT label!

Return JSON array with one object per message in order:
{"score": number, "emotion": string}

Return ONLY valid JSON array, no other text.`,
          },
          {
            role: 'user',
            content: `Analyze each message's sentiment. Pay attention to CUSTOMER vs AGENT labels:\n\n${conversationText}`,
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
