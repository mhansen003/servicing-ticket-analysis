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

async function checkImportedData() {
  try {
    console.log('🔍 Checking recently imported data...\n');

    // Get first 10 records from Dec 1+
    const records = await prisma.transcripts.findMany({
      where: {
        call_start: {
          gte: new Date('2025-12-01')
        }
      },
      orderBy: {
        call_start: 'desc'
      },
      take: 10
    });

    console.log(`✅ Found ${records.length} records from Dec 1+\n`);

    if (records.length === 0) {
      console.log('⚠️  No records imported yet - still fetching from Domo');
      return;
    }

    console.log('📊 FIELD COMPLETENESS CHECK:');
    console.log('='.repeat(80));

    for (let i = 0; i < Math.min(3, records.length); i++) {
      const r = records[i];
      console.log(`\nRecord ${i + 1}: ${r.vendor_call_key}`);
      console.log('-'.repeat(80));
      console.log(`  Call Start: ${r.call_start?.toISOString() || 'NULL'}`);
      console.log(`  Call End: ${r.call_end?.toISOString() || 'NULL'}`);
      console.log(`  Duration: ${r.duration_seconds || 'NULL'} seconds`);
      console.log(`  Disposition: ${r.disposition || 'NULL'}`);
      console.log(`  Department: ${r.department || 'NULL'}`);
      console.log(`  Agent Name: ${r.agent_name || 'NULL'}`);
      console.log(`  Agent Role: ${r.agent_role || 'NULL'}`);
      console.log(`  Agent Email: ${r.agent_email || 'NULL'}`);
      console.log(`  Number of Holds: ${r.number_of_holds ?? 'NULL'}`);
      console.log(`  Hold Duration: ${r.hold_duration ?? 'NULL'}`);

      // Check messages/conversation
      if (r.messages) {
        const messages = Array.isArray(r.messages) ? r.messages : [];
        console.log(`  Messages: ✅ ${messages.length} messages`);

        if (messages.length > 0) {
          const totalText = messages
            .map(m => m.text || '')
            .join(' ')
            .length;
          console.log(`  Total text: ${totalText.toLocaleString()} chars`);
          console.log(`  First message: ${messages[0].speaker}: ${(messages[0].text || '').substring(0, 60)}...`);
        }
      } else {
        console.log(`  Messages: ❌ NULL or empty`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📈 SUMMARY:');

    const withMessages = records.filter(r => r.messages && Array.isArray(r.messages) && r.messages.length > 0).length;
    const withDuration = records.filter(r => r.duration_seconds).length;
    const withAgent = records.filter(r => r.agent_name).length;
    const withDisposition = records.filter(r => r.disposition).length;

    console.log(`  Records with messages: ${withMessages}/${records.length}`);
    console.log(`  Records with duration: ${withDuration}/${records.length}`);
    console.log(`  Records with agent: ${withAgent}/${records.length}`);
    console.log(`  Records with disposition: ${withDisposition}/${records.length}`);

    if (withMessages === records.length) {
      console.log('\n✅ All records have complete conversation data!');
    } else {
      console.log(`\n⚠️  ${records.length - withMessages} records missing conversation data`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

checkImportedData();
