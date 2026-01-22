'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Calendar,
  Loader2,
  Filter,
  BarChart3,
  ListTodo,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  ComposedChart,
  Bar,
  Line,
} from 'recharts';
import { TicketLink } from './TicketLink';

interface Ticket {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  project: string;
  assignee: string;
  created: string;
  category: string;
  ticket_description?: string;
  time_to_resolution_in_minutes?: number | null;
  is_ticket_complete?: string;
  ticket_completed_at_utc?: string;
}

interface BurndownData {
  date: string;
  displayDate: string;
  total: number;
  remaining: number;
  completed: number;
  ideal: number;
  criticalOpen: number;
  highOpen: number;
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Critical: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' },
  High: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50' },
  Medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' },
  Low: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' },
};

const STATUS_GROUPS = {
  open: ['New', 'Assigned', 'In Progress', 'Reopened'],
  closed: ['Request Complete', 'Closed', 'Closed - Miscategorized'],
};

// Estimate work points by priority
const PRIORITY_POINTS: Record<string, number> = {
  Critical: 8,
  High: 5,
  Medium: 3,
  Low: 1,
};

const tooltipStyle = {
  backgroundColor: '#1a2332',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px',
  padding: '12px 16px',
  boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
  color: '#ffffff',
};

export default function BurndownAnalysis() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'chart' | 'cards'>('chart');
  const [timeRange, setTimeRange] = useState<'30' | '60' | '90'>('30');
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);

  // Load tickets
  useEffect(() => {
    setLoading(true);
    fetch('/data/all-tickets.json')
      .then((res) => res.json())
      .then((data) => {
        setTickets(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Calculate burndown data over the selected time range
  const burndownData = useMemo(() => {
    if (!tickets.length) return [];

    const days = parseInt(timeRange);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all tickets created before end date
    const relevantTickets = tickets.filter((t) => {
      const created = new Date(t.created);
      return created <= endDate;
    });

    const totalAtStart = relevantTickets.filter((t) => {
      const created = new Date(t.created);
      return created <= startDate;
    }).length;

    const data: BurndownData[] = [];
    const totalTickets = relevantTickets.length;
    const idealBurnPerDay = totalTickets / days;

    for (let i = 0; i <= days; i += Math.ceil(days / 20)) {
      // Sample ~20 points
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      // Count tickets completed by this date
      const completedByDate = relevantTickets.filter((t) => {
        if (!t.ticket_completed_at_utc) return false;
        const completed = new Date(t.ticket_completed_at_utc);
        return completed <= date;
      }).length;

      // Count tickets created by this date
      const createdByDate = relevantTickets.filter((t) => {
        const created = new Date(t.created);
        return created <= date;
      }).length;

      // Remaining = created - completed
      const remaining = createdByDate - completedByDate;

      // Count high priority open tickets
      const openTickets = relevantTickets.filter((t) => {
        const created = new Date(t.created);
        const isCreated = created <= date;
        const isCompleted =
          t.ticket_completed_at_utc && new Date(t.ticket_completed_at_utc) <= date;
        return isCreated && !isCompleted;
      });

      const criticalOpen = openTickets.filter((t) => t.priority === 'Critical').length;
      const highOpen = openTickets.filter((t) => t.priority === 'High').length;

      // Ideal line: starts at total, goes to 0
      const ideal = Math.max(0, totalTickets - idealBurnPerDay * i);

      data.push({
        date: dateStr,
        displayDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        total: createdByDate,
        remaining,
        completed: completedByDate,
        ideal: Math.round(ideal),
        criticalOpen,
        highOpen,
      });
    }

    return data;
  }, [tickets, timeRange]);

  // Current open tickets sorted by priority
  const openTickets = useMemo(() => {
    let filtered = tickets.filter((t) => STATUS_GROUPS.open.includes(t.status));

    if (priorityFilter.length > 0) {
      filtered = filtered.filter((t) => priorityFilter.includes(t.priority));
    }

    // Sort by priority weight (Critical first)
    const priorityOrder = ['Critical', 'High', 'Medium', 'Low'];
    return filtered.sort((a, b) => {
      const aIdx = priorityOrder.indexOf(a.priority);
      const bIdx = priorityOrder.indexOf(b.priority);
      if (aIdx !== bIdx) return aIdx - bIdx;
      // Secondary sort by created date (oldest first)
      return new Date(a.created).getTime() - new Date(b.created).getTime();
    });
  }, [tickets, priorityFilter]);

  // Calculate work points
  const workStats = useMemo(() => {
    const stats = {
      totalOpen: openTickets.length,
      totalPoints: 0,
      byPriority: {} as Record<string, { count: number; points: number }>,
    };

    openTickets.forEach((t) => {
      const points = PRIORITY_POINTS[t.priority] || 1;
      stats.totalPoints += points;

      if (!stats.byPriority[t.priority]) {
        stats.byPriority[t.priority] = { count: 0, points: 0 };
      }
      stats.byPriority[t.priority].count++;
      stats.byPriority[t.priority].points += points;
    });

    return stats;
  }, [openTickets]);

  // Velocity (completed per day over last 7 days)
  const velocity = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const completedLast7Days = tickets.filter((t) => {
      if (!t.ticket_completed_at_utc) return false;
      const completed = new Date(t.ticket_completed_at_utc);
      return completed >= sevenDaysAgo;
    }).length;

    return Math.round((completedLast7Days / 7) * 10) / 10;
  }, [tickets]);

  // Estimated days to clear backlog
  const estimatedDaysToClear = useMemo(() => {
    if (velocity <= 0) return null;
    return Math.ceil(openTickets.length / velocity);
  }, [openTickets.length, velocity]);

  const togglePriorityFilter = (priority: string) => {
    setPriorityFilter((prev) =>
      prev.includes(priority) ? prev.filter((p) => p !== priority) : [...prev, priority]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-green-400 mx-auto" />
          <p className="mt-4 text-gray-400">Loading burndown data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-green-500/10 rounded-2xl p-6 border border-green-500/20">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
              <TrendingDown className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Ticket Burndown</h2>
              <p className="text-gray-400">Track progress and estimate completion</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#0a0e17] rounded-lg p-1 border border-white/[0.08]">
              <button
                onClick={() => setViewMode('chart')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'chart' ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <BarChart3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'cards' ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <ListTodo className="h-4 w-4" />
              </button>
            </div>

            {/* Time Range Selector */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as '30' | '60' | '90')}
              className="px-3 py-2 bg-[#0a0e17] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-green-500/50"
            >
              <option value="30">Last 30 days</option>
              <option value="60">Last 60 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#131a29] rounded-xl p-4 border border-white/[0.08]">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-gray-400">Open Tickets</span>
          </div>
          <div className="text-2xl font-bold text-white">{workStats.totalOpen.toLocaleString()}</div>
        </div>

        <div className="bg-[#131a29] rounded-xl p-4 border border-white/[0.08]">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-orange-400" />
            <span className="text-xs text-gray-400">Work Points</span>
          </div>
          <div className="text-2xl font-bold text-white">{workStats.totalPoints.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">Weighted by priority</div>
        </div>

        <div className="bg-[#131a29] rounded-xl p-4 border border-white/[0.08]">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-green-400" />
            <span className="text-xs text-gray-400">Velocity</span>
          </div>
          <div className="text-2xl font-bold text-white">{velocity}</div>
          <div className="text-xs text-gray-500 mt-1">tickets/day (7-day avg)</div>
        </div>

        <div className="bg-[#131a29] rounded-xl p-4 border border-white/[0.08]">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-purple-400" />
            <span className="text-xs text-gray-400">Est. Clear Date</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {estimatedDaysToClear ? `${estimatedDaysToClear}d` : '-'}
          </div>
          <div className="text-xs text-gray-500 mt-1">at current velocity</div>
        </div>
      </div>

      {/* Priority Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {['Critical', 'High', 'Medium', 'Low'].map((priority) => {
          const stats = workStats.byPriority[priority] || { count: 0, points: 0 };
          const colors = PRIORITY_COLORS[priority];
          const isFiltered = priorityFilter.includes(priority);

          return (
            <button
              key={priority}
              onClick={() => togglePriorityFilter(priority)}
              className={`${colors.bg} rounded-xl p-4 border ${
                isFiltered ? colors.border : 'border-transparent'
              } hover:border-white/20 transition-all text-left`}
            >
              <div className={`text-xs ${colors.text} font-medium mb-1`}>{priority}</div>
              <div className="text-xl font-bold text-white">{stats.count}</div>
              <div className="text-xs text-gray-400">{stats.points} points</div>
            </button>
          );
        })}
      </div>

      {viewMode === 'chart' ? (
        <>
          {/* Burndown Chart */}
          <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white">Burndown Progress</h3>
                <p className="text-sm text-gray-400">Open tickets over time vs ideal trajectory</p>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={burndownData}>
                <defs>
                  <linearGradient id="remainingGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => value.toLocaleString()}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: '#9ca3af', marginBottom: '8px' }}
                  itemStyle={{ color: '#ffffff' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />

                {/* Ideal burndown line */}
                <Line
                  type="monotone"
                  dataKey="ideal"
                  stroke="#6b7280"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                  name="Ideal"
                />

                {/* Remaining tickets area */}
                <Area
                  type="monotone"
                  dataKey="remaining"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#remainingGradient)"
                  name="Remaining"
                />

                {/* Completed stacked area */}
                <Area
                  type="monotone"
                  dataKey="completed"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#completedGradient)"
                  name="Completed"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Priority Trend Chart */}
          <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white">High Priority Backlog</h3>
                <p className="text-sm text-gray-400">Critical and High priority tickets over time</p>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={burndownData}>
                <defs>
                  <linearGradient id="criticalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="highGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: '#9ca3af' }}
                  itemStyle={{ color: '#ffffff' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Area
                  type="monotone"
                  dataKey="criticalOpen"
                  stackId="1"
                  stroke="#ef4444"
                  fill="url(#criticalGrad)"
                  name="Critical"
                />
                <Area
                  type="monotone"
                  dataKey="highOpen"
                  stackId="1"
                  stroke="#f59e0b"
                  fill="url(#highGrad)"
                  name="High"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        /* Cards View */
        <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Open Tickets by Priority</h3>
              <p className="text-sm text-gray-400">
                {priorityFilter.length > 0
                  ? `Filtered: ${priorityFilter.join(', ')}`
                  : 'Click priority cards above to filter'}
              </p>
            </div>
            <div className="text-sm text-gray-400">{openTickets.length} tickets</div>
          </div>

          {/* Ticket Cards Grid */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {openTickets.slice(0, 50).map((ticket) => {
              const colors = PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.Low;

              return (
                <div
                  key={ticket.id}
                  className={`${colors.bg} rounded-lg p-4 border ${colors.border} hover:bg-white/[0.05] transition-colors`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <TicketLink ticketKey={ticket.key} className="text-sm font-mono shrink-0" />
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}
                        >
                          {ticket.priority}
                        </span>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-white/[0.06] text-gray-300">
                          {ticket.status}
                        </span>
                      </div>
                      <h4 className="text-sm font-medium text-white truncate" title={ticket.title}>
                        {ticket.title}
                      </h4>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span>{ticket.project}</span>
                        <span>•</span>
                        <span>{ticket.assignee || 'Unassigned'}</span>
                        <span>•</span>
                        <span>
                          {new Date(ticket.created).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-lg font-bold ${colors.text}`}>
                        {PRIORITY_POINTS[ticket.priority] || 1}
                      </div>
                      <div className="text-xs text-gray-500">pts</div>
                    </div>
                  </div>
                </div>
              );
            })}

            {openTickets.length > 50 && (
              <div className="text-center py-4 text-sm text-gray-500">
                Showing 50 of {openTickets.length} tickets
              </div>
            )}

            {openTickets.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p>No open tickets matching the filter!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
