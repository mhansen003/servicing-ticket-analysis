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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const project = searchParams.get('project') || '';
  const priority = searchParams.get('priority') || '';
  const assignee = searchParams.get('assignee') || '';
  const sortField = searchParams.get('sortField') || 'ticketCreatedAtUtc';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

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

    if (status) {
      where.ticketStatus = status;
    }

    if (project) {
      where.projectName = project;
    }

    if (priority) {
      where.ticketPriority = priority;
    }

    if (assignee) {
      where.assignedUserName = assignee;
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

    // Get tickets with pagination
    const [tickets, total] = await Promise.all([
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
