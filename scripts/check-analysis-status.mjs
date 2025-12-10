#!/usr/bin/env node

import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkAnalysisStatus() {
  try {
    console.log('🔍 Checking import and analysis status...\n');

    // Check transcripts from Dec 1+
    const transcriptCount = await prisma.transcripts.count({
      where: {
        call_start: {
          gte: new Date('2025-12-01')
        }
      }
    });

    // Check analysis records
    const analysisCount = await prisma.transcriptAnalysis.count({
      where: {
        transcript: {
          call_start: {
            gte: new Date('2025-12-01')
          }
        }
      }
    });

    console.log('📊 STATUS:');
    console.log(`   Transcripts imported: ${transcriptCount.toLocaleString()}`);
    console.log(`   AI analyses completed: ${analysisCount.toLocaleString()}`);
    console.log(`   Pending analysis: ${(transcriptCount - analysisCount).toLocaleString()}`);

    if (analysisCount === 0 && transcriptCount > 0) {
      console.log('\n⚠️  AI analysis has NOT started yet');
      console.log('   The script imports all transcripts first, then runs AI analysis');
      console.log('   This is why you see total calls but 0 on sentiment/calendar cards');
    } else if (analysisCount < transcriptCount) {
      const progress = (analysisCount / transcriptCount * 100).toFixed(1);
      console.log(`\n🤖 AI analysis in progress: ${progress}% complete`);
    } else {
      console.log('\n✅ All transcripts have been analyzed!');
    }

    // Check a few analyzed records to confirm data
    if (analysisCount > 0) {
      console.log('\n📋 Sample analyzed records:');
      const samples = await prisma.transcriptAnalysis.findMany({
        where: {
          transcript: {
            call_start: {
              gte: new Date('2025-12-01')
            }
          }
        },
        include: {
          transcript: true
        },
        take: 3
      });

      for (const s of samples) {
        console.log(`   ${s.vendorCallKey}: ${s.agentSentiment}/${s.customerSentiment}, topic: ${s.aiDiscoveredTopic}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

checkAnalysisStatus();
