#!/usr/bin/env node

/**
 * Test OpenRouter API Key
 * Quick test to verify the API key is working
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

async function testKey() {
  console.log('🧪 Testing OpenRouter API key...\n');

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY not found in environment');
    return;
  }

  console.log(`API Key format: ${apiKey.substring(0, 15)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log(`Full length: ${apiKey.length} chars\n`);

  try {
    console.log('📡 Sending test request to OpenRouter...\n');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://servicing-tickets.cmgfinancial.ai',
        'X-Title': 'API Key Test',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          {
            role: 'user',
            content: 'Say "test successful" in JSON format: {"status": "success"}',
          },
        ],
        temperature: 0.3,
        max_tokens: 50,
      }),
    });

    console.log(`Response status: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:');
      console.error(errorText);
      console.error('\n---');

      try {
        const errorJson = JSON.parse(errorText);
        console.error('\nParsed error:', JSON.stringify(errorJson, null, 2));
      } catch (e) {
        // Not JSON
      }

      return;
    }

    const data = await response.json();
    console.log('✅ Success! API key is working.\n');
    console.log('Response:', JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testKey();
