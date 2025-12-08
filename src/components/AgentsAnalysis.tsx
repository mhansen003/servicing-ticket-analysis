'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  X,
  Phone,
} from 'lucide-react';
import { AgentProfileCard } from './AgentProfileCard';
import { TranscriptModal } from './TranscriptModal';

interface AgentStats {
  name: string;
  email?: string;
  department?: string;
  callCount: number;
  avgDuration: number;
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

export default function AgentsAnalysis() {
  const [rankings, setRankings] = useState<AgentRankings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentStats | null>(null);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Transcript modal state
  const [transcriptModalOpen, setTranscriptModalOpen] = useState(false);
  const [transcriptFilterAgent, setTranscriptFilterAgent] = useState('');

  // Load rankings data
  useEffect(() => {
    async function loadRankings() {
      setLoading(true);
      try {
        const response = await fetch('/data/agent-rankings.json');
        if (response.ok) {
          const data = await response.json();
          setRankings(data);
        }
      } catch (error) {
        console.error('Failed to load rankings:', error);
      } finally {
        setLoading(false);
      }
    }

    loadRankings();
  }, []);

  // Load AI profile for selected agent
  const loadAgentProfile = useCallback(async (agent: AgentStats) => {
    setLoadingProfile(true);
    setAgentProfile(null);

    try {
      const response = await fetch('/api/agent-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentStats: agent }),
      });

      if (response.ok) {
        const { profile } = await response.json();
        setAgentProfile(profile);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
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
    setTranscriptFilterAgent(agentName);
    setTranscriptModalOpen(true);
  };

  // Get all agents sorted by sentiment score (top performers first), with search filter
  // Only show agents with 20+ calls for statistical significance
  const getDisplayedAgents = (): AgentStats[] => {
    if (!rankings) return [];

    // Filter to only agents with 20+ calls, then sort by sentiment score descending (best first)
    let agents = [...rankings.allAgents]
      .filter((a) => a.callCount >= 20) // Minimum 20 calls required for ranking
      .sort((a, b) => b.sentimentScore - a.sentimentScore);

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      agents = agents.filter(
        (a) =>
          a.name.toLowerCase().includes(search) ||
          a.department?.toLowerCase().includes(search)
      );
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
      </div>

      {/* Performance Distribution - Only ranked agents (20+ calls) */}
      {rankings && !selectedAgent && displayedAgents.length > 0 && (
        <div className="p-4 bg-[#131a29] rounded-xl border border-white/[0.08]">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Performance Distribution (Ranked Agents Only)</h3>
          <div className="flex items-center gap-1 h-8 rounded-lg overflow-hidden bg-[#0f1420]">
            <div
              className="h-full bg-emerald-500 flex items-center justify-center"
              style={{ width: `${(rankedDistribution.top / displayedAgents.length) * 100}%` }}
            >
              <span className="text-xs font-medium text-white">{rankedDistribution.top}</span>
            </div>
            <div
              className="h-full bg-blue-500 flex items-center justify-center"
              style={{ width: `${(rankedDistribution.good / displayedAgents.length) * 100}%` }}
            >
              <span className="text-xs font-medium text-white">{rankedDistribution.good}</span>
            </div>
            <div
              className="h-full bg-gray-500 flex items-center justify-center"
              style={{ width: `${(rankedDistribution.average / displayedAgents.length) * 100}%` }}
            >
              <span className="text-xs font-medium text-white">{rankedDistribution.average}</span>
            </div>
            <div
              className="h-full bg-amber-500 flex items-center justify-center"
              style={{ width: `${(rankedDistribution.needsImprovement / displayedAgents.length) * 100}%` }}
            >
              <span className="text-xs font-medium text-white">{rankedDistribution.needsImprovement}</span>
            </div>
            <div
              className="h-full bg-red-500 flex items-center justify-center"
              style={{ width: `${(rankedDistribution.critical / displayedAgents.length) * 100}%` }}
            >
              <span className="text-xs font-medium text-white">{rankedDistribution.critical}</span>
            </div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span className="text-emerald-400">Top Performer</span>
            <span className="text-blue-400">Good</span>
            <span className="text-gray-400">Average</span>
            <span className="text-amber-400">Needs Improvement</span>
            <span className="text-red-400">Critical</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Agent Grid */}
        <div className={`${selectedAgent ? 'w-1/2' : 'w-full'} space-y-4`}>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search agents by name or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-[#1a1f2e] border border-white/[0.08] rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {/* Agent Tiles */}
          {displayedAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
              <Users className="h-8 w-8 mb-2" />
              <p>No agents found</p>
            </div>
          ) : (
            <div className={`grid gap-4 ${selectedAgent ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
              {displayedAgents.map((agent) => (
                <div
                  key={agent.name}
                  onClick={() => handleSelectAgent(agent)}
                  className={`cursor-pointer transition-all ${
                    selectedAgent?.name === agent.name ? 'ring-2 ring-blue-500/50 rounded-xl' : ''
                  }`}
                >
                  <AgentProfileCard
                    agent={agent}
                    compact
                    onViewTranscripts={() => handleSelectAgent(agent)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agent Detail Panel */}
        {selectedAgent && (
          <div className="w-1/2 bg-[#131a29] rounded-xl border border-white/[0.08] overflow-hidden">
            <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
              <h3 className="font-medium text-white">Agent Profile</h3>
              <button
                onClick={() => setSelectedAgent(null)}
                className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>
            <div className="p-4 max-h-[calc(100vh-300px)] overflow-y-auto">
              <AgentProfileCard
                agent={selectedAgent}
                profile={agentProfile}
                loadingProfile={loadingProfile}
                onViewTranscripts={handleViewTranscripts}
              />
            </div>
          </div>
        )}
      </div>

      {/* Transcript Modal for viewing agent's calls */}
      <TranscriptModal
        isOpen={transcriptModalOpen}
        onClose={() => setTranscriptModalOpen(false)}
        title={`${transcriptFilterAgent}'s Calls`}
        filterType="agent"
        filterValue={transcriptFilterAgent}
      />
    </div>
  );
}
