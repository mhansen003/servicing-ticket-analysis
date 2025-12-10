'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  X,
  Phone,
  Info,
  Calendar,
  Loader2,
  User,
  ChevronUp,
} from 'lucide-react';
import { AgentProfileCard } from './AgentProfileCard';
import { TranscriptModal } from './TranscriptModal';
import { AgentGradingModal } from './AgentGradingModal';

interface AgentStats {
  name: string;
  email?: string;
  department?: string;
  callCount: number;
  avgDuration: number;

  // Agent Performance Metrics (PRIMARY)
  agentPositiveRate?: number;
  agentNegativeRate?: number;
  agentNeutralRate?: number;
  agentSentimentScore?: number;

  // Customer Sentiment Metrics (SECONDARY)
  customerPositiveRate?: number;
  customerNegativeRate?: number;
  customerNeutralRate?: number;
  customerSentimentScore?: number;

  // Backwards compatibility
  positiveRate: number;
  negativeRate: number;
  neutralRate: number;
  sentimentScore: number;

  performanceTier: 'top' | 'good' | 'average' | 'needs-improvement' | 'critical';
  recentCalls: Array<{
    id: string;
    date: string;
    duration: number;
    sentiment: string;
    summary?: string;
  }>;
}

interface AgentProfile {
  name: string;
  email?: string;
  department?: string;
  metrics: {
    totalCalls: number;
    avgCallDuration: number;
    positiveRate: number;
    negativeRate: number;
    neutralRate: number;
    sentimentScore: number;
    performanceTier: 'top' | 'good' | 'average' | 'needs-improvement' | 'critical';
  };
  strengths: string[];
  areasForImprovement: string[];
  recommendations: string[];
  overallAssessment: string;
  recentCalls: AgentStats['recentCalls'];
}

interface AgentRankings {
  totalAgents: number;
  totalCalls: number;
  topPerformers: AgentStats[];
  needsImprovement: AgentStats[];
  highestVolume: AgentStats[];
  allAgents: AgentStats[];
  distribution: {
    top: number;
    good: number;
    average: number;
    needsImprovement: number;
    critical: number;
  };
}

interface DeepAnalysisData {
  metadata: {
    analyzedTickets: number;
  };
  summary: {
    agentSentiment: {
      positive: number;
      neutral: number;
      negative: number;
    };
    avgAgentScore: number;
  };
  tickets: Array<{
    assignedAgent: string;
    agentSentiment: string;
    agentSentimentScore: number;
    customerSentiment: string;
    customerSentimentScore: number;
  }>;
}

export default function AgentsAnalysis() {
  const [rankings, setRankings] = useState<AgentRankings | null>(null);
  const [deepAnalysis, setDeepAnalysis] = useState<DeepAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentStats | null>(null);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'performance' | 'calls' | 'lowPerformance' | 'duration'>('performance'); // Default to top performers
  const [tierFilter, setTierFilter] = useState<'all' | 'top' | 'good' | 'average' | 'needs-improvement' | 'critical'>('all');

  // Modal state
  const [transcriptModalOpen, setTranscriptModalOpen] = useState(false);
  const [transcriptFilterAgent, setTranscriptFilterAgent] = useState('');
  const [transcriptFilterType, setTranscriptFilterType] = useState<'agent' | 'agentSentiment'>('agent');
  const [transcriptFilterValue, setTranscriptFilterValue] = useState('');
  const [gradingModalOpen, setGradingModalOpen] = useState(false);

  // Global date range filter (default: last 30 days)
  const getDefaultStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  };

  const getDefaultEndDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const getAllTimeStartDate = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 5);
    return date.toISOString().split('T')[0];
  };

  const [globalStartDate, setGlobalStartDate] = useState(getDefaultStartDate());
  const [globalEndDate, setGlobalEndDate] = useState(getDefaultEndDate());
  const [appliedStartDate, setAppliedStartDate] = useState(getDefaultStartDate());
  const [appliedEndDate, setAppliedEndDate] = useState(getDefaultEndDate());
  const [allTime, setAllTime] = useState(false);
  const [loadingFilteredData, setLoadingFilteredData] = useState(false);

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedGlobalStart = localStorage.getItem('agents-global-start-date');
      const savedGlobalEnd = localStorage.getItem('agents-global-end-date');
      const savedAppliedStart = localStorage.getItem('agents-applied-start-date');
      const savedAppliedEnd = localStorage.getItem('agents-applied-end-date');
      const savedAllTime = localStorage.getItem('agents-all-time') === 'true';

      if (savedGlobalStart) setGlobalStartDate(savedGlobalStart);
      if (savedGlobalEnd) setGlobalEndDate(savedGlobalEnd);
      if (savedAppliedStart) setAppliedStartDate(savedAppliedStart);
      if (savedAppliedEnd) setAppliedEndDate(savedAppliedEnd);
      if (savedAllTime !== null) setAllTime(savedAllTime);
    }
  }, []);

  // Persist date filters to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('agents-global-start-date', globalStartDate);
      localStorage.setItem('agents-global-end-date', globalEndDate);
      localStorage.setItem('agents-applied-start-date', appliedStartDate);
      localStorage.setItem('agents-applied-end-date', appliedEndDate);
      localStorage.setItem('agents-all-time', String(allTime));
    }
  }, [globalStartDate, globalEndDate, appliedStartDate, appliedEndDate, allTime]);

  // Load rankings data
  useEffect(() => {
    async function loadRankings() {
      setLoading(true);
      try {
        // Load agent rankings from database API with date filter
        const params = new URLSearchParams({ type: 'agents' });
        if (appliedStartDate && appliedEndDate) {
          params.append('startDate', appliedStartDate);
          params.append('endDate', appliedEndDate);
        }
        const response = await fetch(`/api/transcript-analytics?${params.toString()}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setRankings(result.data);
            console.log('✨ Agent rankings loaded from database:', {
              totalAgents: result.data.totalAgents,
              totalCalls: result.data.totalCalls,
              dateRange: appliedStartDate && appliedEndDate ? `${appliedStartDate} to ${appliedEndDate}` : 'all time',
            });
          }
        }

        // Load deep analysis (summary with agent sentiment stats)
        try {
          const deepParams = new URLSearchParams({ type: 'summary' });
          if (appliedStartDate && appliedEndDate) {
            deepParams.append('startDate', appliedStartDate);
            deepParams.append('endDate', appliedEndDate);
          }
          const deepRes = await fetch(`/api/transcript-analytics?${deepParams.toString()}`);
          if (deepRes.ok) {
            const result = await deepRes.json();
            if (result.success) {
              setDeepAnalysis({
                metadata: {
                  analyzedTickets: result.metadata.analyzedTranscripts,
                },
                summary: {
                  agentSentiment: result.summary.agentSentiment,
                  avgAgentScore: result.summary.avgAgentScore,
                },
                tickets: [],
              });
              console.log('✨ Deep analysis loaded from database:', result.metadata);
            }
          }
        } catch (deepErr) {
          console.log('Deep analysis not yet available:', deepErr);
        }
      } catch (error) {
        console.error('Failed to load rankings:', error);
      } finally {
        setLoading(false);
      }
    }

    loadRankings();
  }, [appliedStartDate, appliedEndDate]);

  // Load AI profile for selected agent
  const loadAgentProfile = useCallback(async (agent: AgentStats) => {
    setLoadingProfile(true);
    setAgentProfile(null);
    setProfileError(null);

    try {
      const response = await fetch('/api/agent-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentStats: agent }),
      });

      if (response.ok) {
        const { profile } = await response.json();
        setAgentProfile(profile);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        setProfileError(errorData.error || 'Failed to load AI coaching insights');
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      setProfileError('Unable to connect to AI coaching service');
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  // Handle agent selection
  const handleSelectAgent = (agent: AgentStats) => {
    setSelectedAgent(agent);
    loadAgentProfile(agent);
  };

  // Handle viewing agent's transcripts
  const handleViewTranscripts = (agentName: string) => {
    setTranscriptFilterType('agent');
    setTranscriptFilterValue(agentName);
    setTranscriptModalOpen(true);
  };

  // Apply global date range filter
  const applyGlobalFilter = () => {
    if (allTime) {
      setAppliedStartDate(getAllTimeStartDate());
      setAppliedEndDate(getDefaultEndDate());
    } else {
      if (!globalStartDate || !globalEndDate) {
        alert('Please select both start and end dates');
        return;
      }
      setAppliedStartDate(globalStartDate);
      setAppliedEndDate(globalEndDate);
    }
  };

  // Clear global date range filter
  const clearGlobalFilter = () => {
    const defaultStart = getDefaultStartDate();
    const defaultEnd = getDefaultEndDate();
    setGlobalStartDate(defaultStart);
    setGlobalEndDate(defaultEnd);
    setAppliedStartDate(defaultStart);
    setAppliedEndDate(defaultEnd);
    setAllTime(false);
  };

  // Handle All Time checkbox toggle
  const handleAllTimeToggle = (checked: boolean) => {
    setAllTime(checked);
    if (checked) {
      setGlobalStartDate(getAllTimeStartDate());
      setGlobalEndDate(getDefaultEndDate());
    } else {
      setGlobalStartDate(getDefaultStartDate());
      setGlobalEndDate(getDefaultEndDate());
    }
  };

  // Get all agents sorted by selected criteria, with search filter
  // Only show agents with 20+ calls for statistical significance
  const getDisplayedAgents = (): AgentStats[] => {
    if (!rankings) return [];

    // Filter to only agents with 20+ calls
    let agents = [...rankings.allAgents].filter((a) => a.callCount >= 20);

    // Apply tier filter
    if (tierFilter !== 'all') {
      agents = agents.filter((a) => a.performanceTier === tierFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      agents = agents.filter(
        (a) =>
          a.name.toLowerCase().includes(search) ||
          a.department?.toLowerCase().includes(search)
      );
    }

    // Sort based on selected criteria
    if (sortBy === 'performance') {
      // Use agent performance score (agentSentimentScore) for ranking
      agents.sort((a, b) => {
        const scoreA = a.agentSentimentScore ?? a.sentimentScore;
        const scoreB = b.agentSentimentScore ?? b.sentimentScore;
        return scoreB - scoreA; // Top performers first
      });
    } else if (sortBy === 'lowPerformance') {
      // Use agent performance score for ranking lowest performers
      agents.sort((a, b) => {
        const scoreA = a.agentSentimentScore ?? a.sentimentScore;
        const scoreB = b.agentSentimentScore ?? b.sentimentScore;
        return scoreA - scoreB; // Lowest performers first
      });
    } else if (sortBy === 'calls') {
      agents.sort((a, b) => b.callCount - a.callCount); // Most calls first
    } else if (sortBy === 'duration') {
      agents.sort((a, b) => b.avgDuration - a.avgDuration); // Longest avg duration first
    }

    return agents;
  };

  const displayedAgents = getDisplayedAgents();

  // Calculate distribution for ranked agents only (20+ calls)
  const rankedDistribution = displayedAgents.reduce(
    (acc, agent) => {
      acc[agent.performanceTier]++;
      return acc;
    },
    { top: 0, good: 0, average: 0, needsImprovement: 0, critical: 0 } as Record<string, number>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500/20 border-t-blue-500 mx-auto" />
          <p className="mt-4 text-gray-400">Loading agent data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Users className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Agent Performance Rankings</h2>
            <p className="text-sm text-gray-400">
              {displayedAgents.length} ranked agents (20+ calls) • {rankings?.totalCalls.toLocaleString()} total calls
            </p>
          </div>
        </div>
        <button
          onClick={() => setGradingModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-400 hover:text-blue-300 transition-all text-sm"
        >
          <Info className="h-4 w-4" />
          How Are Agents Graded?
        </button>
      </div>

      {/* Global Date Range Filter */}
      <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 rounded-2xl p-6 border border-blue-500/20 sticky top-4 z-10 backdrop-blur-sm">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">Global Date Range Filter</h2>
            <p className="text-sm text-gray-400">Filter all agent data by date range (Default: Last 30 days)</p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {/* All Time Checkbox */}
          <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
            <input
              type="checkbox"
              id="allTimeCheckbox"
              checked={allTime}
              onChange={(e) => handleAllTimeToggle(e.target.checked)}
              className="w-4 h-4 accent-red-500 cursor-pointer"
            />
            <label htmlFor="allTimeCheckbox" className="text-sm text-red-400 font-medium cursor-pointer">
              All Time (5 years)
            </label>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-300 font-medium">From:</label>
            <input
              type="date"
              value={globalStartDate}
              onChange={(e) => setGlobalStartDate(e.target.value)}
              disabled={allTime}
              className="bg-[#0a0e17] border border-white/[0.08] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-300 font-medium">To:</label>
            <input
              type="date"
              value={globalEndDate}
              onChange={(e) => setGlobalEndDate(e.target.value)}
              disabled={allTime}
              className="bg-[#0a0e17] border border-white/[0.08] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
              Reset to Default (30 days)
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

      {/* Deep Analysis Agent Sentiment Stats */}
      {deepAnalysis && (
        <div className="bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-blue-500/10 rounded-xl border border-blue-500/30 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                ✨ Agent Performance Analysis
                <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">
                  Deep Analysis
                </span>
              </h3>
              <p className="text-sm text-gray-400">
                {deepAnalysis.metadata.analyzedTickets.toLocaleString()} tickets analyzed • Avg agent score: {(deepAnalysis.summary.avgAgentScore * 100).toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => {
                setTranscriptFilterType('agentSentiment');
                setTranscriptFilterValue('positive');
                setTranscriptModalOpen(true);
              }}
              className="p-4 bg-green-500/10 rounded-lg border border-green-500/30 hover:bg-green-500/20 transition-all cursor-pointer text-left group"
            >
              <div className="text-2xl font-bold text-green-400 group-hover:text-green-300">
                {deepAnalysis.summary.agentSentiment.positive.toLocaleString()}
              </div>
              <div className="text-sm text-green-300 group-hover:text-green-200">Positive Agent Performance</div>
              <div className="text-xs text-gray-500 mt-1">
                {((deepAnalysis.summary.agentSentiment.positive / deepAnalysis.metadata.analyzedTickets) * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-green-400/60 mt-2 group-hover:text-green-300">Click to view calls →</div>
            </button>
            <button
              onClick={() => {
                setTranscriptFilterType('agentSentiment');
                setTranscriptFilterValue('neutral');
                setTranscriptModalOpen(true);
              }}
              className="p-4 bg-gray-500/10 rounded-lg border border-gray-500/30 hover:bg-gray-500/20 transition-all cursor-pointer text-left group"
            >
              <div className="text-2xl font-bold text-gray-400 group-hover:text-gray-300">
                {deepAnalysis.summary.agentSentiment.neutral.toLocaleString()}
              </div>
              <div className="text-sm text-gray-300 group-hover:text-gray-200">Neutral Agent Performance</div>
              <div className="text-xs text-gray-500 mt-1">
                {((deepAnalysis.summary.agentSentiment.neutral / deepAnalysis.metadata.analyzedTickets) * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-gray-400/60 mt-2 group-hover:text-gray-300">Click to view calls →</div>
            </button>
            <button
              onClick={() => {
                setTranscriptFilterType('agentSentiment');
                setTranscriptFilterValue('negative');
                setTranscriptModalOpen(true);
              }}
              className="p-4 bg-red-500/10 rounded-lg border border-red-500/30 hover:bg-red-500/20 transition-all cursor-pointer text-left group"
            >
              <div className="text-2xl font-bold text-red-400 group-hover:text-red-300">
                {deepAnalysis.summary.agentSentiment.negative.toLocaleString()}
              </div>
              <div className="text-sm text-red-300 group-hover:text-red-200">Negative Agent Performance</div>
              <div className="text-xs text-gray-500 mt-1">
                {((deepAnalysis.summary.agentSentiment.negative / deepAnalysis.metadata.analyzedTickets) * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-red-400/60 mt-2 group-hover:text-red-300">Click to view calls →</div>
            </button>
          </div>
        </div>
      )}

      {/* Performance Distribution - Only ranked agents (20+ calls) */}
      {rankings && !selectedAgent && (
        <div className="p-4 bg-[#131a29] rounded-xl border border-white/[0.08]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-400">Performance Distribution (Ranked Agents Only)</h3>
            {tierFilter !== 'all' && (
              <button
                onClick={() => setTierFilter('all')}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Clear Filter
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 h-8">
            {/* Top Performers */}
            <button
              onClick={() => setTierFilter(tierFilter === 'top' ? 'all' : 'top')}
              className={`flex-1 flex flex-col transition-all ${tierFilter === 'top' ? 'scale-105' : 'hover:scale-102'}`}
            >
              <div className={`h-8 bg-emerald-500 rounded-lg flex items-center justify-center relative cursor-pointer ${
                tierFilter === 'top' ? 'ring-2 ring-emerald-300' : 'hover:bg-emerald-400'
              }`}>
                <span className="text-xs font-medium text-white">{rankedDistribution.top}</span>
              </div>
              <span className="text-[10px] text-emerald-400 mt-1 text-center">Top</span>
            </button>

            {/* Good */}
            <button
              onClick={() => setTierFilter(tierFilter === 'good' ? 'all' : 'good')}
              className={`flex-1 flex flex-col transition-all ${tierFilter === 'good' ? 'scale-105' : 'hover:scale-102'}`}
            >
              <div className={`h-8 bg-blue-500 rounded-lg flex items-center justify-center relative cursor-pointer ${
                tierFilter === 'good' ? 'ring-2 ring-blue-300' : 'hover:bg-blue-400'
              }`}>
                <span className="text-xs font-medium text-white">{rankedDistribution.good}</span>
              </div>
              <span className="text-[10px] text-blue-400 mt-1 text-center">Good</span>
            </button>

            {/* Average */}
            <button
              onClick={() => setTierFilter(tierFilter === 'average' ? 'all' : 'average')}
              className={`flex-1 flex flex-col transition-all ${tierFilter === 'average' ? 'scale-105' : 'hover:scale-102'}`}
            >
              <div className={`h-8 bg-gray-500 rounded-lg flex items-center justify-center relative cursor-pointer ${
                tierFilter === 'average' ? 'ring-2 ring-gray-300' : 'hover:bg-gray-400'
              }`}>
                <span className="text-xs font-medium text-white">{rankedDistribution.average}</span>
              </div>
              <span className="text-[10px] text-gray-400 mt-1 text-center">Average</span>
            </button>

            {/* Needs Improvement */}
            <button
              onClick={() => setTierFilter(tierFilter === 'needs-improvement' ? 'all' : 'needs-improvement')}
              className={`flex-1 flex flex-col transition-all ${tierFilter === 'needs-improvement' ? 'scale-105' : 'hover:scale-102'}`}
            >
              <div className={`h-8 bg-amber-500 rounded-lg flex items-center justify-center relative cursor-pointer ${
                tierFilter === 'needs-improvement' ? 'ring-2 ring-amber-300' : 'hover:bg-amber-400'
              }`}>
                <span className="text-xs font-medium text-white">{rankedDistribution.needsImprovement}</span>
              </div>
              <span className="text-[10px] text-amber-400 mt-1 text-center">Needs Imp.</span>
            </button>

            {/* Critical */}
            <button
              onClick={() => setTierFilter(tierFilter === 'critical' ? 'all' : 'critical')}
              className={`flex-1 flex flex-col transition-all ${tierFilter === 'critical' ? 'scale-105' : 'hover:scale-102'}`}
            >
              <div className={`h-8 bg-red-500 rounded-lg flex items-center justify-center relative cursor-pointer ${
                tierFilter === 'critical' ? 'ring-2 ring-red-300' : 'hover:bg-red-400'
              }`}>
                <span className="text-xs font-medium text-white">{rankedDistribution.critical}</span>
              </div>
              <span className="text-[10px] text-red-400 mt-1 text-center">Critical</span>
            </button>
          </div>
          {tierFilter !== 'all' && (
            <div className="mt-2 text-xs text-gray-400 text-center">
              Showing <span className="text-white font-medium">{displayedAgents.length}</span> {tierFilter} {displayedAgents.length === 1 ? 'agent' : 'agents'}
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="space-y-4">
        {/* Search and Sort */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search agents by name or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-[#1a1f2e] border border-white/[0.08] rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'performance' | 'calls' | 'lowPerformance' | 'duration')}
            className="px-4 py-2.5 bg-[#1a1f2e] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-blue-500/50"
          >
            <option value="performance">🏆 Top Performers</option>
            <option value="lowPerformance">⚠️ Lowest Performers</option>
            <option value="calls">📞 Most Calls</option>
            <option value="duration">⏱️ Longest Avg Duration</option>
          </select>
        </div>

        {/* Agent List (Row-Based) */}
        {displayedAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <Users className="h-8 w-8 mb-2" />
            <p>No agents found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayedAgents.map((agent) => {
              const isExpanded = selectedAgent?.name === agent.name;
              const agentScore = agent.agentSentimentScore ?? agent.sentimentScore;

              return (
                <div
                  key={agent.name}
                  className={`bg-[#131a29] rounded-xl border transition-all ${
                    isExpanded
                      ? 'border-blue-500/50 ring-2 ring-blue-500/20'
                      : 'border-white/[0.08] hover:border-white/[0.12]'
                  }`}
                >
                  {/* Compact Row - Always Visible */}
                  <div
                    onClick={() => handleSelectAgent(agent)}
                    className="grid grid-cols-12 gap-4 p-4 cursor-pointer items-center"
                  >
                    {/* Agent Name & Email */}
                    <div className="col-span-2">
                      <div className="font-medium text-white">{agent.name}</div>
                      {agent.email && (
                        <div className="text-xs text-gray-400 truncate">{agent.email}</div>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="col-span-1 text-center">
                      <div className="flex items-center gap-1 justify-center">
                        <Phone className="h-3 w-3 text-blue-400" />
                        <span className="text-white font-medium">{agent.callCount}</span>
                      </div>
                      <div className="text-xs text-gray-400">Calls</div>
                    </div>

                    <div className="col-span-1 text-center">
                      <div className="text-white font-medium">
                        {Math.round(agent.avgDuration / 60)}m
                      </div>
                      <div className="text-xs text-gray-400">Duration</div>
                    </div>

                    {/* Performance Bar */}
                    <div className="col-span-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>Performance</span>
                          <span className="text-white font-medium">{(agentScore * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex h-2 rounded-full overflow-hidden bg-gray-700/50">
                          {/* Positive */}
                          <div
                            className="bg-green-500"
                            style={{
                              width: `${((agent.agentPositiveRate ?? agent.positiveRate) * 100).toFixed(1)}%`,
                            }}
                            title={`Positive: ${((agent.agentPositiveRate ?? agent.positiveRate) * 100).toFixed(1)}%`}
                          />
                          {/* Neutral */}
                          <div
                            className="bg-gray-500"
                            style={{
                              width: `${((agent.agentNeutralRate ?? agent.neutralRate) * 100).toFixed(1)}%`,
                            }}
                            title={`Neutral: ${((agent.agentNeutralRate ?? agent.neutralRate) * 100).toFixed(1)}%`}
                          />
                          {/* Negative */}
                          <div
                            className="bg-red-500"
                            style={{
                              width: `${((agent.agentNegativeRate ?? agent.negativeRate) * 100).toFixed(1)}%`,
                            }}
                            title={`Negative: ${((agent.agentNegativeRate ?? agent.negativeRate) * 100).toFixed(1)}%`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Performance Tier Badge */}
                    <div className="col-span-2 flex justify-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          agent.performanceTier === 'top'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : agent.performanceTier === 'good'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : agent.performanceTier === 'average'
                            ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                            : agent.performanceTier === 'needs-improvement'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {agent.performanceTier === 'needs-improvement'
                          ? 'Needs Imp.'
                          : agent.performanceTier.charAt(0).toUpperCase() + agent.performanceTier.slice(1)}
                      </span>
                    </div>

                    {/* Expand Indicator */}
                    <div className="col-span-2 flex justify-end items-center gap-2">
                      <span className="text-xs text-gray-400">Details</span>
                      <ChevronUp
                        className={`h-5 w-5 text-gray-400 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {/* Expanded Full Profile */}
                  {isExpanded && (
                    <div className="border-t border-white/[0.08] bg-[#0a0e17]/50">
                      <div className="p-6">
                        <AgentProfileCard
                          agent={selectedAgent}
                          profile={agentProfile}
                          loadingProfile={loadingProfile}
                          profileError={profileError}
                          onViewTranscripts={handleViewTranscripts}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transcript Modal for viewing filtered calls */}
      <TranscriptModal
        isOpen={transcriptModalOpen}
        onClose={() => setTranscriptModalOpen(false)}
        title={
          transcriptFilterType === 'agentSentiment'
            ? `${transcriptFilterValue.charAt(0).toUpperCase() + transcriptFilterValue.slice(1)} Agent Performance Calls`
            : `${transcriptFilterValue}'s Calls`
        }
        filterType={transcriptFilterType}
        filterValue={transcriptFilterValue}
        startDate={appliedStartDate}
        endDate={appliedEndDate}
      />

      {/* Agent Grading Explanation Modal */}
      <AgentGradingModal
        isOpen={gradingModalOpen}
        onClose={() => setGradingModalOpen(false)}
      />
    </div>
  );
}
