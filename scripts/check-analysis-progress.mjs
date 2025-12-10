#!/usr/bin/env node

/**
 * Check AI Analysis Progress
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkProgress() {
  try {
    // Count total transcripts from Dec 1
    const totalTranscripts = await prisma.transcripts.count({
      where: {
        call_start: {
          gte: new Date('2025-12-01')
        }
      }
    });

    // Count analyzed transcripts
    const analyzedCount = await prisma.transcriptAnalysis.count({
      where: {
        transcript: {
          call_start: {
            gte: new Date('2025-12-01')
          }
        }
      }
    });

    // Count pending
    const pending = totalTranscripts - analyzedCount;
    const percentComplete = ((analyzedCount / totalTranscripts) * 100).toFixed(1);

    console.log('\n📊 AI Analysis Progress');
    console.log('========================\n');
    console.log(`   Total Transcripts (Dec 1+): ${totalTranscripts.toLocaleString()}`);
    console.log(`   ✅ Analyzed: ${analyzedCount.toLocaleString()}`);
    console.log(`   ⏳ Pending: ${pending.toLocaleString()}`);
    console.log(`   📈 Progress: ${percentComplete}%\n`);

    if (pending === 0) {
      console.log('🎉 All transcripts analyzed!');
    } else {
      const estimatedMinutes = Math.ceil(pending / 20 / 60 * 2); // ~2 seconds per request, 20 concurrent
      console.log(`⏱️  Estimated time remaining: ~${estimatedMinutes} minutes\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

checkProgress();
