#!/usr/bin/env node

/**
 * Delete Recent Imports
 *
 * Removes transcripts imported since Dec 1, 2025 that have corrupted/null messages
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

async function deleteRecentImports() {
  try {
    console.log('🗑️  Deleting recent imports from Dec 1, 2025 forward...\n');

    // First, delete from TranscriptAnalysis (foreign key constraint)
    const deletedAnalysis = await prisma.transcriptAnalysis.deleteMany({
      where: {
        transcript: {
          call_start: {
            gte: new Date('2025-12-01')
          }
        }
      }
    });
    console.log(`✅ Deleted ${deletedAnalysis.count} TranscriptAnalysis records`);

    // Then delete transcripts
    const deletedTranscripts = await prisma.transcripts.deleteMany({
      where: {
        call_start: {
          gte: new Date('2025-12-01')
        }
      }
    });
    console.log(`✅ Deleted ${deletedTranscripts.count} Transcript records`);

    console.log('\n✅ Cleanup complete!');
    console.log('   Database is now ready for fresh import with fixed parser');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

deleteRecentImports()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
