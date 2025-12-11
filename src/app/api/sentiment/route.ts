import { NextRequest, NextResponse } from 'next/server';

interface Message {
  role: 'agent' | 'customer';
  text: string;
}

interface SentimentResult {
  score: number;
  emotion: string;
}

/**
 * Detect if a message is an automated system message (IVR, hold music, etc.)
 */
function isSystemMessage(text: string): boolean {
  if (!text || text.trim().length === 0) return true;

  const lowerText = text.toLowerCase();

  // Common automated message patterns
  const systemPatterns = [
    // Hold messages
    /\b(you are|you're) (now |currently )?on hold\b/i,
    /\bplease (continue to )?hold\b/i,
    /\byour call is important to us\b/i,
    /\ball (agents|representatives) are (currently )?busy\b/i,
    /\bthank you for (your patience|holding)\b/i,

    // Music/transfer notifications
    /\bmusic playing\b/i,
    /\bhold music\b/i,
    /\btransferring (you|your call)\b/i,
    /\bplease wait while (we|I) transfer\b/i,

    // IVR / Menu prompts
    /\bpress \d+ (for|to)\b/i,
    /\bplease listen carefully as (our )?menu options/i,
    /\bfor .+, press \d+\b/i,
    /\bto speak with .+, press \d+\b/i,
    /\bmain menu\b/i,

    // Generic automated greetings
    /^thank you for calling .+\. (this call|your call)/i,
    /\bthis call may be (recorded|monitored)\b/i,
    /\bfor quality (and training purposes|assurance)\b/i,
  ];

  return systemPatterns.some(pattern => pattern.test(lowerText));
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

    // Pre-process messages to identify system messages
    const messageTypes = messages.map((msg: Message) => ({
      isSystem: isSystemMessage(msg.text),
      originalIndex: messages.indexOf(msg)
    }));

    // Filter out system messages for AI analysis
    const humanMessages = messages.filter((msg: Message, idx: number) => !messageTypes[idx].isSystem);

    // If all messages are system messages, return early
    if (humanMessages.length === 0) {
      const systemResults = messages.map(() => ({ score: 0, emotion: 'system' }));
      return NextResponse.json({ sentiments: systemResults });
    }

    // Build the conversation text with message indices (only human messages)
    const conversationText = humanMessages
      .map((msg: Message, idx: number) => {
        const originalIdx = messages.indexOf(msg);
        return `[${originalIdx}] ${msg.role.toUpperCase()}: ${msg.text}`;
      })
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
            content: `You are a sentiment analyzer for mortgage customer service calls. Create a NUANCED heat signature - AVOID clustering around neutral (0). Use the full -1 to +1 range.

CRITICAL: Messages are labeled [index] CUSTOMER: or [index] AGENT: - apply DIFFERENT rules for each.

🎯 SCORING PHILOSOPHY:
- RESERVE 0 for truly emotionless information exchange only
- Default customer baseline: +0.1 to +0.2 (polite, cooperative)
- Default agent baseline: +0.2 to +0.3 (professional service)
- CREATE CONTRAST - differentiate positive from negative interactions
- Use FULL RANGE: Don't be afraid of -0.8 or +0.8 scores when warranted

⚠️ CONTEXT IS KEY: Read the conversation trajectory:
- Customer upset early → "thank you" later = relief (+0.5 to +0.7)
- Agent ignores complaint → hollow "we can help" = weak (+0.1)
- Is tension BUILDING or RESOLVING? Score accordingly.

=== CUSTOMER SCORING (sensitive & contextual) ===
Emotions: frustrated, disappointed, annoyed, resigned, confused, anxious, cooperative, satisfied, grateful, relieved, delighted

NEGATIVE (-1.0 to -0.1):
- Direct complaints, inconvenience: -0.5 to -0.7
  "I don't like this" "This is unacceptable" "I'm calling because there's a problem"
- Frustrated/upset/angry: -0.6 to -0.9
  "I'm very frustrated" "This is ridiculous" "I've called 3 times about this"
- Resigned/defeated: -0.3 to -0.5
  "I guess I'll have to..." "Whatever, I suppose that's fine" "If that's all you can do"
- Mild concern/confusion: -0.2 to -0.4
  "I'm not sure about this" "That doesn't sound right" "I'm a bit confused"

NEUTRAL (-0.1 to +0.1):
- ONLY for pure information exchange with no emotion
  "My account number is 12345" "I received a letter on Tuesday"

POSITIVE (+0.1 to +1.0):
- Cooperative/polite baseline: +0.1 to +0.2
  "Yes, that's correct" "I can do that" "Hold on a moment"
- Simple acknowledgment: +0.2 to +0.3
  "Okay" "Understood" "Got it"
- Genuine thanks/appreciation: +0.4 to +0.6
  "Thank you" "I appreciate that" "That's helpful"
- Relief after problem solved: +0.6 to +0.8
  "Oh great, thank you!" "That's exactly what I needed" "Perfect!"
- Delight/very satisfied: +0.8 to +1.0
  "You're wonderful!" "This is amazing!" "Thank you so much, you saved me!"

=== AGENT SCORING (service quality focused) ===
Emotions: helpful, professional, empathetic, apologetic, friendly, warm, dismissive, cold, confused, scripted

NEGATIVE (-1.0 to -0.1):
- Dismissive/unhelpful: -0.4 to -0.7
  "That's our policy" (without explanation) "There's nothing I can do" "You'll have to call someone else"
- Cold/robotic to upset customer: -0.3 to -0.5
  Scripted responses when empathy needed
- Ignoring customer concerns: -0.5 to -0.8
  Changing subject, not addressing the issue
- Defensive/argumentative: -0.6 to -0.9
  "Well, you should have..." "That's not our fault"

NEUTRAL (-0.1 to +0.1):
- ONLY pure procedural info with no warmth
  "Your account number is..." "The balance is $X"

POSITIVE (+0.1 to +1.0):
- Basic professional: +0.2 to +0.3
  "I can help with that" "Let me check for you"
- Friendly/warm: +0.3 to +0.4
  "Good morning!" "How are you today?" "I'd be happy to help"
- Helpful/informative: +0.4 to +0.5
  Clear explanations, problem-solving
- Empathetic (customer calm): +0.4 to +0.5
  "I understand" "That makes sense"
- Empathetic (customer upset): +0.6 to +0.8
  "I'm so sorry you're experiencing this" "I understand how frustrating that must be"
- Problem resolution: +0.6 to +0.8
  "I can fix that for you right now" "Let me get that taken care of"
- Exceptional service: +0.8 to +1.0
  Going above and beyond, delighting customer

CONVERSATION EXAMPLES:
[0] AGENT: "Thank you for calling CMG, this is Sarah" (+0.3, friendly)
[1] CUSTOMER: "Hi, I'm calling because my payment didn't go through" (-0.4, concerned)
[2] AGENT: "Oh, I'm sorry to hear that. Let me look into that right away" (+0.6, empathetic)
[3] CUSTOMER: "I've been trying to fix this all week" (-0.7, frustrated)
[4] AGENT: "I completely understand, that must be very frustrating" (+0.7, empathetic)
[5] CUSTOMER: "Yes, it is" (-0.5, frustrated)
[6] AGENT: "I see the issue - there was a bank code error. I can process this manually" (+0.7, helpful)
[7] CUSTOMER: "Oh thank you so much!" (+0.7, relieved)
[8] AGENT: "You're very welcome. It should process within an hour" (+0.5, helpful)
[9] CUSTOMER: "Perfect, I really appreciate your help" (+0.6, grateful)

Return JSON array with one object per message in order:
{"score": number, "emotion": string}

Return ONLY valid JSON array, no other text.`,
          },
          {
            role: 'user',
            content: `Analyze each message's sentiment. Pay attention to CUSTOMER vs AGENT labels:\n\n${conversationText}`,
          },
        ],
        max_tokens: 8000, // Increased to handle long conversations (up to ~500 messages)
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

      const aiResults: SentimentResult[] = JSON.parse(jsonStr);

      // Merge AI results with system message markers
      const finalResults: SentimentResult[] = [];
      let aiResultIndex = 0;

      for (let i = 0; i < messages.length; i++) {
        if (messageTypes[i].isSystem) {
          // System message - assign neutral score with "system" emotion
          finalResults.push({ score: 0, emotion: 'system' });
        } else {
          // Human message - use AI result
          finalResults.push(aiResults[aiResultIndex] || { score: 0, emotion: 'neutral' });
          aiResultIndex++;
        }
      }

      return NextResponse.json({ sentiments: finalResults });
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
