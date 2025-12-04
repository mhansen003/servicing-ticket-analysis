import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

// Only include servicing-related projects
const SERVICING_PROJECTS = [
  'Servicing Help',
  'Servicing Escalations WG',
  'ServApp Support',
  'CMG Servicing Oversight',
];

// Category keywords for classification (must match prebuild.js exactly)
const CATEGORY_KEYWORDS: Record<string, string[]> = {
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
const LOAN_NUMBER_PATTERN = /\b(r[a-z]{2}\d{7,}|0\d{9}|\d{10,}|loan\s*#?\s*\d+)/i;

// Categorize a ticket title (same logic as prebuild.js)
function categorizeTicket(title: string | null): string {
  const lowerTitle = String(title || '').toLowerCase();
  for (const [cat, terms] of Object.entries(CATEGORY_KEYWORDS)) {
    if (terms.some(term => lowerTitle.includes(term))) {
      return cat;
    }
  }
  if (LOAN_NUMBER_PATTERN.test(String(title || ''))) {
    return 'Loan-Specific Inquiry';
  }
  return 'Other';
}

// Build SQL search terms for a category (to filter in DB)
function getCategorySearchTerms(category: string): string[] {
  return CATEGORY_KEYWORDS[category] || [];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
  const search = searchParams.get('search') || '';
  // Multi-select filters come as comma-separated values
  const statusParam = searchParams.get('status') || '';
  const projectParam = searchParams.get('project') || '';
  const priorityParam = searchParams.get('priority') || '';
  const assigneeParam = searchParams.get('assignee') || '';
  const category = searchParams.get('category') || ''; // Category filter for drill-down
  const sortField = searchParams.get('sortField') || 'ticketCreatedAtUtc';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  // Parse comma-separated multi-select values into arrays
  const statuses = statusParam ? statusParam.split(',').filter(Boolean) : [];
  const projects = projectParam ? projectParam.split(',').filter(Boolean) : [];
  const priorities = priorityParam ? priorityParam.split(',').filter(Boolean) : [];
  const assignees = assigneeParam ? assigneeParam.split(',').filter(Boolean) : [];

  try {
    // Build where clause - always filter to servicing projects
    const where: Prisma.TicketWhereInput = {
      projectName: { in: SERVICING_PROJECTS },
    };

    if (search) {
      where.OR = [
        { ticketTitle: { contains: search, mode: 'insensitive' } },
        { ticketKey: { contains: search, mode: 'insensitive' } },
        { assignedUserName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Category filter is handled post-query (see below) since categorization
    // uses order-dependent matching that SQL can't easily replicate
    const filterByCategory = category;

    // Multi-select filters use 'in' for multiple values
    if (statuses.length > 0) {
      where.ticketStatus = { in: statuses };
    }

    if (projects.length > 0) {
      // Override the servicing projects filter if specific projects selected
      where.projectName = { in: projects };
    }

    if (priorities.length > 0) {
      where.ticketPriority = { in: priorities };
    }

    if (assignees.length > 0) {
      where.assignedUserName = { in: assignees };
    }

    // Map frontend sort fields to database fields
    const sortFieldMap: Record<string, string> = {
      key: 'ticketKey',
      title: 'ticketTitle',
      status: 'ticketStatus',
      priority: 'ticketPriority',
      project: 'projectName',
      assignee: 'assignedUserName',
      created: 'ticketCreatedAtUtc',
      resolutionTime: 'timeToResolutionInMinutes',
    };

    const dbSortField = sortFieldMap[sortField] || 'ticketCreatedAtUtc';

    // For category filtering, we need to use raw SQL to compute categories
    // since categorization uses order-dependent keyword matching
    let tickets: Array<{
      id: bigint | number;
      ticketKey: string | null;
      ticketTitle: string | null;
      ticketStatus: string | null;
      ticketPriority: string | null;
      projectName: string | null;
      assignedUserName: string | null;
      ticketCreatedAtUtc: Date | null;
      timeToFirstResponseInMinutes: number | null;
      timeToResolutionInMinutes: number | null;
      isTicketComplete: boolean | null;
    }> = [];
    let total = 0;

    if (filterByCategory) {
      // Use raw SQL with computed category column for accurate filtering
      // The CASE expression matches the exact order and keywords from prebuild.js
      const sortColumn = dbSortField === 'ticketKey' ? 'ticket_key' :
        dbSortField === 'ticketTitle' ? 'ticket_title' :
        dbSortField === 'ticketStatus' ? 'ticket_status' :
        dbSortField === 'ticketPriority' ? 'ticket_priority' :
        dbSortField === 'projectName' ? 'project_name' :
        dbSortField === 'assignedUserName' ? 'assigned_user_name' :
        dbSortField === 'timeToResolutionInMinutes' ? 'time_to_resolution_in_minutes' :
        'ticket_created_at_utc';

      // Build category CASE expression that matches prebuild.js order exactly
      const categoryCase = `
        CASE
          WHEN LOWER(ticket_title) LIKE '%automatic reply%' OR LOWER(ticket_title) LIKE '%unmonitored mailbox%' OR LOWER(ticket_title) LIKE '%sagentsupport%' OR LOWER(ticket_title) LIKE '%auto-reply%' THEN 'Automated System Messages'
          WHEN LOWER(ticket_title) LIKE '%payment%' OR LOWER(ticket_title) LIKE '%pay %' OR LOWER(ticket_title) LIKE '%ach%' OR LOWER(ticket_title) LIKE '%autopay%' OR LOWER(ticket_title) LIKE '%draft%' OR LOWER(ticket_title) LIKE '%misapplied%' OR LOWER(ticket_title) LIKE '%overpayment%' OR LOWER(ticket_title) LIKE '%underpayment%' OR LOWER(ticket_title) LIKE '%double draft%' THEN 'Payment Issues'
          WHEN LOWER(ticket_title) LIKE '%escrow%' OR LOWER(ticket_title) LIKE '%tax bill%' OR LOWER(ticket_title) LIKE '%tax %' OR LOWER(ticket_title) LIKE '%insurance%' OR LOWER(ticket_title) LIKE '%hoi %' OR LOWER(ticket_title) LIKE '%pmi%' OR LOWER(ticket_title) LIKE '%shortage%' OR LOWER(ticket_title) LIKE '%surplus%' OR LOWER(ticket_title) LIKE '%flood%' OR LOWER(ticket_title) LIKE '%hazard%' THEN 'Escrow'
          WHEN LOWER(ticket_title) LIKE '%statement%' OR LOWER(ticket_title) LIKE '%letter%' OR LOWER(ticket_title) LIKE '%document%' OR LOWER(ticket_title) LIKE '%1098%' OR LOWER(ticket_title) LIKE '%payoff%' OR LOWER(ticket_title) LIKE '%release%' OR LOWER(ticket_title) LIKE '%mortgage release%' OR LOWER(ticket_title) LIKE '%amortization%' OR LOWER(ticket_title) LIKE '%confirmation%' THEN 'Documentation'
          WHEN LOWER(ticket_title) LIKE '%transfer%' OR LOWER(ticket_title) LIKE '%board%' OR LOWER(ticket_title) LIKE '%cenlar%' OR LOWER(ticket_title) LIKE '%sold%' OR LOWER(ticket_title) LIKE '%subservicer%' OR LOWER(ticket_title) LIKE '%lakeview%' OR LOWER(ticket_title) LIKE '%servicemac%' OR LOWER(ticket_title) LIKE '%notice of servicing%' THEN 'Transfer/Boarding'
          WHEN LOWER(ticket_title) LIKE '%voice mail%' OR LOWER(ticket_title) LIKE '%voicemail%' OR LOWER(ticket_title) LIKE '%alert%' OR LOWER(ticket_title) LIKE '%interim%' THEN 'Voice/Alert Requests'
          WHEN LOWER(ticket_title) LIKE '%login%' OR LOWER(ticket_title) LIKE '%password%' OR LOWER(ticket_title) LIKE '%access%' OR LOWER(ticket_title) LIKE '%portal%' OR LOWER(ticket_title) LIKE '%locked out%' OR LOWER(ticket_title) LIKE '%reset%' OR LOWER(ticket_title) LIKE '%website link%' OR LOWER(ticket_title) LIKE '%online%' THEN 'Account Access'
          WHEN LOWER(ticket_title) LIKE '%loan number%' OR LOWER(ticket_title) LIKE '%loan info%' OR LOWER(ticket_title) LIKE '%balance%' OR LOWER(ticket_title) LIKE '%rate%' OR LOWER(ticket_title) LIKE '%mailing address%' OR LOWER(ticket_title) LIKE '%wire%' OR LOWER(ticket_title) LIKE '%reimbursement%' THEN 'Loan Info Request'
          WHEN LOWER(ticket_title) LIKE '%mycoverageinfo%' OR LOWER(ticket_title) LIKE '%covius%' OR LOWER(ticket_title) LIKE '%coverage%' OR LOWER(ticket_title) LIKE '%policy%' THEN 'Insurance/Coverage'
          WHEN LOWER(ticket_title) LIKE '%recast%' OR LOWER(ticket_title) LIKE '%buyout%' OR LOWER(ticket_title) LIKE '%assumption%' OR LOWER(ticket_title) LIKE '%modification%' OR LOWER(ticket_title) LIKE '%forbearance%' OR LOWER(ticket_title) LIKE '%hardship%' OR LOWER(ticket_title) LIKE '%loss mitigation%' OR LOWER(ticket_title) LIKE '%deferment%' THEN 'Loan Changes'
          WHEN LOWER(ticket_title) LIKE '%complaint%' OR LOWER(ticket_title) LIKE '%escalat%' OR LOWER(ticket_title) LIKE '%elevated%' OR LOWER(ticket_title) LIKE '%urgent%' OR LOWER(ticket_title) LIKE '%mess%' OR LOWER(ticket_title) LIKE '%facebook%' OR LOWER(ticket_title) LIKE '%issue%' THEN 'Complaints/Escalations'
          WHEN LOWER(ticket_title) LIKE '%help%' OR LOWER(ticket_title) LIKE '%question%' OR LOWER(ticket_title) LIKE '%request%' OR LOWER(ticket_title) LIKE '%information%' OR LOWER(ticket_title) LIKE '%needed%' OR LOWER(ticket_title) LIKE '%assistance%' THEN 'General Inquiry'
          WHEN LOWER(ticket_title) LIKE '%fw:%' OR LOWER(ticket_title) LIKE '%fwd:%' OR LOWER(ticket_title) LIKE '%re:%' OR LOWER(ticket_title) LIKE '%follow up%' OR LOWER(ticket_title) LIKE '%call back%' THEN 'Communication/Forwarded'
          WHEN ticket_title ~ '(r[a-z]{2}[0-9]{7,}|0[0-9]{9}|[0-9]{10,}|loan\\s*#?\\s*[0-9]+)' THEN 'Loan-Specific Inquiry'
          ELSE 'Other'
        END
      `;

      const offset = (page - 1) * limit;

      // Count query with category filter
      const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM tickets
        WHERE project_name IN ('Servicing Help', 'Servicing Escalations WG', 'ServApp Support', 'CMG Servicing Oversight')
        AND (${Prisma.raw(categoryCase)}) = ${filterByCategory}
      `;
      total = Number(countResult[0].count);

      // Main query with pagination
      tickets = await prisma.$queryRaw`
        SELECT id, ticket_key as "ticketKey", ticket_title as "ticketTitle",
               ticket_status as "ticketStatus", ticket_priority as "ticketPriority",
               project_name as "projectName", assigned_user_name as "assignedUserName",
               ticket_created_at_utc as "ticketCreatedAtUtc",
               time_to_first_response_in_minutes as "timeToFirstResponseInMinutes",
               time_to_resolution_in_minutes as "timeToResolutionInMinutes",
               is_ticket_complete as "isTicketComplete"
        FROM tickets
        WHERE project_name IN ('Servicing Help', 'Servicing Escalations WG', 'ServApp Support', 'CMG Servicing Oversight')
        AND (${Prisma.raw(categoryCase)}) = ${filterByCategory}
        ORDER BY ${Prisma.raw(sortColumn)} ${Prisma.raw(sortOrder === 'desc' ? 'DESC' : 'ASC')}
        LIMIT ${limit} OFFSET ${offset}
      `;

    } else {
      // Standard Prisma query (no category filter)
      const [ticketResults, countResult] = await Promise.all([
        prisma.ticket.findMany({
          where,
          orderBy: { [dbSortField]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            ticketKey: true,
            ticketTitle: true,
            ticketStatus: true,
            ticketPriority: true,
            projectName: true,
            assignedUserName: true,
            ticketCreatedAtUtc: true,
            timeToFirstResponseInMinutes: true,
            timeToResolutionInMinutes: true,
            isTicketComplete: true,
          },
        }),
        prisma.ticket.count({ where }),
      ]);
      tickets = ticketResults;
      total = countResult;
    }

    // Get filter options (only on first page for performance)
    // All filter queries are scoped to servicing projects only
    let filterOptions = null;
    if (page === 1) {
      const servicingFilter = { projectName: { in: SERVICING_PROJECTS } };
      const [statuses, projects, priorities, assignees] = await Promise.all([
        prisma.ticket.groupBy({
          by: ['ticketStatus'],
          where: { ...servicingFilter, ticketStatus: { not: null } },
          orderBy: { _count: { ticketStatus: 'desc' } },
          take: 20,
        }),
        prisma.ticket.groupBy({
          by: ['projectName'],
          where: { ...servicingFilter, projectName: { not: null } },
          orderBy: { _count: { projectName: 'desc' } },
          take: 20,
        }),
        prisma.ticket.groupBy({
          by: ['ticketPriority'],
          where: { ...servicingFilter, ticketPriority: { not: null } },
          orderBy: { _count: { ticketPriority: 'desc' } },
        }),
        prisma.ticket.groupBy({
          by: ['assignedUserName'],
          where: { ...servicingFilter, assignedUserName: { not: null } },
          orderBy: { _count: { assignedUserName: 'desc' } },
          take: 100,
        }),
      ]);

      filterOptions = {
        statuses: statuses.map((s) => s.ticketStatus).filter(Boolean),
        projects: projects.map((p) => p.projectName).filter(Boolean),
        priorities: priorities.map((p) => p.ticketPriority).filter(Boolean),
        assignees: assignees.map((a) => a.assignedUserName).filter(Boolean),
      };
    }

    // Transform to frontend format
    const formattedTickets = tickets.map((t) => ({
      id: t.id.toString(),
      key: t.ticketKey,
      title: t.ticketTitle || '',
      status: t.ticketStatus || 'Unknown',
      priority: t.ticketPriority || 'Unknown',
      project: t.projectName || 'Unknown',
      assignee: t.assignedUserName || 'Unassigned',
      created: t.ticketCreatedAtUtc?.toISOString() || '',
      responseTime: t.timeToFirstResponseInMinutes,
      resolutionTime: t.timeToResolutionInMinutes,
      complete: t.isTicketComplete,
    }));

    return NextResponse.json({
      tickets: formattedTickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filterOptions,
    });
  } catch (error) {
    console.error('Error loading tickets:', error);
    return NextResponse.json({ error: 'Failed to load tickets' }, { status: 500 });
  }
}

// Group by endpoint
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { groupBy } = body;

    // Map frontend field names to database field names
    const fieldMap: Record<string, keyof Prisma.TicketGroupByOutputType> = {
      project: 'projectName',
      status: 'ticketStatus',
      priority: 'ticketPriority',
      assignee: 'assignedUserName',
    };

    const dbField = fieldMap[groupBy] || 'projectName';

    // Use raw SQL for better performance on aggregations
    // Filter to servicing projects only
    const result = await prisma.$queryRaw<
      Array<{
        name: string;
        count: bigint;
        completed: bigint;
        avg_resolution: number | null;
      }>
    >`
      SELECT
        ${Prisma.raw(dbField === 'projectName' ? 'project_name' : dbField === 'ticketStatus' ? 'ticket_status' : dbField === 'ticketPriority' ? 'ticket_priority' : 'assigned_user_name')} as name,
        COUNT(*) as count,
        SUM(CASE WHEN is_ticket_complete THEN 1 ELSE 0 END) as completed,
        AVG(time_to_resolution_in_minutes) / 60 as avg_resolution
      FROM tickets
      WHERE project_name IN ('Servicing Help', 'Servicing Escalations WG', 'ServApp Support', 'CMG Servicing Oversight')
        AND ${Prisma.raw(dbField === 'projectName' ? 'project_name' : dbField === 'ticketStatus' ? 'ticket_status' : dbField === 'ticketPriority' ? 'ticket_priority' : 'assigned_user_name')} IS NOT NULL
      GROUP BY ${Prisma.raw(dbField === 'projectName' ? 'project_name' : dbField === 'ticketStatus' ? 'ticket_status' : dbField === 'ticketPriority' ? 'ticket_priority' : 'assigned_user_name')}
      ORDER BY count DESC
      LIMIT 50
    `;

    const groups = result.map((r) => ({
      name: r.name || 'Unknown',
      count: Number(r.count),
      completed: Number(r.completed),
      avgResolution: r.avg_resolution ? Math.round(r.avg_resolution) : 0,
      completionRate: r.count > 0 ? Math.round((Number(r.completed) / Number(r.count)) * 100) : 0,
    }));

    return NextResponse.json({ groups });
  } catch (error) {
    console.error('Error grouping tickets:', error);
    return NextResponse.json({ error: 'Failed to group tickets' }, { status: 500 });
  }
}
