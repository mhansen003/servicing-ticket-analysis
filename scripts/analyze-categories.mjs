import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'all-tickets.json'), 'utf-8'));

// Filter to only Servicing-related projects
const servicingProjects = ['Servicing Help', 'Servicing Escalations WG', 'ServApp Support', 'CMG Servicing Oversight'];
const servicingTickets = data.filter(t => servicingProjects.includes(t.project));

console.log('=== SERVICING TICKET ANALYSIS ===');
console.log('Total servicing tickets:', servicingTickets.length);

// Count by project
const byProject = {};
servicingTickets.forEach(t => {
  byProject[t.project] = (byProject[t.project] || 0) + 1;
});
console.log('\nBy Project:');
Object.entries(byProject).sort((a, b) => b[1] - a[1]).forEach(([p, c]) => console.log(`  ${p}: ${c}`));

// Analyze ticket titles for common patterns/categories
const keywords = {
  'Automated System Messages': ['automatic reply', 'unmonitored mailbox', 'sagentsupport', 'auto-reply'],
  'Payment Issues': ['payment', 'pay ', 'ach', 'autopay', 'draft', 'misapplied', 'overpayment', 'underpayment', 'double draft'],
  'Escrow': ['escrow', 'tax bill', 'tax ', 'insurance', 'hoi ', 'pmi', 'shortage', 'surplus', 'flood', 'hazard'],
  'Documentation': ['statement', 'letter', 'document', '1098', 'payoff', 'release', 'mortgage release', 'amortization', 'confirmation'],
  'Transfer/Boarding': ['transfer', 'board', 'cenlar', 'sold', 'subservicer', 'lakeview', 'servicemac', 'notice of servicing'],
  'Voice/Alert Requests': ['voice mail', 'voicemail', 'alert', 'interim'],
  'Account Access': ['login', 'password', 'access', 'portal', 'locked out', 'reset', 'website link', 'online'],
  'Loan Info Request': ['loan number', 'loan info', 'balance', 'rate', 'mailing address', 'wire', 'reimbursement'],
  'Insurance/Coverage': ['mycoverageinfo', 'covius', 'coverage', 'policy'],
  'Loan Changes': ['recast', 'buyout', 'assumption', 'modification', 'forbearance', 'hardship', 'loss mitigation', 'deferment'],
  'Complaints/Escalations': ['complaint', 'escalat', 'elevated', 'urgent', 'mess', 'facebook', 'issue'],
  'General Inquiry': ['help', 'question', 'request', 'information', 'needed', 'assistance'],
  'Communication/Forwarded': ['fw:', 'fwd:', 're:', 'follow up', 'call back'],
};

// Regex patterns for loan-specific requests (loan numbers in titles)
const loanNumberPattern = /\b(r[a-z]{2}\d{7,}|0\d{9}|\d{10,}|loan\s*#?\s*\d+)/i;

const categories = {};
const categoryExamples = {};

servicingTickets.forEach(t => {
  const title = (t.title || '').toLowerCase();
  let matched = false;
  for (const [cat, terms] of Object.entries(keywords)) {
    if (terms.some(term => title.includes(term))) {
      categories[cat] = (categories[cat] || 0) + 1;
      if (!categoryExamples[cat]) categoryExamples[cat] = [];
      if (categoryExamples[cat].length < 3) categoryExamples[cat].push(t.title?.slice(0, 80));
      matched = true;
      break;
    }
  }
  // Check for loan-specific requests (loan number in title)
  if (!matched && loanNumberPattern.test(t.title || '')) {
    categories['Loan-Specific Inquiry'] = (categories['Loan-Specific Inquiry'] || 0) + 1;
    if (!categoryExamples['Loan-Specific Inquiry']) categoryExamples['Loan-Specific Inquiry'] = [];
    if (categoryExamples['Loan-Specific Inquiry'].length < 3) categoryExamples['Loan-Specific Inquiry'].push(t.title?.slice(0, 80));
    matched = true;
  }
  if (!matched) {
    categories['Other'] = (categories['Other'] || 0) + 1;
    if (!categoryExamples['Other']) categoryExamples['Other'] = [];
    if (categoryExamples['Other'].length < 5) categoryExamples['Other'].push(t.title?.slice(0, 80));
  }
});

console.log('\n=== CATEGORIES (based on title keywords) ===');
Object.entries(categories)
  .sort((a, b) => b[1] - a[1])
  .forEach(([c, n]) => {
    console.log(`\n${c}: ${n.toLocaleString()} tickets (${Math.round(n / servicingTickets.length * 100)}%)`);
    if (categoryExamples[c]) {
      categoryExamples[c].forEach(ex => console.log(`    • ${ex}`));
    }
  });

// Analyze by month
console.log('\n=== BY MONTH ===');
const byMonth = {};
servicingTickets.forEach(t => {
  if (t.created) {
    const month = t.created.slice(0, 7);
    byMonth[month] = (byMonth[month] || 0) + 1;
  }
});
Object.entries(byMonth).sort().forEach(([m, c]) => console.log(`  ${m}: ${c.toLocaleString()}`));

// Analyze by week
console.log('\n=== BY WEEK (last 8 weeks) ===');
const byWeek = {};
servicingTickets.forEach(t => {
  if (t.created) {
    const date = new Date(t.created);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().slice(0, 10);
    byWeek[weekKey] = (byWeek[weekKey] || 0) + 1;
  }
});
Object.entries(byWeek).sort().slice(-8).forEach(([w, c]) => console.log(`  Week of ${w}: ${c.toLocaleString()}`));

// Status breakdown
console.log('\n=== BY STATUS ===');
const byStatus = {};
servicingTickets.forEach(t => {
  byStatus[t.status || 'Unknown'] = (byStatus[t.status || 'Unknown'] || 0) + 1;
});
Object.entries(byStatus).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => console.log(`  ${s}: ${c.toLocaleString()}`));

// Deep analysis of "Other" category to find patterns
console.log('\n=== ANALYZING "OTHER" CATEGORY ===');
const otherTickets = servicingTickets.filter(t => {
  const title = (t.title || '').toLowerCase();
  for (const terms of Object.values(keywords)) {
    if (terms.some(term => title.includes(term))) return false;
  }
  return true;
});

// Find common words in Other titles
const wordCounts = {};
otherTickets.forEach(t => {
  const words = (t.title || '').toLowerCase().split(/\s+/);
  words.forEach(w => {
    if (w.length > 3 && !['loan', 'the', 'and', 'for', 'from', 'with', 'this', 'that', 'fwd:', 'fwd', 'loan#'].includes(w)) {
      wordCounts[w] = (wordCounts[w] || 0) + 1;
    }
  });
});

console.log('\nMost common words in "Other" tickets:');
Object.entries(wordCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30)
  .forEach(([w, c]) => console.log(`  ${w}: ${c}`));

console.log('\nSample "Other" ticket titles (first 20):');
otherTickets.slice(0, 20).forEach(t => console.log(`  • ${t.title?.slice(0, 100)}`));
