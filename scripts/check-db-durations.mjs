#!/usr/bin/env node

/**
 * Check Database Duration Values
 * Query actual duration_seconds values from database
 */

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool } from '@neondatabase/serverless';

const connectionString = process.env.POSTGRES_PRISMA_URL;

if (!connectionString) {
  console.error('❌ POSTGRES_PRISMA_URL environment variable not set');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('📊 Checking database duration_seconds values...\n');

  // Get first 10 records
  const records = await prisma.transcripts.findMany({
    select: {
      vendor_call_key: true,
      duration_seconds: true,
      call_start: true,
      call_end: true,
    },
    take: 10,
  });

  console.log('First 10 records in database:');
  records.forEach(r => {
    console.log(`  ${r.vendor_call_key}:`);
    console.log(`    duration_seconds: ${r.duration_seconds}`);
    console.log(`    call_start: ${r.call_start}`);
    console.log(`    call_end: ${r.call_end}`);
    console.log('');
  });

  // Count how many have null vs 0 vs positive values
  const stats = await prisma.$queryRaw`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN duration_seconds IS NULL THEN 1 END) as null_count,
      COUNT(CASE WHEN duration_seconds = 0 THEN 1 END) as zero_count,
      COUNT(CASE WHEN duration_seconds > 0 THEN 1 END) as positive_count
    FROM transcripts
  `;

  console.log('Database statistics:');
  console.log(`  Total records: ${stats[0].total}`);
  console.log(`  NULL values: ${stats[0].null_count}`);
  console.log(`  Zero values: ${stats[0].zero_count}`);
  console.log(`  Positive values: ${stats[0].positive_count}`);

  await prisma.$disconnect();
}

main().catch(console.error);
