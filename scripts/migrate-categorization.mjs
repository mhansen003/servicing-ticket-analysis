/**
 * Migration Script: Add Categorization to Existing Tickets
 *
 * This script reads existing tickets from the database and adds:
 * - Category
 * - Subcategory
 * - All issues
 * - Confidence score
 */

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig, Pool } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local file
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  console.log('📝 Loading environment from .env.local...');
  dotenv.config({ path: envPath });
} else {
  console.log('⚠️  No .env.local file found, trying process.env...');
}

// Categorization logic (simplified from categorization.ts)
const CATEGORY_DEFINITIONS = [
  {
    name: 'Payment Issues',
    keywords: ['payment', 'pay', 'autopay', 'ach', 'paying', 'bill'],
    subcategories: [
      { name: 'First Payment Assistance', keywords: ['first payment', 'initial payment', 'how to pay', 'where do i send'], weight: 100 },
      { name: 'Payment Failure', keywords: ['declined', 'failed', 'didn\'t go through', 'bounced'], weight: 95 },
      { name: 'Duplicate Payment', keywords: ['duplicate', 'charged twice', 'double payment'], weight: 90 },
      { name: 'Autopay/Recurring Payment Issues', keywords: ['autopay', 'recurring', 'automatic payment'], weight: 85 },
      { name: 'General Payment Inquiry', keywords: ['payment', 'pay'], weight: 50 },
    ],
  },
  {
    name: 'Account Access',
    keywords: ['login', 'password', 'access', 'locked out', 'account'],
    subcategories: [
      { name: 'Password/Login Issues', keywords: ['password', 'reset', 'forgot password', 'can\'t log in'], weight: 95 },
      { name: 'Account Locked', keywords: ['locked', 'frozen', 'suspended'], weight: 90 },
      { name: 'General Access Issues', keywords: ['access', 'login'], weight: 50 },
    ],
  },
  {
    name: 'Loan Transfer',
    keywords: ['transfer', 'servicer', 'sold my loan', 'boarding'],
    subcategories: [
      { name: 'Post-Transfer Payment Confusion', keywords: ['where do i pay', 'transfer', 'new servicer'], weight: 95 },
      { name: 'Missing Transfer Notice', keywords: ['didn\'t receive', 'notice', 'transfer letter'], weight: 90 },
      { name: 'General Transfer Inquiry', keywords: ['transfer', 'sold'], weight: 50 },
    ],
  },
  {
    name: 'Document Requests',
    keywords: ['document', 'statement', 'payoff', 'letter', 'copy'],
    subcategories: [
      { name: 'Payoff Statement', keywords: ['payoff', 'payoff quote', 'closing', 'refinancing'], weight: 95 },
      { name: 'Mortgage Statement', keywords: ['mortgage statement', 'statement', 'billing statement'], weight: 90 },
      { name: 'General Document Request', keywords: ['document', 'copy'], weight: 50 },
    ],
  },
  {
    name: 'Escrow',
    keywords: ['escrow', 'tax', 'insurance', 'impound'],
    subcategories: [
      { name: 'Escrow Analysis', keywords: ['escrow analysis', 'escrow review', 'escrow shortage'], weight: 95 },
      { name: 'General Escrow Inquiry', keywords: ['escrow'], weight: 50 },
    ],
  },
  {
    name: 'Other',
    keywords: [],
    subcategories: [
      { name: 'Uncategorized', keywords: [], weight: 0 },
    ],
  },
];

function categorizeText(text, title = '') {
  const combined = `${title} ${text}`.toLowerCase();

  let bestMatch = {
    category: 'Other',
    subcategory: 'Uncategorized',
    confidence: 0.3,
    allIssues: [],
  };

  const allDetectedIssues = [];

  for (const categoryDef of CATEGORY_DEFINITIONS) {
    const categoryKeywordsMatched = categoryDef.keywords.filter(keyword =>
      combined.includes(keyword.toLowerCase())
    );

    if (categoryKeywordsMatched.length === 0 && categoryDef.name !== 'Other') {
      continue;
    }

    if (categoryKeywordsMatched.length > 0) {
      allDetectedIssues.push(categoryDef.name);
    }

    const sortedSubcategories = [...categoryDef.subcategories].sort((a, b) => b.weight - a.weight);

    for (const subcategory of sortedSubcategories) {
      const matchedKeywords = subcategory.keywords.filter(keyword =>
        combined.includes(keyword.toLowerCase())
      );

      if (matchedKeywords.length > 0) {
        const avgKeywordLength = matchedKeywords.reduce((sum, kw) => sum + kw.length, 0) / matchedKeywords.length;
        const specificityBonus = Math.min(avgKeywordLength / 20, 0.3);
        const matchBonus = Math.min(matchedKeywords.length * 0.1, 0.3);
        const weightBonus = (subcategory.weight / 100) * 0.4;

        const confidence = Math.min(0.4 + specificityBonus + matchBonus + weightBonus, 1.0);

        if (confidence > bestMatch.confidence) {
          bestMatch = {
            category: categoryDef.name,
            subcategory: subcategory.name,
            confidence,
            allIssues: [...allDetectedIssues],
          };
        }

        break;
      }
    }
  }

  bestMatch.allIssues = Array.from(new Set(bestMatch.allIssues));
  return bestMatch;
}

async function main() {
  console.log('🔄 Starting categorization migration...\n');

  // Check for DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable not set');
    console.log('   Using local data files as fallback...\n');

    // Fallback: Read from local CSV and create categorized version
    const dataPath = path.join(process.cwd(), 'data', 'tickets.csv');

    if (fs.existsSync(dataPath)) {
      console.log('📄 Reading tickets from local CSV...');
      const csvContent = fs.readFileSync(dataPath, 'utf-8');
      const lines = csvContent.split('\n');
      const headers = lines[0].split(',');

      // Add new columns to header if they don't exist
      const newHeaders = [...headers, 'category', 'subcategory', 'all_issues', 'categorization_confidence'];
      const newLines = [newHeaders.join(',')];

      let processed = 0;
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = lines[i].split(',');
        const titleIdx = headers.indexOf('ticket_title');
        const descIdx = headers.indexOf('ticket_description');

        const title = titleIdx >= 0 ? values[titleIdx] : '';
        const description = descIdx >= 0 ? values[descIdx] : '';

        const result = categorizeText(description, title);

        newLines.push([
          ...values,
          result.category,
          result.subcategory,
          result.allIssues.join('|'),
          result.confidence.toString()
        ].join(','));

        processed++;
        if (processed % 1000 === 0) {
          console.log(`  Processed ${processed} tickets...`);
        }
      }

      // Write categorized file
      const outputPath = path.join(process.cwd(), 'data', 'tickets-categorized.csv');
      fs.writeFileSync(outputPath, newLines.join('\n'), 'utf-8');

      console.log(`\n✅ Categorized ${processed} tickets`);
      console.log(`📝 Saved to: ${outputPath}`);
      console.log('\n💡 Next steps:');
      console.log('   1. Review the categorized data');
      console.log('   2. Use /api/ingest-v2 to import to database when ready');

      return;
    }

    console.error('❌ No local data file found at:', dataPath);
    console.log('\n💡 To fix this:');
    console.log('   1. Set DATABASE_URL in .env.local');
    console.log('   2. OR place tickets.csv in /data folder');
    process.exit(1);
  }

  // Database migration
  neonConfig.poolQueryViaFetch = true;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaNeon(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // Get all tickets without categorization
    const tickets = await prisma.ticket.findMany({
      where: {
        OR: [
          { category: null },
          { category: '' },
        ],
      },
      select: {
        id: true,
        ticketTitle: true,
        ticketDescription: true,
      },
    });

    console.log(`📊 Found ${tickets.length} tickets to categorize\n`);

    let processed = 0;
    let updated = 0;

    for (const ticket of tickets) {
      const result = categorizeText(
        ticket.ticketDescription || '',
        ticket.ticketTitle || ''
      );

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          category: result.category,
          subcategory: result.subcategory,
          allIssues: result.allIssues.join('|'),
          categorizationConfidence: result.confidence,
        },
      });

      processed++;
      updated++;

      if (processed % 100 === 0) {
        console.log(`  Processed ${processed}/${tickets.length} tickets...`);
      }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Processed: ${processed} tickets`);
    console.log(`   Updated: ${updated} tickets\n`);

  } catch (error) {
    console.error('❌ Error during migration:', error);
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
