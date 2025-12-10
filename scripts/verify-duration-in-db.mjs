#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool } from '@neondatabase/serverless';

const connectionString = process.env.POSTGRES_PRISMA_URL;

if (!connectionString) {
  console.error('❌ POSTGRES_PRISMA_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔍 Checking duration_seconds values in database...\n');

  // Get a random sample of 10 records
  const sample = await prisma.transcripts.findMany({
    select: {
      vendor_call_key: true,
      duration_seconds: true,
      call_start: true,
    },
    take: 10,
    orderBy: {
      call_start: 'desc',
    },
  });

  console.log('Sample of 10 most recent records:');
  sample.forEach(r => {
    console.log(`  ${r.vendor_call_key}: duration_seconds = ${r.duration_seconds}`);
  });

  // Get stats
  const stats = await prisma.$queryRaw`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN duration_seconds IS NULL THEN 1 END) as null_count,
      COUNT(CASE WHEN duration_seconds = 0 THEN 1 END) as zero_count,
      COUNT(CASE WHEN duration_seconds > 0 THEN 1 END) as positive_count,
      AVG(CASE WHEN duration_seconds > 0 THEN duration_seconds END) as avg_duration
    FROM transcripts
  `;

  console.log('\nDatabase statistics:');
  console.log(`  Total: ${stats[0].total}`);
  console.log(`  NULL: ${stats[0].null_count}`);
  console.log(`  Zero: ${stats[0].zero_count}`);
  console.log(`  Positive: ${stats[0].positive_count}`);
  console.log(`  Avg duration (positive only): ${Math.round(Number(stats[0].avg_duration))} seconds`);

  await prisma.$disconnect();
}

main().catch(console.error);
