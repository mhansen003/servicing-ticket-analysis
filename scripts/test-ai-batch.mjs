#!/usr/bin/env node

/**
 * Test AI analysis on 10 transcripts
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

async function testBatch() {
  console.log('🧪 Testing AI analysis on 10 transcripts...\n');

  try {
    // Get 10 transcripts that haven't been analyzed yet
    const transcripts = await prisma.transcripts.findMany({
      where: {
        call_start: {
          gte: new Date('2025-12-01')
        },
        messages: {
          not: null
        }
      },
      take: 10
    });

    console.log(`📝 Found ${transcripts.length} transcripts to analyze\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < transcripts.length; i++) {
      const transcript = transcripts[i];
      console.log(`\n[${i + 1}/10] Analyzing: ${transcript.vendor_call_key}`);
      console.log(`   Agent: ${transcript.agent_name || 'Unknown'}`);
      console.log(`   Duration: ${transcript.duration_seconds}s`);

      try {
        const result = await analyzeTranscript(transcript, prisma);
        console.log(`   ✅ Success! Sentiment: ${result.agentSentiment}/${result.customerSentiment}`);
        console.log(`   📊 Topic: ${result.aiDiscoveredTopic}`);
        successCount++;
      } catch (error) {
        console.error(`   ❌ Failed: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Success: ${successCount}/10`);
    console.log(`❌ Errors: ${errorCount}/10`);

    if (successCount === 10) {
      console.log(`\n🎉 Perfect! AI analysis is working flawlessly!`);
    } else if (successCount > 0) {
      console.log(`\n⚠️  Some errors but AI is mostly working`);
    } else {
      console.log(`\n❌ AI analysis is not working - needs debugging`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

testBatch();
