#!/usr/bin/env node

/**
 * Analyze Existing Transcripts (AI Only)
 *
 * Runs AI analysis on transcripts that are already in the database
 * but don't have analysis yet. No Domo fetch, just pure AI processing.
 */

// Load dotenv FIRST
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { analyzeTranscriptBatch } from './transcript-analyzer.mjs';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function analyzeExisting() {
  console.log('🤖 AI Analysis of Existing Transcripts');
  console.log('=====================================\n');

  try {
    // Get all transcripts from Dec 1+ that don't have analysis
    console.log('📊 Finding transcripts that need analysis...\n');

    const transcriptsNeedingAnalysis = await prisma.transcripts.findMany({
      where: {
        call_start: {
          gte: new Date('2025-12-01')
        },
        TranscriptAnalysis: {
          none: {}
        }
      },
      orderBy: {
        call_start: 'desc'
      }
    });

    const total = transcriptsNeedingAnalysis.length;
    console.log(`Found ${total.toLocaleString()} transcripts needing analysis\n`);

    if (total === 0) {
      console.log('✅ All transcripts already analyzed!');
      return;
    }

    console.log(`🚀 Starting batch AI analysis (20 concurrent)...\n`);

    const startTime = Date.now();

    const { results, errors } = await analyzeTranscriptBatch(
      transcriptsNeedingAnalysis,
      prisma,
      {
        maxConcurrent: 20,
        onProgress: (processed, total) => {
          if (processed % 100 === 0 || processed === total) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            const rate = (processed / (Date.now() - startTime) * 1000).toFixed(1);
            console.log(`   ✅ Analyzed ${processed.toLocaleString()}/${total.toLocaleString()} (${rate}/sec, ${elapsed}s elapsed)`);
          }
        }
      }
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n📊 Analysis Complete!');
    console.log(`   ✅ Successful: ${results.length.toLocaleString()}`);
    console.log(`   ❌ Errors: ${errors.length}`);
    console.log(`   ⏱️  Duration: ${elapsed}s`);
    console.log(`   🚀 Rate: ${(results.length / elapsed).toFixed(1)} transcripts/sec`);

    if (errors.length > 0) {
      console.log(`\n⚠️  Failed transcripts:`);
      errors.slice(0, 10).forEach(e => {
        console.log(`   - ${e.vendorCallKey}: ${e.error}`);
      });
      if (errors.length > 10) {
        console.log(`   ... and ${errors.length - 10} more`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

analyzeExisting();
