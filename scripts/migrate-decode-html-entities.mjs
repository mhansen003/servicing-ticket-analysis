#!/usr/bin/env node

/**
 * One-Time Migration: Decode HTML Entities in Existing Transcripts
 *
 * Fixes HTML entities in message text for all existing transcripts:
 * &#39; → '
 * &quot; → "
 * &amp; → &
 * etc.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

// Initialize database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Decode HTML entities in text
 */
function decodeHtmlEntities(text) {
  if (!text) return text;
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

async function migrateTranscripts() {
  console.log('🔄 Starting HTML entity decode migration...\n');

  try {
    // Fetch all transcripts
    console.log('📥 Fetching all transcripts from database...');
    const transcripts = await prisma.transcripts.findMany({
      select: {
        id: true,
        vendor_call_key: true,
        messages: true
      }
    });

    console.log(`   Found ${transcripts.length.toLocaleString()} transcripts\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    console.log('🔧 Processing transcripts...');

    for (const transcript of transcripts) {
      try {
        // Parse messages
        const messages = transcript.messages;
        if (!messages || !Array.isArray(messages)) {
          skipped++;
          continue;
        }

        // Check if any message contains HTML entities
        const needsUpdate = messages.some(msg =>
          msg.text && (
            msg.text.includes('&#39;') ||
            msg.text.includes('&quot;') ||
            msg.text.includes('&amp;') ||
            msg.text.includes('&lt;') ||
            msg.text.includes('&gt;') ||
            msg.text.includes('&#x27;') ||
            msg.text.includes('&#x2F;') ||
            msg.text.includes('&nbsp;')
          )
        );

        if (!needsUpdate) {
          skipped++;
          continue;
        }

        // Decode HTML entities in all message text
        const decodedMessages = messages.map(msg => ({
          ...msg,
          text: decodeHtmlEntities(msg.text)
        }));

        // Update in database
        await prisma.transcripts.update({
          where: { id: transcript.id },
          data: { messages: decodedMessages }
        });

        updated++;

        // Progress update every 100 records
        if (updated % 100 === 0) {
          console.log(`   ✅ Updated ${updated.toLocaleString()} transcripts (${skipped.toLocaleString()} skipped, ${errors} errors)`);
        }

      } catch (error) {
        console.error(`   ❌ Error updating ${transcript.vendor_call_key}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Migration Complete!');
    console.log(`   ✅ Updated: ${updated.toLocaleString()} transcripts`);
    console.log(`   ⏭️  Skipped: ${skipped.toLocaleString()} (no HTML entities found)`);
    console.log(`   ❌ Errors: ${errors}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// Run migration
migrateTranscripts();
