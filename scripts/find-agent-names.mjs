#!/usr/bin/env node

/**
 * Research Script: Find Agent Names in Transcript Messages
 *
 * This script analyzes transcripts to discover where agent names appear
 * and how to extract them for backfilling the agent_name field.
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

async function research() {
  try {
    console.log('🔍 Researching Agent Names in Transcript Messages\n');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    // Get 20 random transcripts with agent messages
    const samples = await prisma.transcripts.findMany({
      where: {
        messages: {
          not: null
        }
      },
      take: 20,
      select: {
        vendor_call_key: true,
        agent_name: true,
        messages: true,
        department: true
      }
    });

    console.log(`Analyzing ${samples.length} transcripts...\n`);

    const findings = {
      totalTranscripts: 0,
      agentMessagesFound: 0,
      patternCounts: {},
      agentNameExamples: []
    };

    for (const sample of samples) {
      const messages = sample.messages;
      if (!Array.isArray(messages)) continue;

      findings.totalTranscripts++;

      // Find agent messages
      const agentMessages = messages.filter(m =>
        m.speaker && m.speaker.toLowerCase() === 'agent'
      );

      if (agentMessages.length === 0) continue;

      findings.agentMessagesFound++;

      // Common patterns where agent names appear:
      // 1. "My name is [Name]"
      // 2. "This is [Name]"
      // 3. "I'm [Name]"
      // 4. "[Name] speaking"
      // 5. End of call: "This was [Name]"

      const patterns = [
        { regex: /(?:my name is|i'?m|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i, type: 'introduction' },
        { regex: /(?:this was|was)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:on the phone|speaking|calling)/i, type: 'closing' },
        { regex: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+speaking/i, type: 'speaking' },
      ];

      let foundName = null;

      // Check first few agent messages for introduction
      const firstAgentMessages = agentMessages.slice(0, 3);
      for (const msg of firstAgentMessages) {
        for (const { regex, type } of patterns) {
          const match = msg.text.match(regex);
          if (match) {
            foundName = match[1];
            findings.patternCounts[type] = (findings.patternCounts[type] || 0) + 1;
            findings.agentNameExamples.push({
              vendorCallKey: sample.vendor_call_key.substring(0, 8) + '...',
              foundName,
              pattern: type,
              messageText: msg.text.substring(0, 100) + '...',
              department: sample.department
            });
            break;
          }
        }
        if (foundName) break;
      }

      // If not found in intro, check last agent message (closing)
      if (!foundName && agentMessages.length > 0) {
        const lastAgentMsg = agentMessages[agentMessages.length - 1];
        for (const { regex, type } of patterns) {
          const match = lastAgentMsg.text.match(regex);
          if (match && type === 'closing') {
            foundName = match[1];
            findings.patternCounts[type] = (findings.patternCounts[type] || 0) + 1;
            findings.agentNameExamples.push({
              vendorCallKey: sample.vendor_call_key.substring(0, 8) + '...',
              foundName,
              pattern: type,
              messageText: lastAgentMsg.text.substring(0, 100) + '...',
              department: sample.department
            });
            break;
          }
        }
      }
    }

    console.log('📊 FINDINGS\n');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log(`Total transcripts analyzed: ${findings.totalTranscripts}`);
    console.log(`Transcripts with agent messages: ${findings.agentMessagesFound}`);
    console.log(`\nPattern Success Rate:`);
    for (const [pattern, count] of Object.entries(findings.patternCounts)) {
      console.log(`  ${pattern}: ${count} occurrences`);
    }

    console.log('\n\n📝 AGENT NAME EXAMPLES\n');
    console.log('─────────────────────────────────────────────────────────────────');
    findings.agentNameExamples.slice(0, 10).forEach((ex, idx) => {
      console.log(`\nExample ${idx + 1}:`);
      console.log(`  Call ID: ${ex.vendorCallKey}`);
      console.log(`  Department: ${ex.department}`);
      console.log(`  Found Name: "${ex.foundName}"`);
      console.log(`  Pattern: ${ex.pattern}`);
      console.log(`  Message: ${ex.messageText}`);
    });

    console.log('\n\n💡 RECOMMENDATIONS\n');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('Based on the analysis, here are the best strategies:\n');
    console.log('1. Check FIRST 3 agent messages for introduction patterns:');
    console.log('   - "My name is [Name]"');
    console.log('   - "This is [Name]"');
    console.log('   - "I\'m [Name]"');
    console.log('');
    console.log('2. Check LAST agent message for closing patterns:');
    console.log('   - "This was [Name] on the phone"');
    console.log('   - "This was [Name] speaking"');
    console.log('');
    console.log('3. Success rate by pattern:');
    const total = Object.values(findings.patternCounts).reduce((a, b) => a + b, 0);
    for (const [pattern, count] of Object.entries(findings.patternCounts)) {
      const percentage = ((count / total) * 100).toFixed(1);
      console.log(`   ${pattern}: ${percentage}%`);
    }

    console.log('\n\n═══════════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

research().catch(error => {
  console.error('\n❌ Fatal error:', error);
  prisma.$disconnect();
  process.exit(1);
});
