import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface RawTicket {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  project: string;
  assignee: string;
  assigneeEmail: string;
  created: string;
  responseTime: number | null;
  resolutionTime: number | null;
  complete: boolean;
}

let cachedTickets: RawTicket[] | null = null;

function loadTickets(): RawTicket[] {
  if (cachedTickets) return cachedTickets;

  const jsonPath = path.join(process.cwd(), 'data', 'all-tickets.json');

  // Check if file exists - it may not in production without the CSV
  if (!fs.existsSync(jsonPath)) {
    console.warn('all-tickets.json not found - Raw data table will be empty');
    cachedTickets = [];
    return cachedTickets;
  }

  const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
  cachedTickets = JSON.parse(jsonContent);

  return cachedTickets!;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const project = searchParams.get('project') || '';
  const priority = searchParams.get('priority') || '';
  const assignee = searchParams.get('assignee') || '';
  const sortField = searchParams.get('sortField') || 'created';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  try {
    let tickets = loadTickets();

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      tickets = tickets.filter(t =>
        t.title.toLowerCase().includes(searchLower) ||
        t.key?.toLowerCase().includes(searchLower) ||
        t.assignee.toLowerCase().includes(searchLower)
      );
    }

    if (status) {
      tickets = tickets.filter(t => t.status === status);
    }

    if (project) {
      tickets = tickets.filter(t => t.project === project);
    }

    if (priority) {
      tickets = tickets.filter(t => t.priority === priority);
    }

    if (assignee) {
      tickets = tickets.filter(t => t.assignee === assignee);
    }

    // Get unique values for filters (from full dataset)
    const allTickets = loadTickets();
    const filterOptions = {
      statuses: [...new Set(allTickets.map(t => t.status))].sort(),
      projects: [...new Set(allTickets.map(t => t.project))].sort(),
      priorities: [...new Set(allTickets.map(t => t.priority))].sort(),
      assignees: [...new Set(allTickets.map(t => t.assignee))].filter(a => a !== 'Unassigned').sort().slice(0, 100),
    };

    // Sort
    tickets.sort((a, b) => {
      const aVal = a[sortField as keyof RawTicket];
      const bVal = b[sortField as keyof RawTicket];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });

    // Paginate
    const total = tickets.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedTickets = tickets.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      tickets: paginatedTickets,
      pagination: {
        page,
        limit,
        total,
        totalPages,
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

    const tickets = loadTickets();

    const groups: Record<string, { count: number; completed: number; avgResolution: number }> = {};

    tickets.forEach(ticket => {
      const key = ticket[groupBy as keyof RawTicket]?.toString() || 'Unknown';

      if (!groups[key]) {
        groups[key] = { count: 0, completed: 0, avgResolution: 0 };
      }

      groups[key].count++;
      if (ticket.complete) groups[key].completed++;
      if (ticket.resolutionTime) {
        groups[key].avgResolution += ticket.resolutionTime;
      }
    });

    // Calculate averages
    Object.keys(groups).forEach(key => {
      if (groups[key].avgResolution > 0) {
        groups[key].avgResolution = Math.round(groups[key].avgResolution / groups[key].count / 60); // Convert to hours
      }
    });

    const result = Object.entries(groups)
      .map(([name, data]) => ({
        name,
        ...data,
        completionRate: Math.round((data.completed / data.count) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({ groups: result });
  } catch (error) {
    console.error('Error grouping tickets:', error);
    return NextResponse.json({ error: 'Failed to group tickets' }, { status: 500 });
  }
}
