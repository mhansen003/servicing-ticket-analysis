const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

console.log('📊 Pre-processing ticket data...');

const csvPath = path.join(__dirname, '..', 'data', 'tickets.csv');
const outputPath = path.join(__dirname, '..', 'data', 'processed-stats.json');

// Check if processed data already exists (for deployment without CSV)
if (!fs.existsSync(csvPath)) {
  if (fs.existsSync(outputPath)) {
    console.log('⚡ Using pre-processed data (CSV not present)');
    process.exit(0);
  } else {
    console.error('❌ No CSV file and no pre-processed data found!');
    process.exit(1);
  }
}

// Read and parse CSV
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const result = Papa.parse(csvContent, {
  header: true,
  skipEmptyLines: true,
  dynamicTyping: true,
});

// Servicing projects to include (filtered from original 50k+ tickets)
const SERVICING_PROJECTS = ['Servicing Help', 'Servicing Escalations WG', 'ServApp Support', 'CMG Servicing Oversight'];

// Filter valid tickets AND only servicing projects
const allValidTickets = result.data.filter((ticket) => {
  if (!ticket.ticket_created_at_utc) return false;
  // Convert to string if it's not already (handles both dynamicTyping true/false)
  const dateStr = String(ticket.ticket_created_at_utc);
  if (dateStr.length > 30) return false;
  if (!dateStr.includes('-')) return false;
  return true;
});

// Filter to servicing-only tickets
const tickets = allValidTickets.filter((ticket) => SERVICING_PROJECTS.includes(ticket.project_name));

console.log(`✅ Loaded ${allValidTickets.length.toLocaleString()} valid tickets`);
console.log(`📌 Filtered to ${tickets.length.toLocaleString()} servicing tickets`);

// Helper to check completion
const isComplete = (t) =>
  t.is_ticket_complete === 'TRUE' || t.is_ticket_complete === 'true' || t.is_ticket_complete === '1' ||
  t.is_ticket_complete === 'YES' || t.is_ticket_complete === 'yes' || t.is_ticket_complete === true;

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
// SERVICING ANALYSIS (Filtered Data)
// ========================================
const servicingProjects = ['Servicing Help', 'Servicing Escalations WG', 'ServApp Support', 'CMG Servicing Oversight'];
const servicingTickets = tickets.filter(t => servicingProjects.includes(t.project_name));

// Category keywords for classification
const categoryKeywords = {
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
const loanNumberPattern = /\b(r[a-z]{2}\d{7,}|0\d{9}|\d{10,}|loan\s*#?\s*\d+)/i;

// Categorize tickets
function categorizeTicket(title) {
  const lowerTitle = String(title || '').toLowerCase();
  for (const [cat, terms] of Object.entries(categoryKeywords)) {
    if (terms.some(term => lowerTitle.includes(term))) {
      return cat;
    }
  }
  if (loanNumberPattern.test(String(title || ''))) {
    return 'Loan-Specific Inquiry';
  }
  return 'Other';
}

// Calculate servicing stats
const servicingCategories = {};
const servicingByMonth = {};
const servicingByWeek = {};
const servicingByDay = {};
const servicingCategoryByMonth = {};

servicingTickets.forEach(t => {
  const category = categorizeTicket(t.ticket_title);
  servicingCategories[category] = (servicingCategories[category] || 0) + 1;

  if (t.ticket_created_at_utc) {
    const date = new Date(t.ticket_created_at_utc);
    if (!isNaN(date.getTime())) {
      // Monthly
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      servicingByMonth[monthKey] = (servicingByMonth[monthKey] || 0) + 1;

      // Weekly (week starting Sunday)
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().slice(0, 10);
      servicingByWeek[weekKey] = (servicingByWeek[weekKey] || 0) + 1;

      // Daily
      const dayKey = date.toISOString().slice(0, 10);
      servicingByDay[dayKey] = (servicingByDay[dayKey] || 0) + 1;

      // Category by month (for trend analysis)
      if (!servicingCategoryByMonth[monthKey]) {
        servicingCategoryByMonth[monthKey] = {};
      }
      servicingCategoryByMonth[monthKey][category] = (servicingCategoryByMonth[monthKey][category] || 0) + 1;
    }
  }
});

// Top 6 categories
const topCategories = Object.entries(servicingCategories)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6)
  .map(([name, count]) => ({ name, count, percent: Math.round(count / servicingTickets.length * 100) }));

// Find the last date with actual ticket data (moved up to use in categoryTrends)
const allDates = servicingTickets
  .map(t => new Date(t.ticket_created_at_utc))
  .filter(d => !isNaN(d.getTime()))
  .sort((a, b) => b - a);
const lastTicketDate = allDates[0];
console.log(`📅 Last ticket date: ${lastTicketDate.toISOString().slice(0, 10)}`);

// Helper to check if a period is complete (has ended before last ticket date)
const isCompletePeriod = (periodStart, periodType) => {
  // Parse date string directly to avoid timezone issues
  const parts = periodStart.split('-').map(Number);
  const year = parts[0];
  const month = parts[1]; // 1-indexed from string (1=Jan, 12=Dec)
  const day = parts[2] || 1;

  let periodEnd;

  if (periodType === 'monthly') {
    // Period ends at the last day of the month
    // new Date(year, month, 0) gives last day of month (month is 1-indexed here)
    periodEnd = new Date(year, month, 0); // month is already 1-indexed, so this gives last day
  } else if (periodType === 'weekly') {
    // Period ends 6 days after start (week = 7 days)
    periodEnd = new Date(year, month - 1, day + 6);
  } else {
    // Daily - period is complete if it's before or equal to last ticket date
    periodEnd = new Date(year, month - 1, day);
  }

  return periodEnd <= lastTicketDate;
};

// Category trends by month - only include complete months
const categoryTrends = Object.entries(servicingCategoryByMonth)
  .sort(([a], [b]) => a.localeCompare(b))
  .filter(([month]) => isCompletePeriod(month + '-01', 'monthly'))
  .map(([month, cats]) => ({
    month,
    ...Object.fromEntries(topCategories.map(c => [c.name, cats[c.name] || 0]))
  }));

// Format time series data - only include complete periods to avoid misleading downward slopes
const servicingTimeSeries = {
  monthly: Object.entries(servicingByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([date]) => isCompletePeriod(date + '-01', 'monthly'))
    .map(([date, count]) => ({ date, count })),
  weekly: Object.entries(servicingByWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([date]) => isCompletePeriod(date, 'weekly'))
    .slice(-12)
    .map(([date, count]) => ({ date, count })),
  daily: Object.entries(servicingByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([date]) => isCompletePeriod(date, 'daily'))
    .slice(-30)
    .map(([date, count]) => ({ date, count })),
};

console.log(`📊 Time series: ${servicingTimeSeries.monthly.length} months, ${servicingTimeSeries.weekly.length} weeks, ${servicingTimeSeries.daily.length} days`);

// Servicing analysis object
const servicingAnalysis = {
  totalTickets: servicingTickets.length,
  projects: servicingProjects.map(p => ({
    name: p,
    count: servicingTickets.filter(t => t.project_name === p).length
  })).sort((a, b) => b.count - a.count),
  categories: Object.entries(servicingCategories)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, percent: Math.round(count / servicingTickets.length * 100) })),
  topCategories,
  categoryTrends,
  timeSeries: servicingTimeSeries,
};

console.log(`📊 Servicing Analysis: ${servicingTickets.length.toLocaleString()} tickets in ${topCategories.length} top categories`);

// ========================================
// CATEGORIZED TICKET ANALYSIS (NEW)
// Categorize tickets directly from the parsed ticket data
// ========================================
console.log('📊 Categorizing tickets...');

// Simple categorization function (inline)
function categorizeTicket(title, description) {
  const combined = `${title} ${description}`.toLowerCase();

  const categoryKeywords = {
    'Payment Issues': ['payment', 'pay', 'autopay', 'ach', 'draft', 'first payment', 'where do i send'],
    'Account Access': ['login', 'password', 'access', 'locked out', 'reset', 'portal'],
    'Loan Transfer': ['transfer', 'sold', 'servicer', 'boarding', 'cenlar', 'lakeview'],
    'Document Requests': ['statement', 'payoff', '1098', 'letter', 'document', 'release'],
    'Escrow': ['escrow', 'tax', 'insurance', 'impound', 'shortage', 'surplus'],
    'Escalation': ['complaint', 'escalat', 'urgent', 'supervisor', 'legal'],
    'Voice/Alert Requests': ['voice', 'alert', 'voicemail'],
    'Loan Information': ['balance', 'rate', 'loan number', 'loan info'],
    'Loan Modifications': ['modification', 'forbearance', 'hardship', 'recast'],
    'Communication': ['fw:', 'fwd:', 're:', 'follow up']
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (combined.includes(keyword)) {
        return { category, subcategory: `General ${category}`, confidence: 0.7 };
      }
    }
  }

  return { category: 'Other', subcategory: 'Uncategorized', confidence: 0.3 };
}

// Categorize all servicing tickets
const categorizedTickets = tickets.map(t => {
  const result = categorizeTicket(t.ticket_title || '', t.ticket_description || '');
  return {
    category: result.category,
    subcategory: result.subcategory,
    categorization_confidence: result.confidence,
    ticket_created_at_utc: t.ticket_created_at_utc,
  };
});

console.log(`✅ Categorized ${categorizedTickets.length.toLocaleString()} tickets`);

// Category statistics
let categorizedAnalytics = null;
let baselineAnalytics = null;

const categoryStats = {};
const subcategoryStats = {};
let totalConfidence = 0;
let confidenceCount = 0;

categorizedTickets.forEach(t => {
    const category = t.category || 'Other';
    const subcategory = t.subcategory || 'Uncategorized';
    const confidence = parseFloat(t.categorization_confidence) || 0;

    // Category totals
    if (!categoryStats[category]) {
      categoryStats[category] = { count: 0, confidenceSum: 0, confidenceCount: 0, subcategories: {} };
    }
    categoryStats[category].count++;
    if (confidence > 0) {
      categoryStats[category].confidenceSum += confidence;
      categoryStats[category].confidenceCount++;
      totalConfidence += confidence;
      confidenceCount++;
    }

    // Subcategory totals
    const key = `${category}::${subcategory}`;
    if (!subcategoryStats[key]) {
      subcategoryStats[key] = { category, subcategory, count: 0, confidenceSum: 0, confidenceCount: 0 };
    }
    subcategoryStats[key].count++;
    if (confidence > 0) {
      subcategoryStats[key].confidenceSum += confidence;
      subcategoryStats[key].confidenceCount++;
    }

    // Subcategories within category
    if (!categoryStats[category].subcategories[subcategory]) {
      categoryStats[category].subcategories[subcategory] = 0;
    }
    categoryStats[category].subcategories[subcategory]++;
  });

  // Format category statistics
  const categories = Object.entries(categoryStats).map(([name, data]) => ({
    category: name,
    count: data.count,
    percentage: Math.round((data.count / categorizedTickets.length) * 100),
    avgConfidence: data.confidenceCount > 0
      ? parseFloat((data.confidenceSum / data.confidenceCount).toFixed(3))
      : 0,
    subcategories: Object.entries(data.subcategories).map(([subName, count]) => ({
      name: subName,
      count,
      percentage: Math.round((count / categorizedTickets.length) * 100),
    })).sort((a, b) => b.count - a.count),
  })).sort((a, b) => b.count - a.count);

  // Format all subcategories
  const subcategories = Object.values(subcategoryStats).map(data => ({
    category: data.category,
    subcategory: data.subcategory,
    count: data.count,
    percentage: Math.round((data.count / categorizedTickets.length) * 100),
    avgConfidence: data.confidenceCount > 0
      ? parseFloat((data.confidenceSum / data.confidenceCount).toFixed(3))
      : 0,
  })).sort((a, b) => b.count - a.count);

  categorizedAnalytics = {
    summary: {
      totalCategorized: categorizedTickets.length,
      totalCategories: Object.keys(categoryStats).length,
      totalSubcategories: Object.keys(subcategoryStats).length,
      avgConfidence: confidenceCount > 0
        ? parseFloat((totalConfidence / confidenceCount).toFixed(3))
        : 0,
    },
    categories,
    subcategories,
  };

  console.log(`📊 Categorization: ${categories.length} categories, ${subcategories.length} subcategories`);

  // Baseline vs Recent Analysis (for Trends tab)
  const ticketsWithDates = categorizedTickets.filter(t => {
    const date = t.ticket_created_at_utc || t.created_date || t.callDate || t.call_date;
    return date && date.trim() !== '';
  }).map(t => ({
    ...t,
    parsedDate: new Date(t.ticket_created_at_utc || t.created_date || t.callDate || t.call_date),
  })).filter(t => !isNaN(t.parsedDate.getTime()));

  if (ticketsWithDates.length > 0) {
    // Sort by date descending
    ticketsWithDates.sort((a, b) => b.parsedDate - a.parsedDate);

    // Generate baseline comparisons for multiple time windows
    const timeWindows = [7, 14, 21, 30, 60, 90];
    const baselineComparisons = {};

    timeWindows.forEach(daysRecent => {
      const daysBaseline = daysRecent; // Same window size for baseline
      const now = ticketsWithDates[0].parsedDate; // Use most recent ticket date

      const recentStart = new Date(now.getTime() - daysRecent * 24 * 60 * 60 * 1000);
      const baselineStart = new Date(recentStart.getTime() - daysBaseline * 24 * 60 * 60 * 1000);
      const baselineEnd = recentStart;

      const recentTickets = ticketsWithDates.filter(t => t.parsedDate >= recentStart);
      const baselineTickets = ticketsWithDates.filter(t =>
        t.parsedDate >= baselineStart && t.parsedDate < baselineEnd
      );

      // Count by category+subcategory
      const recentCounts = {};
      const baselineCounts = {};

      recentTickets.forEach(t => {
        const key = `${t.category}::${t.subcategory}`;
        recentCounts[key] = (recentCounts[key] || 0) + 1;
      });

      baselineTickets.forEach(t => {
        const key = `${t.category}::${t.subcategory}`;
        baselineCounts[key] = (baselineCounts[key] || 0) + 1;
      });

      // Combine all keys
      const allKeys = new Set([...Object.keys(recentCounts), ...Object.keys(baselineCounts)]);

      const trends = Array.from(allKeys).map(key => {
        const [category, subcategory] = key.split('::');
        const baseline = baselineCounts[key] || 0;
        const recent = recentCounts[key] || 0;
        const change = recent - baseline;
        const percentChange = baseline > 0
          ? Math.round((change / baseline) * 100)
          : recent > 0 ? 100 : 0;

        let trend = 'stable';
        if (Math.abs(percentChange) >= 20) {
          trend = percentChange > 0 ? 'increasing' : 'decreasing';
        }

        return {
          category,
          subcategory,
          baseline,
          recent,
          change,
          percentChange,
          trend,
        };
      }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

      baselineComparisons[daysRecent] = {
        daysRecent,
        daysBaseline,
        recentPeriod: {
          start: recentStart.toISOString().split('T')[0],
          end: now.toISOString().split('T')[0],
          total: recentTickets.length,
        },
        baselinePeriod: {
          start: baselineStart.toISOString().split('T')[0],
          end: baselineEnd.toISOString().split('T')[0],
          total: baselineTickets.length,
        },
        trends,
        summary: {
          increasing: trends.filter(t => t.trend === 'increasing').length,
          decreasing: trends.filter(t => t.trend === 'decreasing').length,
          stable: trends.filter(t => t.trend === 'stable').length,
        },
      };
    });

  baselineAnalytics = baselineComparisons;
  console.log(`📊 Generated baseline comparisons for ${Object.keys(baselineComparisons).length} time windows`);
}

// ========================================
// ALL TICKETS FOR RAW DATA TABLE
// ========================================
// Write to public/data for static file serving in Next.js
const publicDataDir = path.join(__dirname, '..', 'public', 'data');
if (!fs.existsSync(publicDataDir)) {
  fs.mkdirSync(publicDataDir, { recursive: true });
}
const allTicketsPath = path.join(publicDataDir, 'all-tickets.json');
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
  complete: isComplete(t),
  // Add category for drill-down filtering (uses same categorization as analytics)
  category: categorizeTicket(t.ticket_title),
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
  // Servicing-only analysis
  servicingAnalysis,
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
  // Enhanced categorization analytics
  categorizedAnalytics,
  baselineAnalytics,
  processedAt: new Date().toISOString(),
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

const fileSizeKB = Math.round(fs.statSync(outputPath).size / 1024);
console.log(`✅ Generated processed-stats.json (${fileSizeKB} KB)`);

// Copy to public folder for web access
const publicOutputPath = path.join(__dirname, '..', 'public', 'data', 'processed-stats.json');
fs.copyFileSync(outputPath, publicOutputPath);
console.log(`✅ Copied to public/data/processed-stats.json`);

console.log(`📊 Detected ${issues.length} issues/alerts`);
console.log('📦 Data ready for deployment!');
