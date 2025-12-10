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

async function verifyData() {
  try {
    // Check old data (before Dec 1, 2025)
    const oldData = await prisma.transcripts.count({
      where: {
        call_start: {
          lt: new Date('2025-12-01')
        }
      }
    });

    const oldestRecord = await prisma.transcripts.findFirst({
      where: {
        call_start: {
          lt: new Date('2025-12-01')
        }
      },
      orderBy: {
        call_start: 'asc'
      }
    });

    const newestOldRecord = await prisma.transcripts.findFirst({
      where: {
        call_start: {
          lt: new Date('2025-12-01')
        }
      },
      orderBy: {
        call_start: 'desc'
      }
    });

    // Check new data (Dec 1, 2025+)
    const newData = await prisma.transcripts.count({
      where: {
        call_start: {
          gte: new Date('2025-12-01')
        }
      }
    });

    console.log('✅ EXISTING DATA (before Dec 1, 2025):');
    console.log(`   Count: ${oldData.toLocaleString()}`);
    if (oldestRecord) {
      console.log(`   Oldest: ${oldestRecord.call_start?.toISOString().split('T')[0]}`);
    }
    if (newestOldRecord) {
      console.log(`   Newest: ${newestOldRecord.call_start?.toISOString().split('T')[0]}`);
    }

    console.log('\n🔍 NEW DATA (Dec 1, 2025+):');
    console.log(`   Count: ${newData.toLocaleString()}`);
    console.log(`   Status: ${newData === 0 ? '✅ CLEANED (ready for fresh import)' : '⚠️  Still has data'}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

verifyData();
