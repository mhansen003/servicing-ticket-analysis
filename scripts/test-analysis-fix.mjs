#!/usr/bin/env node

/**
 * Test that AI analysis works after the dotenv fix
 */

// Load dotenv FIRST
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { analyzeTranscript } from './transcript-analyzer.mjs';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function testAnalysis() {
  console.log('🧪 Testing AI analysis with fixed dotenv loading...\n');

  try {
    // Get one transcript that needs analysis
    const transcript = await prisma.transcripts.findFirst({
      where: {
        call_start: {
          gte: new Date('2025-12-01')
        },
        messages: {
          not: null
        }
      }
    });

    if (!transcript) {
      console.log('❌ No transcripts found to test');
      return;
    }

    console.log(`📝 Testing with transcript: ${transcript.vendor_call_key}`);
    console.log(`   Agent: ${transcript.agent_name}`);
    console.log(`   Duration: ${transcript.duration_seconds}s`);
    console.log(`   Messages: ${transcript.messages?.length || 0}\n`);

    console.log('🤖 Running AI analysis...\n');

    const result = await analyzeTranscript(transcript, prisma);

    console.log('✅ SUCCESS! AI analysis worked!\n');
    console.log('📊 Analysis Results:');
    console.log(`   Agent Sentiment: ${result.agentSentiment} (${result.agentSentimentScore})`);
    console.log(`   Customer Sentiment: ${result.customerSentiment} (${result.customerSentimentScore})`);
    console.log(`   Topic: ${result.aiDiscoveredTopic}`);
    console.log(`   Subcategory: ${result.aiDiscoveredSubcategory}`);
    console.log(`\n🎉 The dotenv fix worked! API key is now loading correctly.`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nFull error:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

testAnalysis();
