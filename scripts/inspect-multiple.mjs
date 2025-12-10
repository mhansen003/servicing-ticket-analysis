#!/usr/bin/env node

/**
 * Inspect Multiple Transcripts
 * Check if all transcripts have this same pattern
 */

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

async function inspect() {
  try {
    console.log('🔍 Checking 10 Random Transcripts\n');

    // Get 10 random transcripts from November
    const samples = await prisma.transcripts.findMany({
      where: {
        call_start: {
          gte: new Date('2025-11-01'),
          lt: new Date('2025-12-01')
        },
        messages: {
          not: null
        }
      },
      take: 10,
      select: {
        vendor_call_key: true,
        agent_name: true,
        messages: true
      }
    });

    console.log(`Found ${samples.length} transcripts\n`);

    for (const sample of samples) {
      const messages = sample.messages;
      if (!Array.isArray(messages) || messages.length === 0) continue;

      const speakers = {};
      messages.forEach(msg => {
        const speaker = msg.speaker || msg.role || 'unknown';
        speakers[speaker] = (speakers[speaker] || 0) + 1;
      });

      console.log(`─────────────────────────────────────────────────`);
      console.log(`Call: ${sample.vendor_call_key.substring(0, 8)}...`);
      console.log(`Agent Name in DB: "${sample.agent_name}"`);
      console.log(`Total Messages: ${messages.length}`);
      console.log(`Speakers:`, speakers);
      console.log(`Sample message:`, JSON.stringify(messages[0], null, 2));
    }

    console.log(`\n─────────────────────────────────────────────────\n`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

inspect();
