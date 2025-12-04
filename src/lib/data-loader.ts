import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { Ticket, TicketStats, ProjectBreakdown, AssigneeBreakdown, TimeSeriesData } from '@/types/ticket';

let cachedTickets: Ticket[] | null = null;

export async function loadTickets(): Promise<Ticket[]> {
  if (cachedTickets) {
    return cachedTickets;
  }

  const csvPath = path.join(process.cwd(), 'data', 'tickets.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  const result = Papa.parse<Ticket>(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  // Filter out rows with corrupted data (e.g., base64 encoded strings in wrong columns)
  cachedTickets = result.data.filter((ticket) => {
    // Basic validation: ticket_created_at_utc should look like a date
    if (!ticket.ticket_created_at_utc) return false;
    if (ticket.ticket_created_at_utc.length > 30) return false; // Likely corrupted
    if (!ticket.ticket_created_at_utc.includes('-')) return false;
    return true;
  });

  return cachedTickets;
}

export async function getTicketStats(): Promise<TicketStats> {
  const tickets = await loadTickets();

  const completedTickets = tickets.filter(
    (t) => t.is_ticket_complete === 'TRUE' || t.is_ticket_complete === 'true' || t.is_ticket_complete === '1'
  );

  const responseTimes = tickets
    .map((t) => t.time_to_first_response_in_minutes)
    .filter((t): t is number => t !== null && !isNaN(t) && t > 0 && t < 1000000);

  const resolutionTimes = tickets
    .map((t) => t.time_to_resolution_in_minutes)
    .filter((t): t is number => t !== null && !isNaN(t) && t > 0 && t < 10000000);

  const avgResponseTime =
    responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

  const avgResolutionTime =
    resolutionTimes.length > 0
      ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
      : 0;

  return {
    totalTickets: tickets.length,
    completedTickets: completedTickets.length,
    openTickets: tickets.length - completedTickets.length,
    avgResponseTimeMinutes: Math.round(avgResponseTime),
    avgResolutionTimeMinutes: Math.round(avgResolutionTime),
    completionRate: Math.round((completedTickets.length / tickets.length) * 100),
  };
}

export async function getTicketsByMonth(): Promise<TimeSeriesData[]> {
  const tickets = await loadTickets();
  const monthCounts: Record<string, number> = {};

  tickets.forEach((ticket) => {
    try {
      const date = new Date(ticket.ticket_created_at_utc);
      if (isNaN(date.getTime())) return;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
    } catch {
      // Skip invalid dates
    }
  });

  return Object.entries(monthCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

export async function getProjectBreakdown(): Promise<ProjectBreakdown[]> {
  const tickets = await loadTickets();
  const projectMap: Record<string, { total: number; completed: number; resolutionTimes: number[] }> = {};

  tickets.forEach((ticket) => {
    const project = ticket.project_name || 'Unknown';
    if (!projectMap[project]) {
      projectMap[project] = { total: 0, completed: 0, resolutionTimes: [] };
    }
    projectMap[project].total++;

    if (ticket.is_ticket_complete === 'TRUE' || ticket.is_ticket_complete === 'true' || ticket.is_ticket_complete === '1') {
      projectMap[project].completed++;
    }

    const resTime = ticket.time_to_resolution_in_minutes;
    if (resTime && !isNaN(resTime) && resTime > 0 && resTime < 10000000) {
      projectMap[project].resolutionTimes.push(resTime);
    }
  });

  return Object.entries(projectMap)
    .map(([project, data]) => ({
      project,
      total: data.total,
      completed: data.completed,
      open: data.total - data.completed,
      avgResolutionHours:
        data.resolutionTimes.length > 0
          ? Math.round(
              data.resolutionTimes.reduce((a, b) => a + b, 0) / data.resolutionTimes.length / 60
            )
          : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

export async function getAssigneeBreakdown(): Promise<AssigneeBreakdown[]> {
  const tickets = await loadTickets();
  const assigneeMap: Record<string, { name: string; total: number; completed: number; resolutionTimes: number[] }> = {};

  tickets.forEach((ticket) => {
    const email = ticket.assigned_user_email;
    if (!email) return;

    if (!assigneeMap[email]) {
      assigneeMap[email] = {
        name: ticket.assigned_user_name || email,
        total: 0,
        completed: 0,
        resolutionTimes: [],
      };
    }
    assigneeMap[email].total++;

    if (ticket.is_ticket_complete === 'TRUE' || ticket.is_ticket_complete === 'true' || ticket.is_ticket_complete === '1') {
      assigneeMap[email].completed++;
    }

    const resTime = ticket.time_to_resolution_in_minutes;
    if (resTime && !isNaN(resTime) && resTime > 0 && resTime < 10000000) {
      assigneeMap[email].resolutionTimes.push(resTime);
    }
  });

  return Object.entries(assigneeMap)
    .map(([email, data]) => ({
      email,
      name: data.name,
      total: data.total,
      completed: data.completed,
      avgResolutionHours:
        data.resolutionTimes.length > 0
          ? Math.round(
              data.resolutionTimes.reduce((a, b) => a + b, 0) / data.resolutionTimes.length / 60
            )
          : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);
}

export async function getStatusBreakdown(): Promise<{ name: string; value: number }[]> {
  const tickets = await loadTickets();
  const statusCounts: Record<string, number> = {};

  tickets.forEach((ticket) => {
    const status = ticket.ticket_status || 'Unknown';
    // Skip obviously corrupted values
    if (status.length > 50) return;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  return Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }));
}

export async function getPriorityBreakdown(): Promise<{ name: string; value: number }[]> {
  const tickets = await loadTickets();
  const priorityCounts: Record<string, number> = {};

  tickets.forEach((ticket) => {
    const priority = ticket.ticket_priority || 'Unknown';
    // Only count valid priorities
    if (['Critical', 'High', 'Medium', 'Low'].includes(priority)) {
      priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
    }
  });

  return Object.entries(priorityCounts)
    .map(([name, value]) => ({ name, value }));
}

export async function getTicketSample(limit: number = 100): Promise<Partial<Ticket>[]> {
  const tickets = await loadTickets();
  return tickets.slice(0, limit).map((t) => ({
    ticket_key: t.ticket_key,
    ticket_title: t.ticket_title,
    ticket_status: t.ticket_status,
    ticket_priority: t.ticket_priority,
    project_name: t.project_name,
    assigned_user_name: t.assigned_user_name,
    ticket_created_at_utc: t.ticket_created_at_utc,
    time_to_resolution_in_minutes: t.time_to_resolution_in_minutes,
    is_ticket_complete: t.is_ticket_complete,
  }));
}
