const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

console.log('📊 Pre-processing ticket data...');

const csvPath = path.join(__dirname, '..', 'data', 'tickets.csv');
const outputPath = path.join(__dirname, '..', 'data', 'processed-stats.json');

// Read and parse CSV
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const result = Papa.parse(csvContent, {
  header: true,
  skipEmptyLines: true,
  dynamicTyping: true,
});

// Filter valid tickets
const tickets = result.data.filter((ticket) => {
  if (!ticket.ticket_created_at_utc) return false;
  if (ticket.ticket_created_at_utc.length > 30) return false;
  if (!ticket.ticket_created_at_utc.includes('-')) return false;
  return true;
});

console.log(`✅ Loaded ${tickets.length.toLocaleString()} valid tickets`);

// Calculate stats
const completedTickets = tickets.filter(
  (t) => t.is_ticket_complete === 'TRUE' || t.is_ticket_complete === 'true' || t.is_ticket_complete === '1'
);

const responseTimes = tickets
  .map((t) => t.time_to_first_response_in_minutes)
  .filter((t) => t !== null && !isNaN(t) && t > 0 && t < 1000000);

const resolutionTimes = tickets
  .map((t) => t.time_to_resolution_in_minutes)
  .filter((t) => t !== null && !isNaN(t) && t > 0 && t < 10000000);

const avgResponseTime =
  responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;

const avgResolutionTime =
  resolutionTimes.length > 0
    ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
    : 0;

const stats = {
  totalTickets: tickets.length,
  completedTickets: completedTickets.length,
  openTickets: tickets.length - completedTickets.length,
  avgResponseTimeMinutes: Math.round(avgResponseTime),
  avgResolutionTimeMinutes: Math.round(avgResolutionTime),
  completionRate: Math.round((completedTickets.length / tickets.length) * 100),
};

// Tickets by month
const monthCounts = {};
tickets.forEach((ticket) => {
  try {
    const date = new Date(ticket.ticket_created_at_utc);
    if (isNaN(date.getTime())) return;
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
  } catch {}
});

const ticketsByMonth = Object.entries(monthCounts)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([date, count]) => ({ date, count }));

// Project breakdown
const projectMap = {};
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

const projectBreakdown = Object.entries(projectMap)
  .map(([project, data]) => ({
    project,
    total: data.total,
    completed: data.completed,
    open: data.total - data.completed,
    avgResolutionHours:
      data.resolutionTimes.length > 0
        ? Math.round(data.resolutionTimes.reduce((a, b) => a + b, 0) / data.resolutionTimes.length / 60)
        : 0,
  }))
  .sort((a, b) => b.total - a.total)
  .slice(0, 10);

// Assignee breakdown
const assigneeMap = {};
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

const assigneeBreakdown = Object.entries(assigneeMap)
  .map(([email, data]) => ({
    email,
    name: data.name,
    total: data.total,
    completed: data.completed,
    avgResolutionHours:
      data.resolutionTimes.length > 0
        ? Math.round(data.resolutionTimes.reduce((a, b) => a + b, 0) / data.resolutionTimes.length / 60)
        : 0,
  }))
  .sort((a, b) => b.total - a.total)
  .slice(0, 15);

// Status breakdown
const statusCounts = {};
tickets.forEach((ticket) => {
  const status = ticket.ticket_status || 'Unknown';
  if (status.length > 50) return;
  statusCounts[status] = (statusCounts[status] || 0) + 1;
});

const statusBreakdown = Object.entries(statusCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([name, value]) => ({ name, value }));

// Priority breakdown
const priorityCounts = {};
tickets.forEach((ticket) => {
  const priority = ticket.ticket_priority || 'Unknown';
  if (['Critical', 'High', 'Medium', 'Low'].includes(priority)) {
    priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
  }
});

const priorityBreakdown = Object.entries(priorityCounts).map(([name, value]) => ({ name, value }));

// Sample tickets for AI context
const ticketSample = tickets.slice(0, 100).map((t) => ({
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

// Write output
const output = {
  stats,
  ticketsByMonth,
  projectBreakdown,
  assigneeBreakdown,
  statusBreakdown,
  priorityBreakdown,
  ticketSample,
  processedAt: new Date().toISOString(),
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

const fileSizeKB = Math.round(fs.statSync(outputPath).size / 1024);
console.log(`✅ Generated processed-stats.json (${fileSizeKB} KB)`);
console.log('📦 Data ready for deployment!');
