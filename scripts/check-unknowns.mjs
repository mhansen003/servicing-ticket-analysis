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

async function checkUnknowns() {
  console.log('\n📊 Unknown Agent Analysis\n');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const unknownCount = await prisma.transcriptAnalysis.count({
    where: {
      OR: [
        { agentName: 'Unknown' },
        { agentName: null }
      ]
    }
  });

  const totalCount = await prisma.transcriptAnalysis.count();
  const knownCount = totalCount - unknownCount;
  const unknownPct = ((unknownCount / totalCount) * 100).toFixed(2);

  console.log(`   📝 Total analyzed transcripts: ${totalCount.toLocaleString()}`);
  console.log(`   ✅ Known agents: ${knownCount.toLocaleString()} (${(100 - unknownPct).toFixed(2)}%)`);
  console.log(`   ❓ Unknown agents: ${unknownCount.toLocaleString()} (${unknownPct}%)`);

  console.log('\n');
}

checkUnknowns()
  .then(() => {
    prisma.$disconnect();
    pool.end();
  })
  .catch(error => {
    console.error('Error:', error);
    prisma.$disconnect();
    pool.end();
    process.exit(1);
  });
