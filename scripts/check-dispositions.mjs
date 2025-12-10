#!/usr/bin/env node
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDispositions() {
  console.log('📊 Checking disposition data...\n');

  // Get disposition counts
  const dispositions = await prisma.$queryRaw`
    SELECT disposition, COUNT(*) as count
    FROM transcripts
    WHERE disposition IS NOT NULL AND disposition != ''
    GROUP BY disposition
    ORDER BY count DESC
    LIMIT 20
  `;

  console.log('Top 20 Manual Dispositions:');
  dispositions.forEach((d, i) => {
    console.log(`   ${i + 1}. ${d.disposition} - ${d.count} calls`);
  });

  await prisma.$disconnect();
}

checkDispositions().catch(console.error);
