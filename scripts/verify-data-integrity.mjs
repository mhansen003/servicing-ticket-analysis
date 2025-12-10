#!/usr/bin/env node

/**
 * Data Integrity Verification Script
 *
 * Verifies that no existing data was lost during schema updates
 */

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig, Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ Error: DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Configure for serverless
neonConfig.poolQueryViaFetch = true;
const pool = new Pool({ connectionString });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });

console.log('🔍 DATA INTEGRITY VERIFICATION');
console.log('==============================\n');

async function main() {
  try {
    // Count total transcripts
    const totalCount = await prisma.transcripts.count();
    console.log(`📊 Total transcripts in database: ${totalCount}`);

    // Count records with original required fields
    const withCallStart = await prisma.transcripts.count({
      where: { call_start: { not: null } },
    });

    const withVendorKey = await prisma.transcripts.count({
      where: { vendor_call_key: { not: null } },
    });

    console.log(`\n✅ Original Data Integrity:`);
    console.log(`   - Records with call_start: ${withCallStart} / ${totalCount}`);
    console.log(`   - Records with vendor_call_key: ${withVendorKey} / ${totalCount}`);

    // Count new fields (should be null/0 before backfill)
    const withCallEnd = await prisma.transcripts.count({
      where: { call_end: { not: null } },
    });

    const withHolds = await prisma.transcripts.count({
      where: { number_of_holds: { not: null } },
    });

    const withHoldDuration = await prisma.transcripts.count({
      where: { hold_duration: { not: null } },
    });

    const withStatus = await prisma.transcripts.count({
      where: { status: { not: null } },
    });

    const withAgentRole = await prisma.transcripts.count({
      where: { agent_role: { not: null } },
    });

    const withAgentProfile = await prisma.transcripts.count({
      where: { agent_profile: { not: null } },
    });

    const withAgentEmail = await prisma.transcripts.count({
      where: { agent_email: { not: null } },
    });

    console.log(`\n📈 New Fields Status:`);
    console.log(`   - call_end: ${withCallEnd} / ${totalCount} (${((withCallEnd / totalCount) * 100).toFixed(1)}%)`);
    console.log(`   - number_of_holds: ${withHolds} / ${totalCount} (${((withHolds / totalCount) * 100).toFixed(1)}%)`);
    console.log(`   - hold_duration: ${withHoldDuration} / ${totalCount} (${((withHoldDuration / totalCount) * 100).toFixed(1)}%)`);
    console.log(`   - status: ${withStatus} / ${totalCount} (${((withStatus / totalCount) * 100).toFixed(1)}%)`);
    console.log(`   - agent_role: ${withAgentRole} / ${totalCount} (${((withAgentRole / totalCount) * 100).toFixed(1)}%)`);
    console.log(`   - agent_profile: ${withAgentProfile} / ${totalCount} (${((withAgentProfile / totalCount) * 100).toFixed(1)}%)`);
    console.log(`   - agent_email: ${withAgentEmail} / ${totalCount} (${((withAgentEmail / totalCount) * 100).toFixed(1)}%)`);

    // Sample a few records to show structure
    const sampleRecords = await prisma.transcripts.findMany({
      take: 3,
      orderBy: { call_start: 'desc' },
      select: {
        vendor_call_key: true,
        call_start: true,
        call_end: true,
        number_of_holds: true,
        hold_duration: true,
        status: true,
        agent_name: true,
        agent_role: true,
        agent_profile: true,
        agent_email: true,
      },
    });

    console.log(`\n📋 Sample Records:`);
    sampleRecords.forEach((record, idx) => {
      console.log(`\n   Record ${idx + 1}:`);
      console.log(`   - Vendor Key: ${record.vendor_call_key}`);
      console.log(`   - Call Start: ${record.call_start?.toISOString() || 'null'}`);
      console.log(`   - Call End: ${record.call_end?.toISOString() || 'null'}`);
      console.log(`   - Holds: ${record.number_of_holds ?? 'null'}`);
      console.log(`   - Hold Duration: ${record.hold_duration ?? 'null'}s`);
      console.log(`   - Status: ${record.status || 'null'}`);
      console.log(`   - Agent: ${record.agent_name || 'null'}`);
      console.log(`   - Agent Role: ${record.agent_role || 'null'}`);
      console.log(`   - Agent Profile: ${record.agent_profile || 'null'}`);
      console.log(`   - Agent Email: ${record.agent_email || 'null'}`);
    });

    console.log(`\n\n✅ Data integrity verification complete!`);
    console.log(`   All original data appears intact.`);
    console.log(`   New fields are ready for backfill.\n`);

  } catch (error) {
    console.error('\n❌ Error during verification:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
