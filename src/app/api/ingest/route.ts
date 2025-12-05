import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';

/**
 * Data Ingestion API Endpoint
 *
 * Accepts CSV or JSON data for tickets and transcripts
 * Automatically processes and regenerates analytics
 *
 * POST /api/ingest
 * Body: {
 *   type: 'tickets' | 'transcripts',
 *   data: string (CSV) | object[] (JSON),
 *   format: 'csv' | 'json',
 *   mode: 'append' | 'replace'
 * }
 */

interface IngestRequest {
  type: 'tickets' | 'transcripts';
  data: string | any[];
  format: 'csv' | 'json';
  mode?: 'append' | 'replace';
}

interface IngestResponse {
  success: boolean;
  message: string;
  stats?: {
    recordsProcessed: number;
    recordsAdded: number;
    recordsUpdated: number;
    totalRecords: number;
  };
  errors?: string[];
}

// Servicing projects to include
const SERVICING_PROJECTS = [
  'Servicing Help',
  'Servicing Escalations WG',
  'ServApp Support',
  'CMG Servicing Oversight'
];

// Valid categories for auto-categorization
const VALID_CATEGORIES = [
  'Automated System Messages',
  'Payment Issues',
  'Escrow',
  'Documentation',
  'Transfer/Boarding',
  'Voice/Alert Requests',
  'Account Access',
  'Loan Info Request',
  'Insurance/Coverage',
  'Loan Changes',
  'Complaints/Escalations',
  'General Inquiry',
  'Communication/Forwarded',
  'Loan-Specific Inquiry',
  'Other',
];

/**
 * Categorize a ticket based on title and description
 */
function categorizeTicket(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();

  if (text.includes('automated') || text.includes('system message')) {
    return 'Automated System Messages';
  }
  if (text.includes('payment') || text.includes('pay ')) {
    return 'Payment Issues';
  }
  if (text.includes('escrow')) {
    return 'Escrow';
  }
  if (text.includes('document') || text.includes('statement')) {
    return 'Documentation';
  }
  if (text.includes('transfer') || text.includes('boarding')) {
    return 'Transfer/Boarding';
  }
  if (text.includes('voice') || text.includes('alert')) {
    return 'Voice/Alert Requests';
  }
  if (text.includes('access') || text.includes('login')) {
    return 'Account Access';
  }
  if (text.includes('loan info') || text.includes('information')) {
    return 'Loan Info Request';
  }
  if (text.includes('insurance') || text.includes('coverage')) {
    return 'Insurance/Coverage';
  }
  if (text.includes('loan change') || text.includes('modification')) {
    return 'Loan Changes';
  }
  if (text.includes('complaint') || text.includes('escalation')) {
    return 'Complaints/Escalations';
  }
  if (text.includes('inquiry') || text.includes('question')) {
    return 'General Inquiry';
  }
  if (text.includes('forward') || text.includes('communication')) {
    return 'Communication/Forwarded';
  }

  return 'Other';
}

/**
 * Process and validate ticket data
 */
async function processTickets(data: any[], mode: 'append' | 'replace'): Promise<IngestResponse> {
  const dataDir = path.join(process.cwd(), 'data');
  const csvPath = path.join(dataDir, 'tickets.csv');

  // Ensure data directory exists
  await fs.mkdir(dataDir, { recursive: true });

  let existingTickets: any[] = [];
  let recordsProcessed = 0;
  let recordsAdded = 0;
  let recordsUpdated = 0;
  const errors: string[] = [];

  // Load existing tickets if appending
  if (mode === 'append') {
    try {
      if (await fs.access(csvPath).then(() => true).catch(() => false)) {
        const csvContent = await fs.readFile(csvPath, 'utf-8');
        const result = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
        existingTickets = result.data;
      }
    } catch (error) {
      console.error('Error loading existing tickets:', error);
    }
  }

  // Create a map of existing tickets by ID
  const existingMap = new Map(existingTickets.map(t => [t.ticket_uuid || t.ticket_key, t]));

  // Process new tickets
  const processedTickets: any[] = [];

  for (const ticket of data) {
    recordsProcessed++;

    try {
      // Validate required fields
      if (!ticket.ticket_key && !ticket.ticket_uuid) {
        errors.push(`Row ${recordsProcessed}: Missing ticket_key or ticket_uuid`);
        continue;
      }
      if (!ticket.ticket_created_at_utc) {
        errors.push(`Row ${recordsProcessed}: Missing ticket_created_at_utc`);
        continue;
      }

      // Filter to servicing projects only
      if (!SERVICING_PROJECTS.includes(ticket.project_name)) {
        continue;
      }

      const ticketId = ticket.ticket_uuid || ticket.ticket_key;

      // Auto-categorize if category not provided
      if (!ticket.category) {
        ticket.category = categorizeTicket(
          ticket.ticket_title || '',
          ticket.ticket_description || ''
        );
      }

      // Check if updating existing ticket
      if (existingMap.has(ticketId)) {
        recordsUpdated++;
        existingMap.set(ticketId, { ...existingMap.get(ticketId), ...ticket });
      } else {
        recordsAdded++;
        existingMap.set(ticketId, ticket);
      }
    } catch (error) {
      errors.push(`Row ${recordsProcessed}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Convert map back to array
  const allTickets = Array.from(existingMap.values());

  // Write updated tickets to CSV
  const csv = Papa.unparse(allTickets, { header: true });
  await fs.writeFile(csvPath, csv, 'utf-8');

  // Trigger rebuild of processed stats
  try {
    const { execSync } = require('child_process');
    execSync('node scripts/prebuild.js', { cwd: process.cwd() });
  } catch (error) {
    console.error('Error rebuilding stats:', error);
    errors.push('Failed to regenerate analytics');
  }

  return {
    success: true,
    message: `Successfully processed ${recordsProcessed} records`,
    stats: {
      recordsProcessed,
      recordsAdded,
      recordsUpdated,
      totalRecords: allTickets.length,
    },
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Process and validate transcript data
 */
async function processTranscripts(data: any[], mode: 'append' | 'replace'): Promise<IngestResponse> {
  const publicDataDir = path.join(process.cwd(), 'public', 'data');

  // Ensure data directory exists
  await fs.mkdir(publicDataDir, { recursive: true });

  let recordsProcessed = 0;
  let recordsAdded = 0;
  const errors: string[] = [];

  // Load existing transcripts if appending
  let existingTranscripts: any[] = [];
  if (mode === 'append') {
    try {
      const statsPath = path.join(publicDataDir, 'transcript-analysis.json');
      if (await fs.access(statsPath).then(() => true).catch(() => false)) {
        const content = await fs.readFile(statsPath, 'utf-8');
        existingTranscripts = JSON.parse(content);
      }
    } catch (error) {
      console.error('Error loading existing transcripts:', error);
    }
  }

  // Create a map by call ID
  const transcriptMap = new Map(existingTranscripts.map(t => [t.vendorCallKey || t.id, t]));

  // Process new transcripts
  for (const transcript of data) {
    recordsProcessed++;

    try {
      // Validate required fields
      if (!transcript.vendorCallKey && !transcript.id) {
        errors.push(`Row ${recordsProcessed}: Missing vendorCallKey or id`);
        continue;
      }
      if (!transcript.agentName) {
        errors.push(`Row ${recordsProcessed}: Missing agentName`);
        continue;
      }
      if (!transcript.conversation || !Array.isArray(transcript.conversation)) {
        errors.push(`Row ${recordsProcessed}: Invalid or missing conversation data`);
        continue;
      }

      const callId = transcript.vendorCallKey || transcript.id;

      // Add or update transcript
      if (!transcriptMap.has(callId)) {
        recordsAdded++;
      }
      transcriptMap.set(callId, transcript);
    } catch (error) {
      errors.push(`Row ${recordsProcessed}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Convert map back to array
  const allTranscripts = Array.from(transcriptMap.values());

  // Write updated transcripts
  const analysisPath = path.join(publicDataDir, 'transcript-analysis.json');
  await fs.writeFile(analysisPath, JSON.stringify(allTranscripts, null, 2), 'utf-8');

  // Regenerate transcript stats and other derived files
  // This would call your transcript processing script
  try {
    // Note: You'll need to create a transcript processing script
    // For now, we'll just update the main file
    console.log('Transcript data updated. Stats regeneration may be needed.');
  } catch (error) {
    console.error('Error regenerating transcript stats:', error);
    errors.push('Failed to regenerate transcript analytics');
  }

  return {
    success: true,
    message: `Successfully processed ${recordsProcessed} transcript records`,
    stats: {
      recordsProcessed,
      recordsAdded,
      recordsUpdated: recordsProcessed - recordsAdded,
      totalRecords: allTranscripts.length,
    },
    errors: errors.length > 0 ? errors : undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: IngestRequest = await request.json();

    // Validate request
    if (!body.type || !['tickets', 'transcripts'].includes(body.type)) {
      return NextResponse.json(
        { success: false, message: 'Invalid type. Must be "tickets" or "transcripts"' },
        { status: 400 }
      );
    }

    if (!body.data) {
      return NextResponse.json(
        { success: false, message: 'Missing data field' },
        { status: 400 }
      );
    }

    if (!body.format || !['csv', 'json'].includes(body.format)) {
      return NextResponse.json(
        { success: false, message: 'Invalid format. Must be "csv" or "json"' },
        { status: 400 }
      );
    }

    const mode = body.mode || 'append';

    // Parse data if CSV
    let parsedData: any[] = [];
    if (body.format === 'csv') {
      if (typeof body.data !== 'string') {
        return NextResponse.json(
          { success: false, message: 'CSV data must be a string' },
          { status: 400 }
        );
      }

      const result = Papa.parse(body.data, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false, // Keep all fields as strings to prevent type conversion issues
      });

      if (result.errors.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: 'CSV parsing errors',
            errors: result.errors.map(e => e.message),
          },
          { status: 400 }
        );
      }

      parsedData = result.data;
    } else {
      // JSON format
      if (!Array.isArray(body.data)) {
        return NextResponse.json(
          { success: false, message: 'JSON data must be an array' },
          { status: 400 }
        );
      }
      parsedData = body.data;
    }

    // Process based on type
    let result: IngestResponse;
    if (body.type === 'tickets') {
      result = await processTickets(parsedData, mode);
    } else {
      result = await processTranscripts(parsedData, mode);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in ingest endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check API status
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/ingest',
    status: 'active',
    description: 'Data ingestion API for tickets and transcripts',
    methods: ['POST'],
    example: {
      type: 'tickets',
      format: 'json',
      mode: 'append',
      data: [
        {
          ticket_key: 'SH-12345',
          ticket_uuid: 'abc-123',
          ticket_title: 'Sample Ticket',
          ticket_created_at_utc: '2024-12-04T10:00:00.000Z',
          project_name: 'Servicing Help',
          // ... other fields
        },
      ],
    },
  });
}
