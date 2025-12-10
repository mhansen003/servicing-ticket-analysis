#!/usr/bin/env node

/**
 * Inspect Transcript Messages Structure
 *
 * This script examines the structure of messages in the database
 * to understand how agent vs customer messages are stored.
 */

import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
const { Pool } = pg;

// Load .env.local
dotenv.config({ path: '.env.local' });

// Verify DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL not found');
  process.exit(1);
}

// Create PostgreSQL pool and adapter
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function inspect() {
  try {
    console.log('🔍 Inspecting Transcript Message Structure\n');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    // Get a sample transcript from November 2025 with messages
    const sample = await prisma.transcripts.findFirst({
      where: {
        call_start: {
          gte: new Date('2025-11-01'),
          lt: new Date('2025-12-01')
        },
        messages: {
          not: null
        }
      },
      select: {
        vendor_call_key: true,
        agent_name: true,
        messages: true,
        call_start: true,
        duration_seconds: true,
        department: true,
        disposition: true
      }
    });

    if (!sample) {
      console.log('❌ No transcripts found with messages in November 2025');
      return;
    }

    console.log('📋 SAMPLE TRANSCRIPT INFO');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log(`Vendor Call Key: ${sample.vendor_call_key}`);
    console.log(`Agent Name: ${sample.agent_name || '(null)'}`);
    console.log(`Call Start: ${sample.call_start}`);
    console.log(`Duration: ${sample.duration_seconds} seconds`);
    console.log(`Department: ${sample.department || '(null)'}`);
    console.log(`Disposition: ${sample.disposition || '(null)'}`);
    console.log('');

    console.log('💬 MESSAGES STRUCTURE');
    console.log('─────────────────────────────────────────────────────────────────');

    const messages = sample.messages;

    if (!messages) {
      console.log('❌ Messages field is null');
      return;
    }

    if (!Array.isArray(messages)) {
      console.log('❌ Messages is not an array');
      console.log('Type:', typeof messages);
      console.log('Value:', JSON.stringify(messages, null, 2));
      return;
    }

    console.log(`Total messages: ${messages.length}\n`);

    // Analyze message structure
    console.log('📊 MESSAGE FIELD ANALYSIS');
    console.log('─────────────────────────────────────────────────────────────────');

    const fieldSets = new Map();
    messages.forEach(msg => {
      const fields = Object.keys(msg).sort().join(',');
      fieldSets.set(fields, (fieldSets.get(fields) || 0) + 1);
    });

    console.log('Field combinations found:');
    for (const [fields, count] of fieldSets.entries()) {
      console.log(`  ${count} messages with fields: ${fields}`);
    }
    console.log('');

    // Show first 5 messages
    console.log('📝 FIRST 5 MESSAGES (Full Structure)');
    console.log('─────────────────────────────────────────────────────────────────');
    messages.slice(0, 5).forEach((msg, idx) => {
      console.log(`\nMessage ${idx + 1}:`);
      console.log(JSON.stringify(msg, null, 2));
    });

    // Count by role/speaker
    console.log('\n\n🎭 MESSAGE ROLE/SPEAKER BREAKDOWN');
    console.log('─────────────────────────────────────────────────────────────────');

    const breakdown = {};
    messages.forEach(msg => {
      // Check for different possible fields
      const role = msg.role || msg.speaker || msg.type || 'unknown';
      breakdown[role] = (breakdown[role] || 0) + 1;
    });

    console.log('Count by role/speaker field:');
    for (const [role, count] of Object.entries(breakdown)) {
      console.log(`  ${role}: ${count} messages`);
    }

    // Show examples of each role
    console.log('\n\n📌 EXAMPLE MESSAGES BY ROLE');
    console.log('─────────────────────────────────────────────────────────────────');

    const roleExamples = {};
    messages.forEach(msg => {
      const role = msg.role || msg.speaker || msg.type || 'unknown';
      if (!roleExamples[role]) {
        roleExamples[role] = msg;
      }
    });

    for (const [role, msg] of Object.entries(roleExamples)) {
      console.log(`\n${role} example:`);
      console.log(JSON.stringify(msg, null, 2));
    }

    console.log('\n\n═══════════════════════════════════════════════════════════════════');
    console.log('✅ Inspection complete\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
inspect().catch(error => {
  console.error('\n❌ Fatal error:', error);
  prisma.$disconnect();
  process.exit(1);
});
