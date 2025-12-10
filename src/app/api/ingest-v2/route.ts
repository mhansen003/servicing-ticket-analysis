// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import prisma from '@/lib/db';
import { categorizeText, detectCustomerIntent, detectAllIssues } from '@/lib/categorization';
import { analyzeTranscript, parseConversation, normalizeSpeakerLabels } from '@/lib/transcript-analysis';

/**
 * PHASE 1: Enhanced Data Ingestion API
 *
 * POST /api/ingest-v2
 *
 * Features:
 * - Multi-level categorization with subcategories
 * - Confidence scoring
 * - Multi-issue tagging
 * - Transcript analysis (sentiment, resolution, quality)
 * - Database storage via Prisma
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

const SERVICING_PROJECTS = [
  'Servicing Help',
  'Servicing Escalations WG',
  'ServApp Support',
  'CMG Servicing Oversight',
];

/**
 * Process and store tickets with enhanced categorization
 */
async function processTickets(data: any[], mode: 'append' | 'replace'): Promise<IngestResponse> {
  let recordsProcessed = 0;
  let recordsAdded = 0;
  let recordsUpdated = 0;
  const errors: string[] = [];

  // If replace mode, we would delete all existing tickets first
  // For now, we'll just use upsert which will update or create

  for (const ticketData of data) {
    recordsProcessed++;

    try {
      // Validate required fields
      if (!ticketData.ticket_key && !ticketData.ticket_uuid) {
        errors.push(`Row ${recordsProcessed}: Missing ticket_key or ticket_uuid`);
        continue;
      }
      if (!ticketData.ticket_created_at_utc) {
        errors.push(`Row ${recordsProcessed}: Missing ticket_created_at_utc`);
        continue;
      }

      // Filter to servicing projects only
      if (ticketData.project_name && !SERVICING_PROJECTS.includes(ticketData.project_name)) {
        continue;
      }

      // Enhanced categorization
      const categoryResult = categorizeText(
        ticketData.ticket_description || '',
        ticketData.ticket_title || ''
      );

      // Detect all issues
      const allIssues = detectAllIssues(`${ticketData.ticket_title || ''} ${ticketData.ticket_description || ''}`);

      // Prepare ticket data
      const ticketKey = ticketData.ticket_key || ticketData.ticket_uuid;

      const ticket = {
        ticketKey: ticketKey,
        ticketUuid: ticketData.ticket_uuid,
        ticketTitle: ticketData.ticket_title,
        ticketDescription: ticketData.ticket_description,
        ticketPriority: ticketData.ticket_priority,
        ticketStatus: ticketData.ticket_status,
        ticketType: ticketData.ticket_type,

        // Organization
        orgId: ticketData.org_id,
        orgName: ticketData.org_name,
        orgStatusId: ticketData.org_status_id,
        orgStatusName: ticketData.org_status_name,
        projectName: ticketData.project_name,

        // Reporter
        ticketReporterEmail: ticketData.ticket_reporter_email,
        ticketReporterName: ticketData.ticket_reporter_name,

        // Assignment
        assignedUserName: ticketData.assigned_user_name,
        assignedUserEmail: ticketData.assigned_user_email,

        // Response tracking
        firstResponseSentUtc: ticketData.first_response_sent_utc ? new Date(ticketData.first_response_sent_utc) : null,
        timeToFirstResponseInMinutes: ticketData.time_to_first_response_in_minutes ? parseInt(ticketData.time_to_first_response_in_minutes) : null,
        firstResponderEmail: ticketData.first_responder_email,
        firstResponderName: ticketData.first_responder_name,
        latestResponseSentUtc: ticketData.latest_response_sent_utc ? new Date(ticketData.latest_response_sent_utc) : null,
        latestResponderEmail: ticketData.latest_responder_email,
        latestResponderName: ticketData.latest_responder_name,

        // SLA
        dueDateUtc: ticketData.due_date_utc ? new Date(ticketData.due_date_utc) : null,
        slaEverBreached: ticketData.sla_ever_breached === 'true' || ticketData.sla_ever_breached === true,
        firstSlaBreachedAtUtc: ticketData.first_sla_breached_at_utc ? new Date(ticketData.first_sla_breached_at_utc) : null,
        latestSlaBreachedAtUtc: ticketData.latest_sla_breached_at_utc ? new Date(ticketData.latest_sla_breached_at_utc) : null,

        // Deletion
        deletedAt: ticketData.deleted_at ? new Date(ticketData.deleted_at) : null,
        deleteReasonName: ticketData.delete_reason_name,

        // Completion
        isTicketComplete: ticketData.is_ticket_complete === 'true' || ticketData.is_ticket_complete === true,
        ticketCompletedAtUtc: ticketData.ticket_completed_at_utc ? new Date(ticketData.ticket_completed_at_utc) : null,
        timeToResolutionInMinutes: ticketData.time_to_resolution_in_minutes ? parseInt(ticketData.time_to_resolution_in_minutes) : null,
        assignedUserEmailWhenTicketCompleted: ticketData.assigned_user_email_when_ticket_completed,
        assignedUserNameWhenTicketCompleted: ticketData.assigned_user_name_when_ticket_completed,

        // Metadata
        ticketTags: ticketData.ticket_tags,
        customFields: ticketData.custom_fields,

        // PHASE 1: Enhanced Categorization
        category: categoryResult.category,
        subcategory: categoryResult.subcategory,
        allIssues: allIssues.join('|'),
        categorizationConfidence: categoryResult.confidence,

        // Timestamps
        ticketCreatedAtUtc: new Date(ticketData.ticket_created_at_utc),
        ticketUpdatedAtUtc: ticketData.ticket_updated_at_utc ? new Date(ticketData.ticket_updated_at_utc) : null,
      };

      // Upsert ticket
      const result = await prisma.ticket.upsert({
        where: { ticketKey: ticketKey },
        update: ticket,
        create: ticket,
      });

      if (result) {
        // Check if it was a create or update (this is a simplification)
        recordsAdded++;
      }
    } catch (error) {
      errors.push(`Row ${recordsProcessed}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get total count
  const totalRecords = await prisma.ticket.count();

  return {
    success: true,
    message: `Successfully processed ${recordsProcessed} ticket records`,
    stats: {
      recordsProcessed,
      recordsAdded,
      recordsUpdated,
      totalRecords,
    },
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Process and store transcripts with full analysis
 */
async function processTranscripts(data: any[], mode: 'append' | 'replace'): Promise<IngestResponse> {
  let recordsProcessed = 0;
  let recordsAdded = 0;
  let recordsUpdated = 0;
  const errors: string[] = [];

  for (const transcriptData of data) {
    recordsProcessed++;

    try {
      // Validate required fields
      if (!transcriptData.vendorCallKey && !transcriptData.id) {
        errors.push(`Row ${recordsProcessed}: Missing vendorCallKey or id`);
        continue;
      }

      const vendorCallKey = transcriptData.vendorCallKey || transcriptData.id;

      // Build transcript text from conversation array
      let transcriptText = '';
      let conversation = null;

      if (transcriptData.conversation && Array.isArray(transcriptData.conversation)) {
        // Structured conversation
        conversation = transcriptData.conversation;
        transcriptText = conversation.map((msg: any) =>
          `${msg.role}: ${msg.text}`
        ).join('\n');
      } else if (transcriptData.transcriptText || transcriptData.transcript_text) {
        // Plain text transcript
        transcriptText = transcriptData.transcriptText || transcriptData.transcript_text;
        // Parse into conversation structure
        const parsed = parseConversation(transcriptText);
        conversation = parsed;
      } else {
        errors.push(`Row ${recordsProcessed}: Missing transcript text or conversation`);
        continue;
      }

      // Normalize transcript text
      const normalizedText = normalizeSpeakerLabels(transcriptText);

      // Run full transcript analysis
      const analysis = analyzeTranscript(normalizedText, transcriptData.durationSeconds || transcriptData.duration_seconds);

      // Enhanced categorization
      const categoryResult = categorizeText(normalizedText);

      // Detect customer intent
      const customerIntent = detectCustomerIntent(normalizedText);

      // Prepare transcript data
      const transcript = {
        vendorCallKey: vendorCallKey,

        // Call metadata
        callDate: transcriptData.callDate || transcriptData.call_date ? new Date(transcriptData.callDate || transcriptData.call_date) : null,
        callStart: transcriptData.callStart || transcriptData.call_start ? new Date(transcriptData.callStart || transcriptData.call_start) : null,
        callEnd: transcriptData.callEnd || transcriptData.call_end ? new Date(transcriptData.callEnd || transcriptData.call_end) : null,
        durationSeconds: transcriptData.durationSeconds || transcriptData.duration_seconds || null,

        // Agent information
        agentName: transcriptData.agentName || transcriptData.agent_name,
        agentId: transcriptData.agentId || transcriptData.agent_id,
        agentEmail: transcriptData.agentEmail || transcriptData.agent_email,
        agentRole: transcriptData.agentRole || transcriptData.agent_role,
        department: transcriptData.department,

        // Customer information
        customerId: transcriptData.customerId || transcriptData.customer_id,
        customerName: transcriptData.customerName || transcriptData.customer_name,

        // Transcript content
        transcriptText: normalizedText,
        conversation: conversation,

        // Call metrics from analysis
        numberOfHolds: transcriptData.numberOfHolds || transcriptData.number_of_holds || 0,
        holdDuration: transcriptData.holdDuration || transcriptData.hold_duration || 0,
        messageCount: analysis.totalMessages,
        customerMessages: analysis.customerMessages,
        agentMessages: analysis.agentMessages,
        agentTurns: analysis.agentTurns,
        customerTurns: analysis.customerTurns,

        // PHASE 1: Enhanced Categorization
        category: categoryResult.category,
        subcategory: categoryResult.subcategory,
        allIssues: categoryResult.allIssues.join('|'),
        categorizationConfidence: categoryResult.confidence,

        // Sentiment analysis
        sentiment: analysis.overallSentiment,
        sentimentScore: analysis.sentimentScore,
        customerSentiment: analysis.customerSentiment,
        customerSentimentScore: analysis.customerSentimentScore,
        agentSentiment: null, // Can be added later
        agentSentimentScore: null,

        // Resolution tracking
        resolutionStatus: analysis.resolutionStatus,
        wasResolved: analysis.wasResolved,
        wasEscalated: analysis.wasEscalated,
        requiresFollowup: analysis.requiresFollowup,
        escalationReason: analysis.escalationReason,

        // Intent & Topic detection
        customerIntent: customerIntent,
        detectedTopics: JSON.stringify(analysis.detectedTopics),
        primaryTopic: analysis.primaryTopic,

        // Quality metrics
        callQualityScore: analysis.callQualityScore,
        transcriptQuality: analysis.transcriptQuality,

        // Status
        status: transcriptData.status,
        disposition: transcriptData.disposition,

        // Metadata
        csatScore: transcriptData.csatScore || transcriptData.csat_score || null,
        queue: transcriptData.queue,
        callReason: transcriptData.callReason || transcriptData.call_reason,
        resolutionCode: transcriptData.resolutionCode || transcriptData.resolution_code,
      };

      // Upsert transcript
      const result = await prisma.transcript.upsert({
        where: { vendorCallKey: vendorCallKey },
        update: transcript,
        create: transcript,
      });

      if (result) {
        recordsAdded++;
      }
    } catch (error) {
      console.error('Error processing transcript:', error);
      errors.push(`Row ${recordsProcessed}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get total count
  const totalRecords = await prisma.transcript.count();

  return {
    success: true,
    message: `Successfully processed ${recordsProcessed} transcript records`,
    stats: {
      recordsProcessed,
      recordsAdded,
      recordsUpdated,
      totalRecords,
    },
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * GET handler - API documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/ingest-v2',
    version: '2.0',
    status: 'active',
    description: 'Enhanced data ingestion API with multi-level categorization, sentiment analysis, and quality metrics',
    features: [
      'Multi-level categorization (category + subcategory)',
      'Confidence scoring (0.0 - 1.0)',
      'Multi-issue tagging',
      'Transcript analysis (sentiment, resolution, quality)',
      'Speaker turn counting',
      'Customer intent detection',
      'Topic detection',
      'Database storage via Prisma',
    ],
    methods: ['POST'],
    example: {
      tickets: {
        type: 'tickets',
        format: 'json',
        mode: 'append',
        data: [
          {
            ticket_key: 'SH-12345',
            ticket_title: 'Payment Issue',
            ticket_description: 'Customer cannot make first payment',
            ticket_created_at_utc: '2024-12-04T10:00:00.000Z',
            project_name: 'Servicing Help',
          },
        ],
      },
      transcripts: {
        type: 'transcripts',
        format: 'json',
        mode: 'append',
        data: [
          {
            vendorCallKey: 'CALL-001',
            agentName: 'Smith, John',
            callDate: '2024-12-04',
            durationSeconds: 300,
            conversation: [
              { role: 'agent', text: 'Hello, how can I help you?' },
              { role: 'customer', text: 'I need to make my payment.' },
            ],
          },
        ],
      },
    },
  });
}

/**
 * POST handler - Process data
 */
export async function POST(request: NextRequest) {
  // NOTE: This endpoint is disabled - database schema has changed
  // Use scripts/load-transcripts.mjs instead
  return NextResponse.json(
    { success: false, message: 'This endpoint is disabled. Database schema has changed to use transcripts table. Use scripts/load-transcripts.mjs instead.' },
    { status: 410 }
  );

  /*
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
    if (body.format === 'csv' && typeof body.data === 'string') {
      const result = Papa.parse(body.data, { header: true, skipEmptyLines: true });
      parsedData = result.data as any[];
    } else if (body.format === 'json' && Array.isArray(body.data)) {
      parsedData = body.data;
    } else {
      return NextResponse.json(
        { success: false, message: 'Invalid data format' },
        { status: 400 }
      );
    }

    // Process based on type
    let response: IngestResponse;
    if (body.type === 'tickets') {
      response = await processTickets(parsedData, mode);
    } else {
      response = await processTranscripts(parsedData, mode);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Ingestion error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error processing data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
  */
}
