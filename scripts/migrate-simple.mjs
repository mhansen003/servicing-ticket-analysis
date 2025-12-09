/**
 * Simple Migration: Use Prisma CLI to update existing tickets
 *
 * This uses direct SQL queries which work better for batch operations
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment
dotenv.config({ path: '.env.local' });

console.log('🔄 Starting simple categorization migration...\n');

// Read categorized CSV
const csvPath = path.join(process.cwd(), 'data', 'tickets-categorized.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split('\n');
const headers = lines[0].split(',');

// Find column indexes
const keyIdx = headers.indexOf('ticket_key');
const categoryIdx = headers.indexOf('category');
const subcategoryIdx = headers.indexOf('subcategory');
const allIssuesIdx = headers.indexOf('all_issues');
const confidenceIdx = headers.indexOf('categorization_confidence');

console.log(`📊 Found columns at indexes:`);
console.log(`   ticket_key: ${keyIdx}`);
console.log(`   category: ${categoryIdx}`);
console.log(`   subcategory: ${subcategoryIdx}`);
console.log(`   all_issues: ${allIssuesIdx}`);
console.log(`   categorization_confidence: ${confidenceIdx}\n`);

// Generate SQL update statements
const sqlStatements = [];

for (let i = 1; i < Math.min(lines.length, 100); i++) { // Limit to 100 for testing
  if (!lines[i].trim()) continue;

  const values = lines[i].split(',');
  const ticketKey = values[keyIdx]?.trim();
  const category = values[categoryIdx]?.trim() || 'Other';
  const subcategory = values[subcategoryIdx]?.trim() || 'Uncategorized';
  const allIssues = values[allIssuesIdx]?.trim() || '';
  const confidence = values[confidenceIdx]?.trim() || '0.3';

  if (!ticketKey) continue;

  // Escape single quotes for SQL
  const escapeSql = (str) => str.replace(/'/g, "''");

  const sql = `UPDATE tickets SET
    category = '${escapeSql(category)}',
    subcategory = '${escapeSql(subcategory)}',
    all_issues = '${escapeSql(allIssues)}',
    categorization_confidence = ${parseFloat(confidence)}
  WHERE ticket_key = '${escapeSql(ticketKey)}';`;

  sqlStatements.push(sql);
}

console.log(`✅ Generated ${sqlStatements.length} SQL update statements\n`);

// Save to file
const sqlFile = path.join(process.cwd(), 'data', 'migration.sql');
const sqlContent = sqlStatements.join('\n');
fs.writeFileSync(sqlFile, sqlContent, 'utf-8');

console.log(`📝 Saved SQL to: ${sqlFile}\n`);
console.log('📤 To apply this migration:\n');
console.log('Option 1: Using Prisma Studio');
console.log('   1. Run: npx prisma studio');
console.log('   2. Execute SQL manually\n');

console.log('Option 2: Using psql (if you have it installed)');
console.log(`   psql "${process.env.DATABASE_URL}" < data/migration.sql\n`);

console.log('Option 3: Via Neon Console');
console.log('   1. Go to https://console.neon.tech');
console.log('   2. Select your database');
console.log('   3. Go to SQL Editor');
console.log('   4. Paste and run the SQL from migration.sql\n');

// Show sample SQL
console.log('📋 Sample SQL (first 3 statements):');
console.log('────────────────────────────────────────');
console.log(sqlStatements.slice(0, 3).join('\n'));
console.log('────────────────────────────────────────\n');

console.log('✨ Quick test command to verify data:');
console.log('────────────────────────────────────────');
console.log(`npx prisma db execute --stdin <<EOF
SELECT category, subcategory, COUNT(*) as count
FROM tickets
WHERE category IS NOT NULL
GROUP BY category, subcategory
ORDER BY count DESC
LIMIT 10;
EOF`);
console.log('────────────────────────────────────────\n');
