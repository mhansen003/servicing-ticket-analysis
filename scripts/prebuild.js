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

// Helper to check completion
const isComplete = (t) =>
  t.is_ticket_complete === 'TRUE' || t.is_ticket_complete === 'true' || t.is_ticket_complete === '1';

// Calculate stats
const completedTickets = tickets.filter(isComplete);

const responseTimes = tickets
  .map((t) => t.time_to_first_response_in_minutes)
  .filter((t) => t !== null && !isNaN(t) && t > 0 && t < 1000000);

const resolutionTimes = tickets
  .map((t) => t.time_to_resolution_in_minutes)
  .filter((t) => t !== null && !isNaN(t) && t > 0 && t < 10000000);

const avgResponseTime =
  responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;

const avgResolutionTime =
  resolutionTimes.length > 0 ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length : 0;

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

// ========================================
// HEATMAP DATA: Day of Week × Hour
// ========================================
const dayHourHeatmap = [];
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hourLabels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

const dayHourCounts = {};
tickets.forEach((ticket) => {
  try {
    const date = new Date(ticket.ticket_created_at_utc);
    if (isNaN(date.getTime())) return;
    const day = dayNames[date.getDay()];
    const hour = `${date.getHours().toString().padStart(2, '0')}:00`;
    const key = `${hour}-${day}`;
    dayHourCounts[key] = (dayHourCounts[key] || 0) + 1;
  } catch {}
});

dayNames.forEach((day) => {
  hourLabels.forEach((hour) => {
    dayHourHeatmap.push({
      x: hour,
      y: day,
      value: dayHourCounts[`${hour}-${day}`] || 0,
    });
  });
});

// ========================================
// HEATMAP DATA: Project × Status
// ========================================
const projectStatusHeatmap = [];
const topProjects = [];
const projectMap = {};

tickets.forEach((ticket) => {
  const project = ticket.project_name || 'Unknown';
  if (!projectMap[project]) {
    projectMap[project] = { total: 0, completed: 0, resolutionTimes: [], statusCounts: {} };
  }
  projectMap[project].total++;

  if (isComplete(ticket)) {
    projectMap[project].completed++;
  }

  const status = ticket.ticket_status || 'Unknown';
  if (status.length < 30) {
    projectMap[project].statusCounts[status] = (projectMap[project].statusCounts[status] || 0) + 1;
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
    openRate: Math.round(((data.total - data.completed) / data.total) * 100),
    avgResolutionHours:
      data.resolutionTimes.length > 0
        ? Math.round(data.resolutionTimes.reduce((a, b) => a + b, 0) / data.resolutionTimes.length / 60)
        : 0,
  }))
  .sort((a, b) => b.total - a.total)
  .slice(0, 10);

// Get top statuses for heatmap
const allStatusCounts = {};
tickets.forEach((t) => {
  const status = t.ticket_status || 'Unknown';
  if (status.length < 30) {
    allStatusCounts[status] = (allStatusCounts[status] || 0) + 1;
  }
});
const topStatuses = Object.entries(allStatusCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6)
  .map(([s]) => s);

projectBreakdown.forEach((proj) => {
  const data = projectMap[proj.project];
  topStatuses.forEach((status) => {
    projectStatusHeatmap.push({
      x: status.length > 12 ? status.slice(0, 12) + '..' : status,
      y: proj.project.length > 15 ? proj.project.slice(0, 15) + '..' : proj.project,
      value: data.statusCounts[status] || 0,
    });
  });
});

// ========================================
// ISSUE DETECTION & ALERTS
// ========================================
const issues = [];

// 1. Projects with high open rates
projectBreakdown.forEach((proj) => {
  if (proj.openRate > 80 && proj.total > 100) {
    issues.push({
      category: 'Project Health',
      metric: proj.project.slice(0, 20),
      value: proj.openRate,
      severity: proj.openRate === 100 ? 'critical' : 'warning',
      description: `${proj.open.toLocaleString()} open of ${proj.total.toLocaleString()} total`,
    });
  }
});

// 2. Assignee overload
const assigneeMap = {};
tickets.forEach((ticket) => {
  const email = ticket.assigned_user_email;
  if (!email) return;

  if (!assigneeMap[email]) {
    assigneeMap[email] = {
      name: ticket.assigned_user_name || email,
      total: 0,
      completed: 0,
      open: 0,
      resolutionTimes: [],
    };
  }
  assigneeMap[email].total++;

  if (isComplete(ticket)) {
    assigneeMap[email].completed++;
  } else {
    assigneeMap[email].open++;
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
    open: data.open,
    openRate: Math.round((data.open / data.total) * 100),
    avgResolutionHours:
      data.resolutionTimes.length > 0
        ? Math.round(data.resolutionTimes.reduce((a, b) => a + b, 0) / data.resolutionTimes.length / 60)
        : 0,
  }))
  .sort((a, b) => b.total - a.total)
  .slice(0, 15);

// Assignees with high open counts
assigneeBreakdown.forEach((a) => {
  if (a.open > 1000) {
    const displayName = a.name.split(',')[0] || a.email.split('@')[0];
    issues.push({
      category: 'Workload',
      metric: displayName.slice(0, 15),
      value: a.open,
      severity: a.open > 3000 ? 'critical' : 'warning',
      description: `${a.openRate}% of ${a.total.toLocaleString()} assigned`,
    });
  }
});

// 3. Response time issues
const slowResponseTickets = tickets.filter((t) => {
  const respTime = t.time_to_first_response_in_minutes;
  return respTime && respTime > 1440 && !isComplete(t); // >24h and still open
});

if (slowResponseTickets.length > 0) {
  issues.push({
    category: 'Response Time',
    metric: '>24h No Response',
    value: slowResponseTickets.length,
    severity: slowResponseTickets.length > 5000 ? 'critical' : 'warning',
    description: 'Open tickets waiting over 24 hours',
  });
}

// 4. Volume trends (comparing recent months)
const sortedMonths = Object.entries(monthCounts).sort(([a], [b]) => b.localeCompare(a));
if (sortedMonths.length >= 2) {
  const [latestMonth, latestCount] = sortedMonths[0];
  const [prevMonth, prevCount] = sortedMonths[1];
  const change = Math.round(((latestCount - prevCount) / prevCount) * 100);

  if (Math.abs(change) > 20) {
    issues.push({
      category: 'Volume Trend',
      metric: latestMonth,
      value: change,
      severity: change > 50 ? 'warning' : 'normal',
      description: `${change > 0 ? '+' : ''}${change}% vs previous month`,
    });
  }
}

// Summary metrics for dashboard
issues.push({
  category: 'Summary',
  metric: 'Total Open',
  value: stats.openTickets,
  severity: stats.openTickets > 30000 ? 'critical' : stats.openTickets > 10000 ? 'warning' : 'normal',
  description: `${stats.completionRate}% completion rate`,
});

issues.push({
  category: 'Summary',
  metric: 'Avg Resolution',
  value: Math.round(stats.avgResolutionTimeMinutes / 60),
  severity: stats.avgResolutionTimeMinutes > 10080 ? 'warning' : 'good', // >1 week
  description: `${Math.round(stats.avgResolutionTimeMinutes / 60)} hours average`,
});

// ========================================
// TREND ANALYSIS
// ========================================
const trends = {
  volumeByDayOfWeek: dayNames.map((day) => ({
    day,
    count: dayHourHeatmap.filter((h) => h.y === day).reduce((sum, h) => sum + h.value, 0),
  })),
  peakHours: hourLabels
    .map((hour) => ({
      hour,
      count: dayHourHeatmap.filter((h) => h.x === hour).reduce((sum, h) => sum + h.value, 0),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5),
  projectsAtRisk: projectBreakdown.filter((p) => p.openRate > 50).length,
  overloadedAssignees: assigneeBreakdown.filter((a) => a.open > 500).length,
};

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

// ========================================
// ALL TICKETS FOR RAW DATA TABLE
// ========================================
const allTicketsPath = path.join(__dirname, '..', 'data', 'all-tickets.json');
const allTickets = tickets.map((t) => ({
  id: t.ticket_key || t.ticket_id,
  key: t.ticket_key,
  title: String(t.ticket_title || '').slice(0, 100),
  status: String(t.ticket_status || 'Unknown'),
  priority: String(t.ticket_priority || 'Unknown'),
  project: String(t.project_name || 'Unknown'),
  assignee: String(t.assigned_user_name || 'Unassigned'),
  assigneeEmail: String(t.assigned_user_email || ''),
  created: t.ticket_created_at_utc,
  responseTime: t.time_to_first_response_in_minutes,
  resolutionTime: t.time_to_resolution_in_minutes,
  complete: t.is_ticket_complete === 'TRUE' || t.is_ticket_complete === 'true' || t.is_ticket_complete === '1',
}));

// Write minified JSON without formatting to save space
fs.writeFileSync(allTicketsPath, JSON.stringify(allTickets));
const allTicketsSizeKB = Math.round(fs.statSync(allTicketsPath).size / 1024);
const allTicketsSizeMB = (allTicketsSizeKB / 1024).toFixed(1);
console.log(`✅ Generated all-tickets.json (${allTicketsSizeMB} MB) with ${allTickets.length.toLocaleString()} tickets`);

// Write output
const output = {
  stats,
  ticketsByMonth,
  projectBreakdown,
  assigneeBreakdown,
  statusBreakdown,
  priorityBreakdown,
  ticketSample,
  // New analytics data
  heatmaps: {
    dayHour: {
      data: dayHourHeatmap,
      xLabels: hourLabels.filter((_, i) => i % 3 === 0), // Every 3 hours for display
      yLabels: dayNames,
    },
    projectStatus: {
      data: projectStatusHeatmap,
      xLabels: topStatuses.map((s) => (s.length > 12 ? s.slice(0, 12) + '..' : s)),
      yLabels: projectBreakdown.map((p) => (p.project.length > 15 ? p.project.slice(0, 15) + '..' : p.project)),
    },
  },
  issues,
  trends,
  processedAt: new Date().toISOString(),
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

const fileSizeKB = Math.round(fs.statSync(outputPath).size / 1024);
console.log(`✅ Generated processed-stats.json (${fileSizeKB} KB)`);
console.log(`📊 Detected ${issues.length} issues/alerts`);
console.log('📦 Data ready for deployment!');
