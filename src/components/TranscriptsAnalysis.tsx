'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import {
  Phone,
  Clock,
  TrendingUp,
  TrendingDown,
  Users,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Minus,
  AlertTriangle,
  Calendar,
  Timer,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  MousePointerClick,
} from 'lucide-react';
import { TranscriptModal } from './TranscriptModal';

interface TranscriptStats {
  totalCalls: number;
  generatedAt: string;
  sentimentDistribution: Record<string, number>;
  emotionDistribution: Record<string, number>;
  resolutionDistribution: Record<string, number>;
  topicDistribution: Record<string, number>;
  escalationRiskDistribution: Record<string, number>;
  byDepartment: Record<string, { count: number; negative: number; positive: number }>;
  byAgent: Record<string, { count: number; avgPerformance: number }>;
  byDayOfWeek: Record<string, number>;
  byHour: Record<string, number>;
  avgDuration: number;
  avgHoldTime: number;
  avgMessagesPerCall: number;
  avgAgentPerformance: number | null;
  dailyTrends: Array<{ date: string; total: number; positive: number; negative: number; neutral: number }>;
}

interface TranscriptRecord {
  id: string;
  vendorCallKey: string;
  callStart: string;
  callEnd: string;
  durationSeconds: number;
  disposition: string;
  numberOfHolds: number;
  holdDuration: number;
  department: string;
  status: string;
  agentName: string;
  agentRole: string;
  messageCount: number;
  customerMessages: number;
  agentMessages: number;
  detectedTopics: string[];
  basicSentiment: string;
  aiAnalysis: {
    sentiment?: string;
    customerEmotion?: string;
    emotionIntensity?: number;
    resolution?: string;
    topics?: string[];
    agentPerformance?: number;
    summary?: string;
    keyIssue?: string;
    escalationRisk?: string;
  } | null;
}

const COLORS = {
  positive: '#22c55e',
  negative: '#ef4444',
  neutral: '#6b7280',
  mixed: '#f59e0b',
};

const TOPIC_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#a855f7', '#eab308',
];

const TOPIC_LABELS: Record<string, string> = {
  payment_inquiry: 'Payment Inquiry',
  escrow: 'Escrow',
  loan_assumption: 'Loan Assumption',
  refinance: 'Refinance',
  account_access: 'Account Access',
  statement_request: 'Statement Request',
  payoff_quote: 'Payoff Quote',
  insurance: 'Insurance',
  property_taxes: 'Property Taxes',
  loan_modification: 'Loan Modification',
  complaint: 'Complaint',
  general_inquiry: 'General Inquiry',
  technical_issue: 'Technical Issue',
  transfer: 'Transfer',
  other: 'Other',
};

export default function TranscriptsAnalysis() {
  const [stats, setStats] = useState<TranscriptStats | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedSentiment, setSelectedSentiment] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded sections
  const [expandedSection, setExpandedSection] = useState<string | null>('overview');

  // Modal state for drill-down
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalFilterType, setModalFilterType] = useState<'sentiment' | 'topic' | 'department' | 'agent' | 'all'>('all');
  const [modalFilterValue, setModalFilterValue] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load stats
        const statsRes = await fetch('/data/transcript-stats.json');
        if (!statsRes.ok) throw new Error('Failed to load transcript stats');
        const statsData = await statsRes.json();
        setStats(statsData);

        // Load transcripts (for drill-down)
        const transcriptsRes = await fetch('/data/transcript-analysis.json');
        if (!transcriptsRes.ok) throw new Error('Failed to load transcript data');
        const transcriptsData = await transcriptsRes.json();
        setTranscripts(transcriptsData);

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Format duration from seconds
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 60) {
      const hrs = Math.floor(mins / 60);
      const remainMins = mins % 60;
      return `${hrs}h ${remainMins}m`;
    }
    return `${mins}m ${secs}s`;
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Prepare topic data for chart
  const topicChartData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.topicDistribution)
      .map(([topic, count]) => ({
        name: TOPIC_LABELS[topic] || topic,
        value: count,
        topic,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [stats]);

  // Prepare sentiment pie data
  const sentimentPieData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.sentimentDistribution).map(([sentiment, count]) => ({
      name: sentiment.charAt(0).toUpperCase() + sentiment.slice(1),
      value: count,
      color: COLORS[sentiment as keyof typeof COLORS] || '#6b7280',
    }));
  }, [stats]);

  // Prepare hourly distribution
  const hourlyData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.byHour)
      .map(([hour, count]) => ({
        hour: `${hour.padStart(2, '0')}:00`,
        count,
      }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
  }, [stats]);

  // Prepare agent leaderboard
  const agentLeaderboard = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.byAgent)
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgPerformance: data.avgPerformance,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [stats]);

  // Prepare department data
  const departmentData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.byDepartment)
      .filter(([name]) => name !== 'NULL')
      .map(([name, data]) => ({
        name: name.replace('SRVC - ', '').replace('SRVC/', ''),
        ...data,
        positiveRate: ((data.positive / data.count) * 100).toFixed(1),
        negativeRate: ((data.negative / data.count) * 100).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count);
  }, [stats]);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Drill-down handlers
  const openDrillDown = (filterType: 'sentiment' | 'topic' | 'department' | 'agent' | 'all', filterValue: string, title: string) => {
    setModalFilterType(filterType);
    setModalFilterValue(filterValue);
    setModalTitle(title);
    setModalOpen(true);
  };

  const handleSentimentClick = (sentiment: string) => {
    openDrillDown('sentiment', sentiment.toLowerCase(), `${sentiment} Calls`);
  };

  const handleTopicClick = (topic: string, label: string) => {
    openDrillDown('topic', topic, `${label} Calls`);
  };

  const handleDepartmentClick = (department: string) => {
    openDrillDown('department', department, `${department} Calls`);
  };

  const handleAgentClick = (agentName: string) => {
    openDrillDown('agent', agentName, `Calls by ${agentName}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        <span className="ml-3 text-gray-400">Loading transcript analysis...</span>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
          <p className="text-gray-400">{error || 'No transcript data available'}</p>
          <p className="text-sm text-gray-500 mt-2">
            Run the analysis script to generate data:
            <code className="block mt-2 bg-[#0a0e17] px-3 py-2 rounded text-xs">
              node scripts/analyze-transcripts.mjs
            </code>
          </p>
        </div>
      </div>
    );
  }

  const positiveRate = ((stats.sentimentDistribution.positive / stats.totalCalls) * 100).toFixed(1);
  const negativeRate = ((stats.sentimentDistribution.negative / stats.totalCalls) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Phone className="h-4 w-4" />
            <span className="text-sm">Total Calls</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalCalls.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">
            Since {formatDate(stats.dailyTrends[0]?.date || '')}
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <ThumbsUp className="h-4 w-4 text-green-400" />
            <span className="text-sm">Positive Calls</span>
          </div>
          <div className="text-2xl font-bold text-green-400">{positiveRate}%</div>
          <div className="text-xs text-gray-500 mt-1">
            {stats.sentimentDistribution.positive.toLocaleString()} calls
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Avg Duration</span>
          </div>
          <div className="text-2xl font-bold text-white">{formatDuration(stats.avgDuration)}</div>
          <div className="text-xs text-gray-500 mt-1">
            Avg hold: {formatDuration(stats.avgHoldTime)}
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <MessageSquare className="h-4 w-4" />
            <span className="text-sm">Avg Messages</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.avgMessagesPerCall}</div>
          <div className="text-xs text-gray-500 mt-1">per conversation</div>
        </div>
      </div>

      {/* Calendar Heatmap View */}
      <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] overflow-hidden">
        <button
          onClick={() => toggleSection('calendar')}
          className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-red-500/20">
              <Calendar className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-white">Call Calendar</h3>
              <p className="text-sm text-gray-500">Daily heatmap by sentiment <span className="text-blue-400">Click any day to view transcripts</span></p>
            </div>
          </div>
          {expandedSection === 'calendar' ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSection === 'calendar' && (
          <div className="p-6 pt-0">
            {/* Legend */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>Sentiment:</span>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-emerald-500"></div>
                  <span>Positive</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-gray-500"></div>
                  <span>Neutral</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-red-500"></div>
                  <span>Negative</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>Volume:</span>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-white/20"></div>
                  <span>Low</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-white/60"></div>
                  <span>High</span>
                </div>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs text-gray-500 py-1">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {(() => {
                // Generate calendar cells for the date range
                const sortedDays = [...stats.dailyTrends].sort((a, b) => a.date.localeCompare(b.date));
                if (sortedDays.length === 0) return null;

                const startDate = new Date(sortedDays[0].date);
                const endDate = new Date(sortedDays[sortedDays.length - 1].date);

                // Adjust start to beginning of week
                const calendarStart = new Date(startDate);
                calendarStart.setDate(calendarStart.getDate() - calendarStart.getDay());

                const cells = [];
                const dayMap = new Map(sortedDays.map(d => [d.date, d]));
                const maxTotal = Math.max(...sortedDays.map(d => d.total));

                let currentDate = new Date(calendarStart);
                while (currentDate <= endDate || currentDate.getDay() !== 0) {
                  const dateStr = currentDate.toISOString().split('T')[0];
                  const dayData = dayMap.get(dateStr);

                  if (dayData) {
                    const total = dayData.total;
                    const positiveRatio = dayData.positive / total;
                    const negativeRatio = dayData.negative / total;
                    const opacity = 0.3 + (total / maxTotal) * 0.7;

                    // Calculate color based on sentiment ratio
                    let bgColor = 'bg-gray-600'; // neutral default
                    if (negativeRatio > 0.1) bgColor = 'bg-red-500';
                    else if (positiveRatio > 0.7) bgColor = 'bg-emerald-500';
                    else if (positiveRatio > 0.5) bgColor = 'bg-emerald-600';
                    else bgColor = 'bg-gray-500';

                    cells.push(
                      <button
                        key={dateStr}
                        onClick={() => openDrillDown('all', dateStr, `Calls on ${formatDate(dateStr)}`)}
                        className={`aspect-square rounded-md ${bgColor} hover:ring-2 hover:ring-blue-400 transition-all flex items-center justify-center relative group`}
                        style={{ opacity }}
                        title={`${formatDate(dateStr)}: ${total} calls (${(positiveRatio * 100).toFixed(0)}% positive)`}
                      >
                        <span className="text-[10px] text-white/80 font-medium">{currentDate.getDate()}</span>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          {formatDate(dateStr)}: {total} calls
                          <br />
                          <span className="text-emerald-400">{dayData.positive} positive</span> / <span className="text-red-400">{dayData.negative} negative</span>
                        </div>
                      </button>
                    );
                  } else {
                    // Empty cell for days outside range
                    cells.push(
                      <div key={dateStr} className="aspect-square rounded-md bg-gray-800/30"></div>
                    );
                  }

                  currentDate.setDate(currentDate.getDate() + 1);
                }

                return cells;
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Sentiment Overview */}
      <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] overflow-hidden">
        <button
          onClick={() => toggleSection('overview')}
          className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-green-500/20 to-blue-500/20">
              <TrendingUp className="h-5 w-5 text-green-400" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-white">Sentiment Overview</h3>
              <p className="text-sm text-gray-500">Call sentiment distribution and trends</p>
            </div>
          </div>
          {expandedSection === 'overview' ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSection === 'overview' && (
          <div className="p-6 pt-0 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sentiment Distribution Pie */}
            <div className="bg-gray-800/30 rounded-xl p-4">
              <h4 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
                Sentiment Distribution
                <span className="text-xs text-blue-400 flex items-center gap-1">
                  <MousePointerClick className="h-3 w-3" /> Click to view
                </span>
              </h4>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={sentimentPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                    onClick={(data) => handleSentimentClick(data.name)}
                    style={{ cursor: 'pointer' }}
                  >
                    {sentimentPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} className="hover:opacity-80 transition-opacity" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [value.toLocaleString(), 'Calls']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Daily Sentiment Trend */}
            <div className="bg-gray-800/30 rounded-xl p-4">
              <h4 className="text-sm font-medium text-gray-400 mb-4">Daily Sentiment Trend</h4>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={stats.dailyTrends.slice(-14)}>
                  <defs>
                    <linearGradient id="colorPositive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorNegative" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    stroke="#6b7280"
                    fontSize={11}
                  />
                  <YAxis stroke="#6b7280" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                    labelFormatter={formatDate}
                  />
                  <Area
                    type="monotone"
                    dataKey="positive"
                    stroke="#22c55e"
                    fill="url(#colorPositive)"
                    stackId="1"
                  />
                  <Area
                    type="monotone"
                    dataKey="neutral"
                    stroke="#6b7280"
                    fill="rgba(107, 114, 128, 0.2)"
                    stackId="1"
                  />
                  <Area
                    type="monotone"
                    dataKey="negative"
                    stroke="#ef4444"
                    fill="url(#colorNegative)"
                    stackId="1"
                  />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Topics Analysis */}
      <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] overflow-hidden">
        <button
          onClick={() => toggleSection('topics')}
          className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <MessageSquare className="h-5 w-5 text-blue-400" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-white">Call Topics</h3>
              <p className="text-sm text-gray-500">What are customers calling about? <span className="text-blue-400">Click bars to drill down</span></p>
            </div>
          </div>
          {expandedSection === 'topics' ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSection === 'topics' && (
          <div className="p-6 pt-0">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={topicChartData} layout="vertical">
                <XAxis type="number" stroke="#6b7280" fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#6b7280"
                  fontSize={11}
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [value.toLocaleString(), 'Calls']}
                />
                <Bar
                  dataKey="value"
                  radius={[0, 4, 4, 0]}
                  onClick={(data) => {
                    const entry = data as unknown as { topic: string; name: string };
                    handleTopicClick(entry.topic, entry.name);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {topicChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={TOPIC_COLORS[index % TOPIC_COLORS.length]} className="hover:opacity-80" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Time Analysis */}
      <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] overflow-hidden">
        <button
          onClick={() => toggleSection('time')}
          className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Calendar className="h-5 w-5 text-purple-400" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-white">Call Timing Patterns</h3>
              <p className="text-sm text-gray-500">When are calls happening?</p>
            </div>
          </div>
          {expandedSection === 'time' ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSection === 'time' && (
          <div className="p-6 pt-0 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hourly Distribution */}
            <div className="bg-gray-800/30 rounded-xl p-4">
              <h4 className="text-sm font-medium text-gray-400 mb-4">Calls by Hour (UTC)</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={hourlyData}>
                  <XAxis dataKey="hour" stroke="#6b7280" fontSize={10} />
                  <YAxis stroke="#6b7280" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Day of Week */}
            <div className="bg-gray-800/30 rounded-xl p-4">
              <h4 className="text-sm font-medium text-gray-400 mb-4">Calls by Day of Week</h4>
              <div className="space-y-3">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                  const count = stats.byDayOfWeek[day] || 0;
                  const maxCount = Math.max(...Object.values(stats.byDayOfWeek));
                  const percentage = (count / maxCount) * 100;

                  return (
                    <div key={day} className="flex items-center gap-3">
                      <span className="w-8 text-xs text-gray-400">{day}</span>
                      <div className="flex-1 bg-gray-700 rounded-full h-4 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-16 text-xs text-gray-400 text-right">
                        {count.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Department Analysis */}
      <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] overflow-hidden">
        <button
          onClick={() => toggleSection('departments')}
          className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Users className="h-5 w-5 text-amber-400" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-white">Department Performance</h3>
              <p className="text-sm text-gray-500">Call volume and sentiment by department <span className="text-blue-400">Click rows to drill down</span></p>
            </div>
          </div>
          {expandedSection === 'departments' ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSection === 'departments' && (
          <div className="p-6 pt-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-gray-400 text-xs border-b border-gray-700">
                    <th className="text-left py-3 px-4">Department</th>
                    <th className="text-right py-3 px-4">Calls</th>
                    <th className="text-right py-3 px-4">Positive %</th>
                    <th className="text-right py-3 px-4">Negative</th>
                    <th className="text-left py-3 px-4 w-40">Distribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {departmentData.map((dept) => (
                    <tr
                      key={dept.name}
                      className="hover:bg-gray-800/30 cursor-pointer"
                      onClick={() => handleDepartmentClick(dept.name)}
                    >
                      <td className="py-3 px-4 text-white text-sm">{dept.name}</td>
                      <td className="py-3 px-4 text-gray-400 text-sm text-right">
                        {dept.count.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-green-400 text-sm text-right">
                        {dept.positiveRate}%
                      </td>
                      <td className="py-3 px-4 text-red-400 text-sm text-right">
                        {dept.negative}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-0.5 h-2">
                          <div
                            className="bg-green-500 rounded-l"
                            style={{ width: `${dept.positiveRate}%` }}
                          />
                          <div
                            className="bg-gray-600"
                            style={{ width: `${100 - parseFloat(dept.positiveRate) - parseFloat(dept.negativeRate)}%` }}
                          />
                          <div
                            className="bg-red-500 rounded-r"
                            style={{ width: `${dept.negativeRate}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Agent Leaderboard */}
      <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] overflow-hidden">
        <button
          onClick={() => toggleSection('agents')}
          className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <Users className="h-5 w-5 text-cyan-400" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-white">Agent Leaderboard</h3>
              <p className="text-sm text-gray-500">Top agents by call volume</p>
            </div>
          </div>
          {expandedSection === 'agents' ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSection === 'agents' && (
          <div className="p-6 pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {agentLeaderboard.map((agent, index) => (
                <div
                  key={agent.name}
                  className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-xl cursor-pointer hover:bg-gray-800/50 transition-colors"
                  onClick={() => handleAgentClick(agent.name)}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : index === 1
                        ? 'bg-gray-400/20 text-gray-300'
                        : index === 2
                        ? 'bg-amber-600/20 text-amber-500'
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{agent.name}</p>
                    <p className="text-xs text-gray-500">{agent.count.toLocaleString()} calls</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Data Info Footer */}
      <div className="text-center text-xs text-gray-500 py-4">
        Data generated: {new Date(stats.generatedAt).toLocaleString()}
        <br />
        <span className="text-gray-600">
          Run <code>node scripts/analyze-transcripts.mjs</code> to update with AI analysis
        </span>
      </div>

      {/* Transcript Drill-Down Modal */}
      <TranscriptModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        filterType={modalFilterType}
        filterValue={modalFilterValue}
      />
    </div>
  );
}
