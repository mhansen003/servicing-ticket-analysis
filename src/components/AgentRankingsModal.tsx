'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Users,
  Search,
} from 'lucide-react';
import { AgentProfileCard } from './AgentProfileCard';

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

interface AgentRankingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewTranscripts: (agentName: string) => void;
}

export function AgentRankingsModal({
  isOpen,
  onClose,
  onViewTranscripts,
}: AgentRankingsModalProps) {
  const [rankings, setRankings] = useState<AgentRankings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentStats | null>(null);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Load rankings data
  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen]);

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

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedAgent(null);
      setAgentProfile(null);
      setSearchTerm('');
    }
  }, [isOpen]);

  // Get all agents sorted by sentiment score (top performers first), with search filter
  const getDisplayedAgents = (): AgentStats[] => {
    if (!rankings) return [];

    // Sort all agents by sentiment score descending (best first)
    let agents = [...rankings.allAgents].sort((a, b) => b.sentimentScore - a.sentimentScore);

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

  if (!isOpen) return null;

  const displayedAgents = getDisplayedAgents();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-[95vw] max-h-[95vh] mx-4 bg-[#0f1420] rounded-2xl border border-white/[0.08] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Users className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Agent Performance Rankings</h2>
              <p className="text-sm text-gray-400">
                {loading
                  ? 'Loading...'
                  : `${rankings?.totalAgents} agents • ${rankings?.totalCalls.toLocaleString()} total calls`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Rankings List */}
          <div className={`${selectedAgent ? 'w-1/3' : 'w-full'} flex flex-col border-r border-white/[0.08]`}>
            {/* Performance Distribution */}
            {rankings && !selectedAgent && (
              <div className="p-4 border-b border-white/[0.08] bg-[#131a29]">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Performance Distribution</h3>
                <div className="flex items-center gap-1 h-6 rounded-lg overflow-hidden bg-[#0f1420]">
                  <div
                    className="h-full bg-emerald-500 flex items-center justify-center"
                    style={{ width: `${(rankings.distribution.top / rankings.totalAgents) * 100}%` }}
                  >
                    <span className="text-[10px] font-medium text-white">{rankings.distribution.top}</span>
                  </div>
                  <div
                    className="h-full bg-blue-500 flex items-center justify-center"
                    style={{ width: `${(rankings.distribution.good / rankings.totalAgents) * 100}%` }}
                  >
                    <span className="text-[10px] font-medium text-white">{rankings.distribution.good}</span>
                  </div>
                  <div
                    className="h-full bg-gray-500 flex items-center justify-center"
                    style={{ width: `${(rankings.distribution.average / rankings.totalAgents) * 100}%` }}
                  >
                    <span className="text-[10px] font-medium text-white">{rankings.distribution.average}</span>
                  </div>
                  <div
                    className="h-full bg-amber-500 flex items-center justify-center"
                    style={{ width: `${(rankings.distribution.needsImprovement / rankings.totalAgents) * 100}%` }}
                  >
                    <span className="text-[10px] font-medium text-white">{rankings.distribution.needsImprovement}</span>
                  </div>
                  <div
                    className="h-full bg-red-500 flex items-center justify-center"
                    style={{ width: `${(rankings.distribution.critical / rankings.totalAgents) * 100}%` }}
                  >
                    <span className="text-[10px] font-medium text-white">{rankings.distribution.critical}</span>
                  </div>
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-gray-500">
                  <span className="text-emerald-400">Top</span>
                  <span className="text-blue-400">Good</span>
                  <span className="text-gray-400">Avg</span>
                  <span className="text-amber-400">Needs Imp.</span>
                  <span className="text-red-400">Critical</span>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="p-3 border-b border-white/[0.08]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search agents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#1a1f2e] border border-white/[0.08] rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>

            {/* Agent Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500/20 border-t-blue-500" />
                </div>
              ) : displayedAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                  <Users className="h-8 w-8 mb-2" />
                  <p>No agents found</p>
                </div>
              ) : (
                <div className={`grid gap-4 ${selectedAgent ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
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
          </div>

          {/* Right Panel: Agent Detail */}
          {selectedAgent && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-white/[0.08] bg-[#131a29] flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">Agent Profile</h3>
                <button
                  onClick={() => setSelectedAgent(null)}
                  className="p-1 rounded hover:bg-white/[0.05]"
                >
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <AgentProfileCard
                  agent={selectedAgent}
                  profile={agentProfile}
                  loadingProfile={loadingProfile}
                  onViewTranscripts={(name) => {
                    onClose();
                    onViewTranscripts(name);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
