/**
 * Generate Sample Data for Testing New Features
 *
 * This creates realistic sample transcripts that will populate
 * the Categories and Trends tabs immediately.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sampleTranscripts = [
  // Payment Issues - First Payment
  {
    vendorCallKey: 'SAMPLE-001',
    agentName: 'Smith, John',
    callDate: '2025-11-01',
    durationSeconds: 245,
    department: 'Servicing',
    conversation: [
      { role: 'agent', text: 'Thank you for calling. How can I help you today?' },
      { role: 'customer', text: 'Hi, I just closed on my home loan and I need to make my first payment. Where do I send it?' },
      { role: 'agent', text: 'Congratulations on your new home! You can make your payment online at our website or mail it to PO Box 12345.' },
      { role: 'customer', text: 'Perfect, thank you so much!' },
    ],
  },

  // Account Access - Password Issues
  {
    vendorCallKey: 'SAMPLE-002',
    agentName: 'Doe, Jane',
    callDate: '2025-11-05',
    durationSeconds: 356,
    department: 'Servicing',
    conversation: [
      { role: 'agent', text: 'Good morning, this is Jane. How may I assist you?' },
      { role: 'customer', text: 'I am trying to log in to my account but it says my password is wrong.' },
      { role: 'agent', text: 'I can help you reset that. What email do you have on file?' },
      { role: 'customer', text: 'It is customer@email.com.' },
      { role: 'agent', text: 'Okay, I have sent you a password reset link.' },
      { role: 'customer', text: 'Got it! Thank you!' },
    ],
  },

  // Loan Transfer - Post-Transfer Confusion
  {
    vendorCallKey: 'SAMPLE-003',
    agentName: 'Johnson, Mike',
    callDate: '2025-11-10',
    durationSeconds: 523,
    department: 'Servicing',
    conversation: [
      { role: 'agent', text: 'Thank you for calling. How can I help?' },
      { role: 'customer', text: 'I received a letter saying my loan was transferred but I do not know where to make my payment now.' },
      { role: 'agent', text: 'Your loan was transferred to ServiceMac. The payment address is on the letter you received.' },
      { role: 'customer', text: 'I did not receive any letter!' },
      { role: 'agent', text: 'I understand your frustration. Let me send you another copy right now to your email.' },
      { role: 'customer', text: 'Please do. This is very frustrating.' },
      { role: 'agent', text: 'I am sending it now. You should receive it within a few minutes.' },
    ],
  },

  // Document Request - Payoff Statement
  {
    vendorCallKey: 'SAMPLE-004',
    agentName: 'Williams, Sarah',
    callDate: '2025-11-15',
    durationSeconds: 198,
    department: 'Servicing',
    conversation: [
      { role: 'agent', text: 'Hello, how can I help you today?' },
      { role: 'customer', text: 'I need a payoff quote. We are refinancing.' },
      { role: 'agent', text: 'I can help with that. When do you need it by?' },
      { role: 'customer', text: 'We close on December 1st.' },
      { role: 'agent', text: 'Perfect. I will send the payoff statement to your email today.' },
      { role: 'customer', text: 'Thank you!' },
    ],
  },

  // Escalation - Customer Complaint
  {
    vendorCallKey: 'SAMPLE-005',
    agentName: 'Brown, Tom',
    callDate: '2025-11-20',
    durationSeconds: 687,
    department: 'Servicing',
    conversation: [
      { role: 'agent', text: 'Good afternoon, this is Tom. How can I assist you?' },
      { role: 'customer', text: 'I have been calling for three weeks about a payment issue and nobody has called me back!' },
      { role: 'agent', text: 'I sincerely apologize for that experience. Let me look into your account right now.' },
      { role: 'customer', text: 'This is completely unacceptable. I want to speak to a supervisor!' },
      { role: 'agent', text: 'I completely understand. Let me transfer you to my supervisor right away.' },
    ],
  },

  // Payment Issues - Payment Failure
  {
    vendorCallKey: 'SAMPLE-006',
    agentName: 'Davis, Lisa',
    callDate: '2025-11-25',
    durationSeconds: 412,
    department: 'Servicing',
    conversation: [
      { role: 'agent', text: 'Thank you for calling. How can I help?' },
      { role: 'customer', text: 'My payment did not go through and I got a declined message.' },
      { role: 'agent', text: 'Let me check your account. It looks like there were insufficient funds.' },
      { role: 'customer', text: 'That cannot be right. Let me check my bank.' },
      { role: 'agent', text: 'Take your time. I will wait.' },
      { role: 'customer', text: 'You are right. My apologies. I will transfer funds and try again.' },
    ],
  },

  // Escrow - Escrow Analysis
  {
    vendorCallKey: 'SAMPLE-007',
    agentName: 'Miller, Bob',
    callDate: '2025-11-28',
    durationSeconds: 534,
    department: 'Servicing',
    conversation: [
      { role: 'agent', text: 'Good morning, how may I help you?' },
      { role: 'customer', text: 'I got a letter about an escrow shortage. What does that mean?' },
      { role: 'agent', text: 'Your escrow analysis showed that your property taxes increased. You have a shortage of $450.' },
      { role: 'customer', text: 'Do I need to pay that all at once?' },
      { role: 'agent', text: 'You can either pay it now or spread it over 12 months with a payment increase.' },
      { role: 'customer', text: 'I will spread it out. Thank you for explaining.' },
    ],
  },

  // Account Access - Account Locked
  {
    vendorCallKey: 'SAMPLE-008',
    agentName: 'Wilson, Amy',
    callDate: '2025-12-01',
    durationSeconds: 289,
    department: 'Servicing',
    conversation: [
      { role: 'agent', text: 'Hello, this is Amy. How can I assist?' },
      { role: 'customer', text: 'My account is locked after too many login attempts.' },
      { role: 'agent', text: 'I can unlock that for you right now. Please verify your address.' },
      { role: 'customer', text: '123 Main Street, Anytown USA.' },
      { role: 'agent', text: 'Perfect. Your account is now unlocked. Try logging in again.' },
      { role: 'customer', text: 'It works! Thank you!' },
    ],
  },

  // Payment Issues - Duplicate Payment
  {
    vendorCallKey: 'SAMPLE-009',
    agentName: 'Taylor, Chris',
    callDate: '2025-12-03',
    durationSeconds: 445,
    department: 'Servicing',
    conversation: [
      { role: 'agent', text: 'Thank you for calling. How can I help you today?' },
      { role: 'customer', text: 'I was charged twice for my payment this month!' },
      { role: 'agent', text: 'Let me check your account immediately.' },
      { role: 'customer', text: 'This better be fixed quickly.' },
      { role: 'agent', text: 'I see the duplicate payment. I will process a refund right now. It will take 3-5 business days.' },
      { role: 'customer', text: 'Okay, thank you for handling this.' },
    ],
  },

  // Document Request - Tax Documents
  {
    vendorCallKey: 'SAMPLE-010',
    agentName: 'Anderson, Kelly',
    callDate: '2025-12-05',
    durationSeconds: 178,
    department: 'Servicing',
    conversation: [
      { role: 'agent', text: 'Good afternoon, how can I help?' },
      { role: 'customer', text: 'I need my 1098 form for my taxes.' },
      { role: 'agent', text: 'Those will be mailed in January, but I can email you a copy now.' },
      { role: 'customer', text: 'That would be great!' },
      { role: 'agent', text: 'Sending it now to your email on file.' },
    ],
  },
];

async function generateSampleData() {
  console.log('🎲 Generating sample data...\n');

  // Save to JSON file
  const outputPath = path.join(process.cwd(), 'data', 'sample-transcripts.json');
  fs.writeFileSync(outputPath, JSON.stringify(sampleTranscripts, null, 2), 'utf-8');

  console.log(`✅ Generated ${sampleTranscripts.length} sample transcripts`);
  console.log(`📝 Saved to: ${outputPath}\n`);

  // Generate API call instructions
  console.log('📤 To import this data to your database:\n');
  console.log('Option 1: Local testing');
  console.log('-----------------------');
  console.log('1. Start dev server: npm run dev');
  console.log('2. Run this command:\n');

  const curlCommand = `curl -X POST http://localhost:3000/api/ingest-v2 \\
  -H "Content-Type: application/json" \\
  -d @data/sample-transcripts.json \\
  --data-binary '{"type": "transcripts", "format": "json", "mode": "append", "data": ${JSON.stringify(sampleTranscripts)}}'`;

  console.log(curlCommand);
  console.log('\n');

  console.log('Option 2: Production deployment');
  console.log('-------------------------------');
  console.log('Use the sample data in a POST request to:');
  console.log('https://your-app.vercel.app/api/ingest-v2\n');

  console.log('Option 3: Node.js script');
  console.log('------------------------');
  console.log('Run the import script:\n');
  console.log('node scripts/import-sample-data.mjs\n');

  // Create import script
  const importScript = `import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importSampleData() {
  const dataPath = path.join(process.cwd(), 'data', 'sample-transcripts.json');
  const transcripts = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  const response = await fetch('http://localhost:3000/api/ingest-v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'transcripts',
      format: 'json',
      mode: 'append',
      data: transcripts
    })
  });

  const result = await response.json();
  console.log('Import result:', result);
}

importSampleData().catch(console.error);
`;

  const importPath = path.join(process.cwd(), 'scripts', 'import-sample-data.mjs');
  fs.writeFileSync(importPath, importScript, 'utf-8');
  console.log(`📝 Created import script: ${importPath}\n`);

  // Show what categories will be created
  console.log('📊 This sample data includes:');
  console.log('   - 3 Payment Issues calls');
  console.log('   - 2 Account Access calls');
  console.log('   - 1 Loan Transfer call');
  console.log('   - 2 Document Requests');
  console.log('   - 1 Escalation call');
  console.log('   - 1 Escrow call\n');

  console.log('✨ After importing, you will see:');
  console.log('   ✅ Data in Categories tab');
  console.log('   ✅ Data in Trends tab');
  console.log('   ✅ Data in Transcripts tab');
  console.log('   ✅ Data in Agents tab\n');
}

generateSampleData().catch(console.error);
