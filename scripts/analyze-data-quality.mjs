#!/usr/bin/env node

/**
 * Analyze Transcript Data Quality
 *
 * Scans sample transcripts to identify data quality issues like:
 * - Multiple/extra spaces
 * - Special characters/encoding issues
 * - Empty messages
 * - Very long messages
 * - Repeated words
 * - URLs, emails, phone numbers
 * - ALL CAPS text
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

async function analyzeDataQuality() {
  console.log('🔍 Analyzing transcript data quality...\n');

  // Sample 1000 random transcripts
  const transcripts = await prisma.transcripts.findMany({
    take: 1000,
    select: {
      vendor_call_key: true,
      messages: true,
      agent_name: true,
      disposition: true
    }
  });

  console.log(`📊 Analyzing ${transcripts.length} sample transcripts\n`);

  const issues = {
    multipleSpaces: 0,
    leadingTrailingSpaces: 0,
    specialChars: 0,
    emptyMessages: 0,
    veryLongMessages: 0,
    repeatedWords: 0,
    urlsInText: 0,
    emailsInText: 0,
    phoneNumbers: 0,
    allCaps: 0,
    lineBreaks: 0,
    tabChars: 0,
    examples: {}
  };

  for (const transcript of transcripts) {
    if (!transcript.messages || !Array.isArray(transcript.messages)) continue;

    for (const msg of transcript.messages) {
      if (!msg.text) {
        issues.emptyMessages++;
        continue;
      }

      const text = msg.text;

      // Multiple consecutive spaces
      if (/  +/.test(text)) {
        issues.multipleSpaces++;
        if (!issues.examples.multipleSpaces) {
          issues.examples.multipleSpaces = text.substring(0, 100);
        }
      }

      // Leading/trailing whitespace
      if (text !== text.trim()) {
        issues.leadingTrailingSpaces++;
        if (!issues.examples.leadingTrailingSpaces) {
          issues.examples.leadingTrailingSpaces = JSON.stringify(text.substring(0, 50));
        }
      }

      // Line breaks in middle of text
      if (/\n/.test(text)) {
        issues.lineBreaks++;
        if (!issues.examples.lineBreaks) {
          issues.examples.lineBreaks = text.substring(0, 100).replace(/\n/g, '\\n');
        }
      }

      // Tab characters
      if (/\t/.test(text)) {
        issues.tabChars++;
        if (!issues.examples.tabChars) {
          issues.examples.tabChars = text.substring(0, 100).replace(/\t/g, '\\t');
        }
      }

      // Special characters that might be encoding issues
      if (/[^\x20-\x7E\n\r\t]/.test(text) && !/[''""–—]/.test(text)) {
        issues.specialChars++;
        if (!issues.examples.specialChars) {
          issues.examples.specialChars = text.substring(0, 100);
        }
      }

      // Very long messages (might be data dumps)
      if (text.length > 1000) {
        issues.veryLongMessages++;
        if (!issues.examples.veryLongMessages) {
          issues.examples.veryLongMessages = text.substring(0, 100) + '...';
        }
      }

      // Repeated words (like 'ok ok ok ok')
      if (/\b(\w+)\s+\1\s+\1/.test(text)) {
        issues.repeatedWords++;
        if (!issues.examples.repeatedWords) {
          issues.examples.repeatedWords = text.substring(0, 100);
        }
      }

      // URLs
      if (/https?:\/\//.test(text)) {
        issues.urlsInText++;
        if (!issues.examples.urlsInText) {
          issues.examples.urlsInText = text.substring(0, 100);
        }
      }

      // Email addresses
      if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(text)) {
        issues.emailsInText++;
        if (!issues.examples.emailsInText) {
          issues.examples.emailsInText = text.substring(0, 100);
        }
      }

      // Phone numbers
      if (/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(text)) {
        issues.phoneNumbers++;
        if (!issues.examples.phoneNumbers) {
          issues.examples.phoneNumbers = text.substring(0, 100);
        }
      }

      // All caps messages (might be shouting or system messages)
      if (text.length > 20 && text === text.toUpperCase() && /[A-Z]/.test(text)) {
        issues.allCaps++;
        if (!issues.examples.allCaps) {
          issues.examples.allCaps = text.substring(0, 100);
        }
      }
    }
  }

  console.log('📋 Data Quality Issues Found:\n');
  console.log(`  ❌ Multiple spaces: ${issues.multipleSpaces} messages`);
  console.log(`  ❌ Leading/trailing spaces: ${issues.leadingTrailingSpaces} messages`);
  console.log(`  ❌ Line breaks in text: ${issues.lineBreaks} messages`);
  console.log(`  ❌ Tab characters: ${issues.tabChars} messages`);
  console.log(`  ❌ Special characters: ${issues.specialChars} messages`);
  console.log(`  ❌ Empty messages: ${issues.emptyMessages} messages`);
  console.log(`  ⚠️  Very long messages (>1000 chars): ${issues.veryLongMessages} messages`);
  console.log(`  ⚠️  Repeated words: ${issues.repeatedWords} messages`);
  console.log(`  ℹ️  URLs in text: ${issues.urlsInText} messages`);
  console.log(`  ℹ️  Email addresses: ${issues.emailsInText} messages`);
  console.log(`  ℹ️  Phone numbers: ${issues.phoneNumbers} messages`);
  console.log(`  ⚠️  ALL CAPS messages: ${issues.allCaps} messages`);

  console.log('\n📝 Examples:\n');
  for (const [issue, example] of Object.entries(issues.examples)) {
    console.log(`  ${issue}:`);
    console.log(`    "${example}"\n`);
  }

  await prisma.$disconnect();
  await pool.end();
}

analyzeDataQuality().catch(console.error);
