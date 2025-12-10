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
  LineChart,
  Line,
} from 'recharts';
import {
  Phone,
  Clock,
  TrendingUp,
  TrendingDown,
  Users,
  User,
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
  X,
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

// New interface for AI-analyzed daily trends
interface AIDailyTrend {
  date: string;
  total: number;
  agentPositive: number;
  agentNeutral: number;
  agentNegative: number;
  customerPositive: number;
  customerNeutral: number;
  customerNegative: number;
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

interface DeepAnalysisData {
  metadata: {
    totalTickets: number;
    analyzedTickets: number;
    totalCost: number;
    analysisDate: string;
  };
  summary: {
    agentSentiment: {
      positive: number;
      neutral: number;
      negative: number;
    };
    customerSentiment: {
      positive: number;
      neutral: number;
      negative: number;
    };
    avgAgentScore: number;
    avgCustomerScore: number;
  };
  topics: {
    mainTopics: Array<{ name: string; count: number; avgConfidence: number }>;
    subcategories: Array<{ name: string; count: number; parentTopic: string }>;
    uncategorized?: Array<{ parentTopic: string; count: number }>;
  };
  tickets: Array<{
    ticketKey: string;
    aiDiscoveredTopic: string;
    aiDiscoveredSubcategory: string;
    agentSentiment: string;
    customerSentiment: string;
  }>;
}

export default function TranscriptsAnalysis() {
  const [stats, setStats] = useState<TranscriptStats | null>(null);
  const [deepAnalysis, setDeepAnalysis] = useState<DeepAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveAnalysis, setLiveAnalysis] = useState<any>(null);

  // Filters
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedSentiment, setSelectedSentiment] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded sections - expand ALL by default (including individual topics)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['calendar', 'overview', 'topics', 'time', 'departments', 'agents'])
  );

  // Collapsed topics - track which topics are explicitly collapsed (default: none, all expanded)
  const [collapsedTopics, setCollapsedTopics] = useState<Set<string>>(new Set());

  // Calendar month navigation
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  // Modal state for drill-down
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalFilterType, setModalFilterType] = useState<'agentSentiment' | 'customerSentiment' | 'topic' | 'topicNoSubcategory' | 'department' | 'agent' | 'all' | 'date' | 'hour' | 'dayOfWeek'>('all');
  const [modalFilterValue, setModalFilterValue] = useState('');

  // Global date range filter (default: last 7 days)
  const getDefaultStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  };

  const getDefaultEndDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const [globalStartDate, setGlobalStartDate] = useState(getDefaultStartDate());
  const [globalEndDate, setGlobalEndDate] = useState(getDefaultEndDate());
  const [appliedStartDate, setAppliedStartDate] = useState(getDefaultStartDate());
  const [appliedEndDate, setAppliedEndDate] = useState(getDefaultEndDate());
  const [loadingFilteredData, setLoadingFilteredData] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load analysis data from database
        try {
          const params = new URLSearchParams({ type: 'summary' });
          if (appliedStartDate && appliedEndDate) {
            params.append('startDate', appliedStartDate);
            params.append('endDate', appliedEndDate);
          }
          const liveRes = await fetch(`/api/transcript-analytics?${params.toString()}`);
          if (liveRes.ok) {
            const liveData = await liveRes.json();
            if (liveData.success) {
              setLiveAnalysis(liveData);
              // Convert to deepAnalysis format for compatibility
              console.log('📊 Topics data from API:', liveData.topics);
              console.log('📊 Uncategorized data:', liveData.topics?.uncategorized);
              setDeepAnalysis({
                metadata: {
                  totalTickets: liveData.metadata.totalTranscripts,
                  analyzedTickets: liveData.metadata.analyzedTranscripts,
                  totalCost: 0,
                  analysisDate: new Date().toISOString(),
                },
                summary: liveData.summary,
                topics: liveData.topics,
                tickets: [],
              });

              // Update stats with filtered data from API
              setStats({
                totalCalls: liveData.metadata.totalTranscripts || 0,
                generatedAt: new Date().toISOString(),
                sentimentDistribution: {
                  positive: liveData.summary?.customerSentiment?.positive || 0,
                  negative: liveData.summary?.customerSentiment?.negative || 0,
                  neutral: liveData.summary?.customerSentiment?.neutral || 0,
                },
                emotionDistribution: {},
                resolutionDistribution: {},
                topicDistribution: {},
                escalationRiskDistribution: {},
                byDepartment: liveData.byDepartment || {},
                byAgent: {},
                byDayOfWeek: liveData.byDayOfWeek || {},
                byHour: liveData.byHour || {},
                avgDuration: 0,
                avgHoldTime: 0,
                avgMessagesPerCall: 24, // Default from the API response
                avgAgentPerformance: liveData.summary?.avgAgentScore || null,
                dailyTrends: liveData.dailyTrends || [],
              });

              console.log('✨ Live analysis loaded:', liveData.metadata.analyzedTranscripts, 'transcripts analyzed');
            }
          }
        } catch (liveErr) {
          console.error('Failed to load analysis from API:', liveErr);
        }

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setLoading(false);
      }
    };

    loadData();
  }, [appliedStartDate, appliedEndDate]);

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

  // Format date for display (avoiding timezone issues)
  const formatDate = (dateStr: string) => {
    // Parse YYYY-MM-DD directly to avoid timezone shifts
    const [year, month, day] = dateStr.split('-').map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[month - 1]} ${day}`;
  };

  // Prepare topic data for chart
  const topicChartData = useMemo(() => {
    // Use AI-discovered topics if available (from live analysis)
    if (liveAnalysis?.topics?.mainTopics && liveAnalysis.topics.mainTopics.length > 0) {
      return liveAnalysis.topics.mainTopics
        .slice(0, 10)
        .map((t: any) => ({
          name: t.name,
          value: t.count,
          topic: t.name, // Keep original case for filtering (e.g., "Insurance" not "insurance")
        }));
    }

    // Fallback to static topics from JSON
    if (!stats) return [];
    return Object.entries(stats.topicDistribution)
      .map(([topic, count]) => ({
        name: TOPIC_LABELS[topic] || topic,
        value: count,
        topic,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [stats, liveAnalysis]);

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

  // Prepare department data
  const departmentData = useMemo(() => {
    if (!stats) return [];

    // Exclude specific departments: IRS Agent, Collection, BK, Bankruptcy, Disaster, Loss Mit
    const excludedDepartments = ['IRS', 'COLLECTION', 'BK', 'BANKRUPTCY', 'DISASTER', 'LOSS MIT', 'LOSS MITIGATION'];

    return Object.entries(stats.byDepartment)
      .filter(([name]) => {
        if (name === 'NULL') return false;
        const upperName = name.toUpperCase();
        return !excludedDepartments.some(excluded => upperName.includes(excluded));
      })
      .map(([name, data]) => ({
        name: name.replace('SRVC - ', '').replace('SRVC/', ''), // Display name
        originalName: name, // Keep original for filtering
        ...data,
        positiveRate: ((data.positive / data.count) * 100).toFixed(1),
        negativeRate: ((data.negative / data.count) * 100).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count);
  }, [stats]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  // Drill-down handlers
  const openDrillDown = (filterType: 'agentSentiment' | 'customerSentiment' | 'topic' | 'topicNoSubcategory' | 'department' | 'agent' | 'all' | 'date' | 'hour' | 'dayOfWeek', filterValue: string, title: string) => {
    setModalFilterType(filterType);
    setModalFilterValue(filterValue);
    setModalTitle(title);
    setModalOpen(true);
  };

  const handleTopicClick = (topic: string, label: string) => {
    openDrillDown('topic', topic, `${label} Calls`);
  };

  const handleDepartmentClick = (originalName: string, displayName: string) => {
    openDrillDown('department', originalName, `${displayName} Calls`);
  };

  const handleAgentClick = (agentName: string) => {
    openDrillDown('agent', agentName, `Calls by ${agentName}`);
  };

  // Apply global date range filter
  const applyGlobalFilter = () => {
    if (!globalStartDate || !globalEndDate) {
      alert('Please select both start and end dates');
      return;
    }
    // Update applied dates - useEffect will automatically fetch new data
    setAppliedStartDate(globalStartDate);
    setAppliedEndDate(globalEndDate);
  };

  // Clear global date range filter
  const clearGlobalFilter = () => {
    const defaultStart = getDefaultStartDate();
    const defaultEnd = getDefaultEndDate();
    setGlobalStartDate(defaultStart);
    setGlobalEndDate(defaultEnd);
    setAppliedStartDate(defaultStart);
    setAppliedEndDate(defaultEnd);
    // useEffect will automatically fetch data with default dates
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
      {/* Global Search Bar */}
      <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 rounded-2xl p-6 border border-blue-500/20">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
            <Search className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Search Transcripts</h2>
            <p className="text-sm text-gray-400">Find specific conversations quickly</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                openDrillDown('all', searchQuery, `Search: "${searchQuery}"`);
              }
            }}
            placeholder="Search by agent name, department, vendor call key, or keywords..."
            className="w-full pl-12 pr-32 py-4 bg-[#0a0e17] border border-white/[0.08] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all text-lg"
          />
          <button
            onClick={() => {
              if (searchQuery.trim()) {
                openDrillDown('all', searchQuery, `Search: "${searchQuery}"`);
              }
            }}
            disabled={!searchQuery.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all"
          >
            <Search className="h-4 w-4" />
            Search
          </button>
        </div>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="mt-3 text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Clear search
          </button>
        )}
      </div>

      {/* Header Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <MessageSquare className="h-4 w-4" />
            <span className="text-sm">Avg Messages</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.avgMessagesPerCall}</div>
          <div className="text-xs text-gray-500 mt-1">per conversation</div>
        </div>
      </div>

      {/* Calendar Sentiment View */}
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
              <h3 className="text-lg font-semibold text-white">Daily Sentiment Calendar</h3>
              <p className="text-sm text-gray-500">See sentiment breakdown for each day <span className="text-blue-400">Click any day to view transcripts</span></p>
            </div>
          </div>
          {expandedSections.has('calendar') ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('calendar') && (
          <div className="p-6 pt-0">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => {
                  const newMonth = new Date(calendarMonth);
                  newMonth.setMonth(newMonth.getMonth() - 1);
                  setCalendarMonth(newMonth);
                }}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors text-sm text-gray-300"
              >
                <ChevronDown className="h-4 w-4 rotate-90" />
                Previous
              </button>
              <div className="text-lg font-semibold text-white">
                {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
              <button
                onClick={() => {
                  const newMonth = new Date(calendarMonth);
                  newMonth.setMonth(newMonth.getMonth() + 1);
                  if (newMonth <= new Date()) {
                    setCalendarMonth(newMonth);
                  }
                }}
                disabled={new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1) > new Date()}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors text-sm text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronDown className="h-4 w-4 -rotate-90" />
              </button>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mb-4 text-xs text-gray-400">
              {liveAnalysis?.dailyTrends && liveAnalysis.dailyTrends.length > 0 ? (
                <>
                  <div className="flex items-center gap-1">
                    <div className="w-8 h-0.5 bg-blue-500"></div>
                    <span>Agent Performance</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-8 h-0.5 bg-emerald-500"></div>
                    <span>Customer Satisfaction</span>
                  </div>
                  <span className="text-gray-600">|</span>
                  <span>Mini charts show ±3 day trends (AI-analyzed calls only)</span>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1">
                    <div className="w-8 h-0.5 bg-emerald-500"></div>
                    <span>High Sentiment</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-8 h-0.5 bg-gray-500"></div>
                    <span>Mid Sentiment</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-8 h-0.5 bg-red-500"></div>
                    <span>Low Sentiment</span>
                  </div>
                  <span className="text-gray-600">|</span>
                  <span>Mini charts show ±3 day trends</span>
                </>
              )}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs text-gray-500 py-1 font-medium">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {(() => {
                // Generate calendar cells for the selected month
                // Use live AI analysis data if available, otherwise fall back to static data
                const useLiveData = liveAnalysis?.dailyTrends && liveAnalysis.dailyTrends.length > 0;
                const dailyData = useLiveData ? liveAnalysis.dailyTrends : stats.dailyTrends;
                const sortedDays = [...dailyData].sort((a, b) => a.date.localeCompare(b.date));
                if (sortedDays.length === 0) return null;

                // Calculate start and end of selected month
                const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
                const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);

                // Adjust to beginning of week for calendar grid
                const calendarStart = new Date(monthStart);
                calendarStart.setDate(calendarStart.getDate() - calendarStart.getDay());

                // Adjust to end of week for calendar grid
                const calendarEnd = new Date(monthEnd);
                calendarEnd.setDate(calendarEnd.getDate() + (6 - calendarEnd.getDay()));

                const cells = [];
                const dayMap = new Map(sortedDays.map(d => [d.date, d]));

                // Helper to format date consistently (avoiding timezone issues)
                const formatDateStr = (d: Date) => {
                  const year = d.getFullYear();
                  const month = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  return `${year}-${month}-${day}`;
                };

                // Helper to get sparkline data for a date (±3 days)
                const getSparklineData = (centerDate: string) => {
                  const center = new Date(centerDate + 'T12:00:00'); // Use noon to avoid DST issues
                  const data = [];
                  for (let offset = -3; offset <= 3; offset++) {
                    const d = new Date(center);
                    d.setDate(d.getDate() + offset);
                    const dateStr = formatDateStr(d);
                    const dayData = dayMap.get(dateStr);
                    if (dayData && dayData.total > 0) {
                      if (useLiveData) {
                        // Use agent/customer sentiment from AI analysis
                        const agentPositive = dayData.agentPositive || 0;
                        const customerPositive = dayData.customerPositive || 0;
                        const agentPositivePercent = (agentPositive / dayData.total) * 100;
                        const customerPositivePercent = (customerPositive / dayData.total) * 100;
                        data.push({
                          day: offset,
                          agentPerformance: agentPositivePercent,
                          customerSatisfaction: customerPositivePercent,
                        });
                      } else {
                        // Use old generic sentiment
                        data.push({
                          day: offset,
                          positive: (dayData.positive / dayData.total) * 100,
                          neutral: (dayData.neutral / dayData.total) * 100,
                          negative: (dayData.negative / dayData.total) * 100,
                        });
                      }
                    }
                  }
                  return data;
                };

                const currentDate = new Date(calendarStart);
                while (currentDate <= calendarEnd) {
                  // Use local date formatting to avoid timezone issues
                  const year = currentDate.getFullYear();
                  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                  const day = String(currentDate.getDate()).padStart(2, '0');
                  const dateStr = `${year}-${month}-${day}`;
                  const dayData = dayMap.get(dateStr);

                  // Check if this day is in the current calendar month
                  const isCurrentMonth = currentDate.getMonth() === calendarMonth.getMonth();

                  if (dayData) {
                    const total = dayData.total || 0;
                    // Use correct field names based on data source
                    const positive = useLiveData
                      ? ((dayData.agentPositive || 0) + (dayData.customerPositive || 0))
                      : (dayData.positive || 0);
                    const neutral = useLiveData
                      ? ((dayData.agentNeutral || 0) + (dayData.customerNeutral || 0))
                      : (dayData.neutral || 0);
                    const negative = useLiveData
                      ? ((dayData.agentNegative || 0) + (dayData.customerNegative || 0))
                      : (dayData.negative || 0);
                    const positivePercent = total > 0 ? (positive / total) * 100 : 0;
                    const neutralPercent = total > 0 ? (neutral / total) * 100 : 0;
                    const negativePercent = total > 0 ? (negative / total) * 100 : 0;
                    const sparklineData = getSparklineData(dateStr);

                    cells.push(
                      <button
                        key={dateStr}
                        onClick={() => openDrillDown('date', dateStr, `Calls on ${formatDate(dateStr)}`)}
                        className={`rounded-lg p-1.5 hover:ring-2 hover:ring-blue-400 transition-all relative group min-h-[80px] flex flex-col ${
                          isCurrentMonth ? 'bg-gray-800/50' : 'bg-gray-900/30 opacity-40'
                        }`}
                        title={`${formatDate(dateStr)}: ${total} calls`}
                      >
                        {/* Date label */}
                        <span className={`text-[10px] font-medium ${isCurrentMonth ? 'text-gray-400' : 'text-gray-600'}`}>
                          {currentDate.getDate()}
                        </span>

                        {/* Mini sparkline chart */}
                        <div className="flex-1 w-full">
                          {sparklineData.length >= 2 ? (
                            <ResponsiveContainer width="100%" height={36}>
                              <LineChart data={sparklineData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                                {useLiveData ? (
                                  <>
                                    {/* Agent Performance Line (Blue) */}
                                    <Line
                                      type="monotone"
                                      dataKey="agentPerformance"
                                      stroke="#3b82f6"
                                      strokeWidth={1.5}
                                      dot={false}
                                      isAnimationActive={false}
                                    />
                                    {/* Customer Satisfaction Line (Green) */}
                                    <Line
                                      type="monotone"
                                      dataKey="customerSatisfaction"
                                      stroke="#22c55e"
                                      strokeWidth={1.5}
                                      dot={false}
                                      isAnimationActive={false}
                                    />
                                  </>
                                ) : (
                                  <>
                                    {/* Old generic sentiment lines */}
                                    <Line
                                      type="monotone"
                                      dataKey="positive"
                                      stroke="#22c55e"
                                      strokeWidth={1.5}
                                      dot={false}
                                      isAnimationActive={false}
                                    />
                                    <Line
                                      type="monotone"
                                      dataKey="neutral"
                                      stroke="#6b7280"
                                      strokeWidth={1}
                                      dot={false}
                                      isAnimationActive={false}
                                    />
                                    <Line
                                      type="monotone"
                                      dataKey="negative"
                                      stroke="#ef4444"
                                      strokeWidth={1.5}
                                      dot={false}
                                      isAnimationActive={false}
                                    />
                                  </>
                                )}
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            // Fallback: show sentiment dots if not enough data for sparkline
                            <div className="flex items-center justify-center h-full gap-1">
                              <div className="w-2 h-2 rounded-full bg-emerald-500" style={{ opacity: positivePercent / 100 }} />
                              <div className="w-2 h-2 rounded-full bg-gray-500" style={{ opacity: neutralPercent / 100 }} />
                              <div className="w-2 h-2 rounded-full bg-red-500" style={{ opacity: negativePercent / 100 }} />
                            </div>
                          )}
                        </div>

                        {/* Call count */}
                        <span className="text-[9px] text-gray-500">{total}</span>

                        {/* Hover tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 border border-gray-700 shadow-xl">
                          <div className="font-medium text-white mb-1">{formatDate(dateStr)}</div>
                          <div className="text-gray-400">{total} total calls</div>
                          <div className="flex flex-col gap-0.5 mt-1">
                            <span className="text-emerald-400">● {positive} high sentiment ({positivePercent.toFixed(0)}%)</span>
                            <span className="text-gray-400">● {neutral} mid sentiment ({neutralPercent.toFixed(0)}%)</span>
                            <span className="text-red-400">● {negative} low sentiment ({negativePercent.toFixed(0)}%)</span>
                          </div>
                        </div>
                      </button>
                    );
                  } else {
                    // Empty cell for days without data
                    cells.push(
                      <div
                        key={dateStr}
                        className={`rounded-lg p-1.5 min-h-[80px] flex flex-col ${
                          isCurrentMonth ? 'bg-gray-900/20' : 'bg-gray-900/10 opacity-20'
                        }`}
                      >
                        <span className={`text-[10px] font-medium ${isCurrentMonth ? 'text-gray-600' : 'text-gray-700'}`}>
                          {currentDate.getDate()}
                        </span>
                      </div>
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

      {/* Global Date Range Filter */}
      <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 rounded-2xl p-6 border border-blue-500/20 sticky top-4 z-10 backdrop-blur-sm">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">Global Date Range Filter</h2>
            <p className="text-sm text-gray-400">Filter all data below by date range (Default: Last 7 days)</p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-300 font-medium">From:</label>
            <input
              type="date"
              value={globalStartDate}
              onChange={(e) => setGlobalStartDate(e.target.value)}
              className="bg-[#0a0e17] border border-white/[0.08] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-300 font-medium">To:</label>
            <input
              type="date"
              value={globalEndDate}
              onChange={(e) => setGlobalEndDate(e.target.value)}
              className="bg-[#0a0e17] border border-white/[0.08] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
          <button
            onClick={applyGlobalFilter}
            disabled={!globalStartDate || !globalEndDate || loadingFilteredData}
            className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all"
          >
            {loadingFilteredData ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Apply Filter
              </>
            )}
          </button>
          {(appliedStartDate !== getDefaultStartDate() || appliedEndDate !== getDefaultEndDate()) && (
            <button
              onClick={clearGlobalFilter}
              className="text-blue-400 hover:text-blue-300 text-sm underline flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Reset to Default (7 days)
            </button>
          )}
        </div>
        {appliedStartDate && appliedEndDate && (
          <div className="mt-3 text-sm">
            <span className="text-green-400 font-medium">
              ✓ Showing data from {appliedStartDate} to {appliedEndDate}
            </span>
            <span className="text-gray-500 ml-2">
              ({Math.ceil((new Date(appliedEndDate).getTime() - new Date(appliedStartDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days)
            </span>
          </div>
        )}
      </div>

      {/* Agent vs Customer Sentiment (Deep Analysis) */}
      {deepAnalysis && (
        <div className="bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-2xl border border-blue-500/30 overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-blue-500/5 to-purple-500/5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  Agent vs Customer Sentiment
                  <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">
                    Deep Analysis
                  </span>
                </h3>
                <p className="text-sm text-gray-400">
                  Comparing agent performance with customer satisfaction • {deepAnalysis.metadata.analyzedTickets.toLocaleString()} tickets
                </p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Agent Sentiment */}
              <div className="bg-[#131a29] rounded-xl p-4 border border-white/[0.08]">
                <h4 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-400" />
                  Agent Performance Sentiment
                </h4>
                <div className="space-y-3">
                  <div
                    className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/30 cursor-pointer hover:bg-green-500/20 transition-colors"
                    onClick={() => openDrillDown('agentSentiment', 'positive', 'Positive Agent Performance Calls')}
                  >
                    <div className="flex items-center gap-2">
                      <ThumbsUp className="h-4 w-4 text-green-400" />
                      <span className="text-white text-sm">Positive</span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-400">
                        {((deepAnalysis.summary.agentSentiment.positive / deepAnalysis.metadata.analyzedTickets) * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {deepAnalysis.summary.agentSentiment.positive.toLocaleString()} calls
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-500/10 border border-gray-500/30 cursor-pointer hover:bg-gray-500/20 transition-colors"
                    onClick={() => openDrillDown('agentSentiment', 'neutral', 'Neutral Agent Performance Calls')}
                  >
                    <div className="flex items-center gap-2">
                      <Minus className="h-4 w-4 text-gray-400" />
                      <span className="text-white text-sm">Neutral</span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-400">
                        {((deepAnalysis.summary.agentSentiment.neutral / deepAnalysis.metadata.analyzedTickets) * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {deepAnalysis.summary.agentSentiment.neutral.toLocaleString()} calls
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/30 cursor-pointer hover:bg-red-500/20 transition-colors"
                    onClick={() => openDrillDown('agentSentiment', 'negative', 'Negative Agent Performance Calls')}
                  >
                    <div className="flex items-center gap-2">
                      <ThumbsDown className="h-4 w-4 text-red-400" />
                      <span className="text-white text-sm">Negative</span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-400">
                        {((deepAnalysis.summary.agentSentiment.negative / deepAnalysis.metadata.analyzedTickets) * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {deepAnalysis.summary.agentSentiment.negative.toLocaleString()} calls
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
                  <div className="text-xs text-gray-500">Average Agent Score</div>
                  <div className="text-2xl font-bold text-blue-400">
                    {(deepAnalysis.summary.avgAgentScore * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Customer Sentiment */}
              <div className="bg-[#131a29] rounded-xl p-4 border border-white/[0.08]">
                <h4 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-400" />
                  Customer Satisfaction Sentiment
                </h4>
                <div className="space-y-3">
                  <div
                    className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/30 cursor-pointer hover:bg-green-500/20 transition-colors"
                    onClick={() => openDrillDown('customerSentiment', 'positive', 'Positive Customer Sentiment Calls')}
                  >
                    <div className="flex items-center gap-2">
                      <ThumbsUp className="h-4 w-4 text-green-400" />
                      <span className="text-white text-sm">Positive</span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-400">
                        {((deepAnalysis.summary.customerSentiment.positive / deepAnalysis.metadata.analyzedTickets) * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {deepAnalysis.summary.customerSentiment.positive.toLocaleString()} calls
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-500/10 border border-gray-500/30 cursor-pointer hover:bg-gray-500/20 transition-colors"
                    onClick={() => openDrillDown('customerSentiment', 'neutral', 'Neutral Customer Sentiment Calls')}
                  >
                    <div className="flex items-center gap-2">
                      <Minus className="h-4 w-4 text-gray-400" />
                      <span className="text-white text-sm">Neutral</span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-400">
                        {((deepAnalysis.summary.customerSentiment.neutral / deepAnalysis.metadata.analyzedTickets) * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {deepAnalysis.summary.customerSentiment.neutral.toLocaleString()} calls
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/30 cursor-pointer hover:bg-red-500/20 transition-colors"
                    onClick={() => openDrillDown('customerSentiment', 'negative', 'Negative Customer Sentiment Calls')}
                  >
                    <div className="flex items-center gap-2">
                      <ThumbsDown className="h-4 w-4 text-red-400" />
                      <span className="text-white text-sm">Negative</span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-400">
                        {((deepAnalysis.summary.customerSentiment.negative / deepAnalysis.metadata.analyzedTickets) * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {deepAnalysis.summary.customerSentiment.negative.toLocaleString()} calls
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-purple-500/5 rounded-lg border border-purple-500/20">
                  <div className="text-xs text-gray-500">Average Customer Score</div>
                  <div className="text-2xl font-bold text-purple-400">
                    {(deepAnalysis.summary.avgCustomerScore * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
          {expandedSections.has('topics') ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('topics') && (
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
                  labelStyle={{ color: '#ffffff' }}
                  itemStyle={{ color: '#ffffff' }}
                  formatter={(value: number) => [value.toLocaleString(), 'Calls']}
                />
                <Bar
                  dataKey="value"
                  radius={[0, 4, 4, 0]}
                  style={{ cursor: 'pointer' }}
                >
                  {topicChartData.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={TOPIC_COLORS[index % TOPIC_COLORS.length]}
                      className="hover:opacity-80 cursor-pointer"
                      onClick={() => handleTopicClick(entry.topic, entry.name)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* AI-Discovered Topics (Deep Analysis) */}
      {deepAnalysis && deepAnalysis.topics.mainTopics.length > 0 && (
        <div className="bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-purple-500/10 rounded-2xl border border-purple-500/30 overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-purple-500/5 to-blue-500/5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  ✨ AI-Discovered Topics
                  <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-300 rounded-full border border-purple-500/30">
                    Deep Analysis
                  </span>
                </h3>
                <p className="text-sm text-gray-400">
                  {deepAnalysis.metadata.analyzedTickets.toLocaleString()} tickets analyzed • {deepAnalysis.topics.mainTopics.length} unique topics found • <span className="text-purple-400">Click bars to drill down</span>
                </p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-6">
            {/* Main Topics Bar Chart */}
            <div className="bg-[#131a29] rounded-xl border border-white/[0.08] p-4">
              <h4 className="text-sm font-medium text-gray-400 mb-4">Main Topics by Volume</h4>
              <div className="space-y-2">
                {deepAnalysis.topics.mainTopics
                  .slice()
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 20)
                  .map((topic, index) => {
                    const maxCount = Math.max(...deepAnalysis.topics.mainTopics.map(t => t.count));
                    const percentage = (topic.count / maxCount) * 100;
                    const topicSubcategories = deepAnalysis.topics.subcategories.filter(
                      (sub) => sub.parentTopic === topic.name
                    );
                    // Topics are expanded by default unless explicitly collapsed
                    const isExpanded = !collapsedTopics.has(topic.name);

                    return (
                      <div key={topic.name} className="space-y-2">
                        {/* Main Topic Bar */}
                        <div className="space-y-1 bg-white/[0.02] rounded-lg p-3">
                          {/* Topic Name Row (Full Width) */}
                          <div className="flex items-center gap-2 mb-2">
                            {topicSubcategories.length > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCollapsedTopics(prev => {
                                    const newSet = new Set(prev);
                                    if (newSet.has(topic.name)) {
                                      newSet.delete(topic.name);
                                    } else {
                                      newSet.add(topic.name);
                                    }
                                    return newSet;
                                  });
                                }}
                                className="hover:bg-purple-500/20 rounded p-1 transition-all border border-purple-500/30 flex-shrink-0"
                                title={isExpanded ? "Collapse subcategories" : "Expand subcategories"}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-purple-400" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-purple-400" />
                                )}
                              </button>
                            )}
                            {topicSubcategories.length === 0 && (
                              <div className="w-6 flex-shrink-0" />
                            )}
                            <span
                              className="text-sm text-white font-medium group-hover:text-purple-300 transition-colors flex-1"
                              title={topic.name}
                            >
                              {topic.name}
                            </span>
                            {topicSubcategories.length > 0 && (
                              <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 flex-shrink-0 whitespace-nowrap">
                                {topicSubcategories.length} subcategories
                              </span>
                            )}
                            {(() => {
                              const uncategorizedForTopic = deepAnalysis.topics.uncategorized?.find(
                                (u: any) => u.parentTopic === topic.name
                              );
                              if (uncategorizedForTopic && uncategorizedForTopic.count > 0) {
                                return (
                                  <span className="text-[10px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20 flex-shrink-0 whitespace-nowrap">
                                    +{uncategorizedForTopic.count} uncategorized
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          {/* Chart Bar Row */}
                          <div
                            className="flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors rounded-lg p-2 group"
                            onClick={() => {
                              openDrillDown('topic', topic.name, `${topic.name} Calls`);
                            }}
                          >
                            <div className="w-12 text-left flex-shrink-0">
                              <span className="text-xs text-gray-400">
                                #{index + 1}
                              </span>
                            </div>
                          <div className="flex-1 relative">
                            <div className="h-8 bg-gray-800/50 rounded-lg overflow-hidden">
                              <div
                                className="h-full rounded-lg transition-all duration-300 hover:opacity-80 relative"
                                style={{
                                  width: `${percentage}%`,
                                  backgroundColor: TOPIC_COLORS[index % TOPIC_COLORS.length],
                                }}
                              >
                                {/* Show count inside bar if there's enough space */}
                                {percentage > 15 && (
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-white">
                                    {topic.count.toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="w-20 text-right flex flex-col items-end">
                            {percentage <= 15 && (
                              <span className="text-sm font-bold text-purple-400">
                                {topic.count.toLocaleString()}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              {(topic.avgConfidence * 100).toFixed(0)}% conf
                            </span>
                          </div>
                          </div>
                        </div>

                        {/* Subcategories Bar Chart (collapsible) */}
                        {isExpanded && topicSubcategories.length > 0 && (
                          <div className="ml-8 pl-4 space-y-2 border-l-2 border-purple-500/20 bg-gradient-to-r from-purple-500/5 to-transparent rounded-r-lg p-3">
                            <div className="text-[10px] text-purple-400 uppercase tracking-wider mb-2 font-semibold">
                              ↳ Subcategories
                            </div>
                            {topicSubcategories
                              .slice()
                              .sort((a, b) => b.count - a.count)
                              .map((sub, subIndex) => {
                                const maxSubCount = Math.max(...topicSubcategories.map(s => s.count));
                                const subPercentage = (sub.count / maxSubCount) * 100;

                                return (
                                  <div
                                    key={sub.name}
                                    className="cursor-pointer hover:bg-purple-500/10 transition-colors rounded-lg p-2 group border border-transparent hover:border-purple-500/30"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDrillDown('topic', sub.name, `${sub.name} Calls`);
                                    }}
                                  >
                                    {/* Subcategory name (full width) */}
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <span className="text-purple-400 text-[10px] flex-shrink-0">→</span>
                                      <span
                                        className="text-xs text-gray-300 font-medium group-hover:text-purple-200 transition-colors flex-1"
                                        title={sub.name}
                                      >
                                        {sub.name}
                                      </span>
                                    </div>
                                    {/* Bar chart */}
                                    <div className="flex items-center gap-3">
                                      <div className="flex-1 relative">
                                        <div className="h-6 bg-gray-800/50 rounded-md overflow-hidden">
                                          <div
                                            className="h-full rounded-md transition-all duration-300 hover:opacity-80 relative"
                                            style={{
                                              width: `${subPercentage}%`,
                                              backgroundColor: TOPIC_COLORS[(index + subIndex + 1) % TOPIC_COLORS.length],
                                              opacity: 0.8,
                                            }}
                                          >
                                            {subPercentage > 20 && (
                                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-white">
                                                {sub.count.toLocaleString()}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="w-16 text-right flex-shrink-0">
                                        {subPercentage <= 20 && (
                                          <span className="text-xs font-semibold text-purple-300">
                                            {sub.count.toLocaleString()}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}

                            {/* No Subcategory Bar - Show calls without subcategories */}
                            {(() => {
                              const uncategorizedForTopic = deepAnalysis.topics.uncategorized?.find(
                                (u: any) => u.parentTopic === topic.name
                              );
                              if (uncategorizedForTopic && uncategorizedForTopic.count > 0) {
                                const maxSubCount = Math.max(...topicSubcategories.map(s => s.count));
                                const uncatPercentage = (uncategorizedForTopic.count / maxSubCount) * 100;

                                return (
                                  <div
                                    className="flex items-center gap-3 cursor-pointer hover:bg-white/[0.05] transition-colors rounded-lg p-1.5 group border border-orange-500/30 bg-orange-500/5"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDrillDown('topicNoSubcategory', topic.name, `${topic.name} - No Subcategory`);
                                    }}
                                  >
                                    <div className="w-32 min-w-[8rem]">
                                      <span className="text-xs text-orange-400 font-semibold truncate group-hover:text-orange-300 transition-colors">
                                        ⚠ No Subcategory
                                      </span>
                                    </div>
                                    <div className="flex-1 relative">
                                      <div className="h-6 bg-gray-800/50 rounded-md overflow-hidden border border-orange-500/20">
                                        <div
                                          className="h-full rounded-md transition-all duration-300 hover:opacity-90 relative"
                                          style={{
                                            width: `${uncatPercentage}%`,
                                            background: 'linear-gradient(90deg, #f97316 0%, #fb923c 100%)',
                                            opacity: 0.85,
                                          }}
                                        >
                                          {uncatPercentage > 20 && (
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-white drop-shadow-md">
                                              {uncategorizedForTopic.count.toLocaleString()}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="w-16 text-right">
                                      {uncatPercentage <= 20 && (
                                        <span className="text-xs font-bold text-orange-400">
                                          {uncategorizedForTopic.count.toLocaleString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Time Analysis */}
      <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] overflow-hidden">
        <button
          onClick={() => toggleSection('time')}
          className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Timer className="h-5 w-5 text-purple-400" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-white">Call Timing Patterns</h3>
              <p className="text-sm text-gray-500">When are calls happening?</p>
            </div>
          </div>
          {expandedSections.has('time') ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('time') && (
          <div className="p-6 pt-0 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hourly Distribution */}
            <div className="bg-gray-800/30 rounded-xl p-4">
              <h4 className="text-sm font-medium text-gray-400 mb-4">Calls by Hour (UTC) <span className="text-blue-400">Click bars to drill down</span></h4>
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
                    labelStyle={{ color: '#ffffff' }}
                    itemStyle={{ color: '#ffffff' }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#8b5cf6"
                    radius={[4, 4, 0, 0]}
                    onClick={(data: any) => {
                      if (data && data.hour) {
                        openDrillDown('hour', data.hour, `Calls at ${data.hour}`);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Day of Week */}
            <div className="bg-gray-800/30 rounded-xl p-4">
              <h4 className="text-sm font-medium text-gray-400 mb-4">Calls by Day of Week <span className="text-blue-400">Click bars to drill down</span></h4>
              <div className="space-y-3">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                  const count = stats.byDayOfWeek[day] || 0;
                  const maxCount = Math.max(...Object.values(stats.byDayOfWeek));
                  const percentage = (count / maxCount) * 100;

                  return (
                    <div
                      key={day}
                      className="flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] rounded-lg p-1 transition-colors"
                      onClick={() => openDrillDown('dayOfWeek', day, `Calls on ${day}`)}
                    >
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
          {expandedSections.has('departments') ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('departments') && (
          <div className="p-6 pt-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-gray-400 text-xs border-b border-gray-700">
                    <th className="text-left py-3 px-4">Department</th>
                    <th className="text-right py-3 px-4">Calls</th>
                    <th className="text-right py-3 px-4">High Sentiment %</th>
                    <th className="text-right py-3 px-4">Low Sentiment</th>
                    <th className="text-left py-3 px-4 w-40">Distribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {departmentData.map((dept) => (
                    <tr
                      key={dept.name}
                      className="hover:bg-gray-800/30 cursor-pointer"
                      onClick={() => handleDepartmentClick(dept.originalName, dept.name)}
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

      {/* Data Info Footer */}
      <div className="text-center text-xs text-gray-500 py-4">
        Data generated: {new Date(stats.generatedAt).toLocaleString('en-US', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} UTC
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
