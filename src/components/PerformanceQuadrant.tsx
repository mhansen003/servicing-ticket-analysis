'use client';

import { useState, useEffect } from 'react';
import { Users, TrendingUp, AlertCircle, Award, Target } from 'lucide-react';

interface SentimentData {
  ticketKey: string;
  ticketTitle: string;
  assignedAgent: string;
  agentSentiment: 'positive' | 'neutral' | 'negative';
  agentSentimentScore: number;
  customerSentiment: 'positive' | 'neutral' | 'negative';
  customerSentimentScore: number;
  aiDiscoveredTopic: string;
}

interface QuadrantStats {
  starPerformers: SentimentData[];
  difficultSituations: SentimentData[];
  luckyResolutions: SentimentData[];
  needsTraining: SentimentData[];
}

export default function PerformanceQuadrant() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<QuadrantStats | null>(null);
  const [selectedQuadrant, setSelectedQuadrant] = useState<string | null>(null);

  useEffect(() => {
    loadAnalysisData();
  }, []);

  const loadAnalysisData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/data/deep-analysis.json');
      const analysisData = await response.json();

      // Categorize tickets into quadrants
      const quadrants: QuadrantStats = {
        starPerformers: [],
        difficultSituations: [],
        luckyResolutions: [],
        needsTraining: [],
      };

      analysisData.tickets?.forEach((ticket: SentimentData) => {
        const agentPos = ticket.agentSentiment === 'positive';
        const custPos = ticket.customerSentiment === 'positive';
        const agentNeg = ticket.agentSentiment === 'negative';
        const custNeg = ticket.customerSentiment === 'negative';

        if (agentPos && custPos) {
          quadrants.starPerformers.push(ticket);
        } else if (agentPos && custNeg) {
          quadrants.difficultSituations.push(ticket);
        } else if (agentNeg && custPos) {
          quadrants.luckyResolutions.push(ticket);
        } else if (agentNeg && custNeg) {
          quadrants.needsTraining.push(ticket);
        }
      });

      setData(quadrants);
    } catch (error) {
      console.error('Error loading analysis data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-purple-500/20 border-t-purple-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-[#131a29] rounded-xl p-8 border border-white/[0.08] text-center">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-400">
          Deep analysis data not yet available. Run the analysis script first.
        </p>
        <code className="block mt-4 text-sm text-gray-500">node scripts/deep-analysis.mjs</code>
      </div>
    );
  }

  const quadrants = [
    {
      id: 'star',
      title: 'Star Performers',
      description: 'Positive Agent + Positive Customer',
      count: data.starPerformers.length,
      color: 'from-green-500 to-emerald-600',
      borderColor: 'border-green-500/50',
      bgColor: 'bg-green-500/10',
      icon: Award,
      tickets: data.starPerformers,
    },
    {
      id: 'difficult',
      title: 'Difficult Situations',
      description: 'Positive Agent + Negative Customer',
      count: data.difficultSituations.length,
      color: 'from-blue-500 to-cyan-600',
      borderColor: 'border-blue-500/50',
      bgColor: 'bg-blue-500/10',
      icon: Target,
      tickets: data.difficultSituations,
    },
    {
      id: 'lucky',
      title: 'Lucky Resolutions',
      description: 'Negative Agent + Positive Customer',
      count: data.luckyResolutions.length,
      color: 'from-yellow-500 to-orange-600',
      borderColor: 'border-yellow-500/50',
      bgColor: 'bg-yellow-500/10',
      icon: TrendingUp,
      tickets: data.luckyResolutions,
    },
    {
      id: 'training',
      title: 'Needs Training',
      description: 'Negative Agent + Negative Customer',
      count: data.needsTraining.length,
      color: 'from-red-500 to-rose-600',
      borderColor: 'border-red-500/50',
      bgColor: 'bg-red-500/10',
      icon: AlertCircle,
      tickets: data.needsTraining,
    },
  ];

  const selectedData = selectedQuadrant
    ? quadrants.find(q => q.id === selectedQuadrant)?.tickets || []
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-purple-500/10 rounded-2xl p-6 border border-purple-500/20">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Agent Performance Quadrant</h2>
            <p className="text-gray-400">Agent sentiment vs Customer sentiment analysis</p>
          </div>
        </div>
      </div>

      {/* Quadrant Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quadrants.map((quadrant) => (
          <div
            key={quadrant.id}
            onClick={() => setSelectedQuadrant(quadrant.id)}
            className={`cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
              selectedQuadrant === quadrant.id ? 'ring-2 ring-white/20' : ''
            }`}
          >
            <div className={`bg-[#131a29] rounded-xl p-6 border ${quadrant.borderColor}`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${quadrant.color}`}>
                  <quadrant.icon className="h-6 w-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-white">{quadrant.count.toLocaleString()}</div>
                  <div className="text-sm text-gray-400">tickets</div>
                </div>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{quadrant.title}</h3>
              <p className="text-sm text-gray-400">{quadrant.description}</p>

              {/* Progress bar */}
              <div className="mt-4 h-2 bg-white/[0.05] rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${quadrant.color}`}
                  style={{
                    width: `${(quadrant.count / (data.starPerformers.length + data.difficultSituations.length + data.luckyResolutions.length + data.needsTraining.length)) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Selected Quadrant Details */}
      {selectedQuadrant && (
        <div className="bg-[#131a29] rounded-xl p-6 border border-white/[0.08]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">
              {quadrants.find(q => q.id === selectedQuadrant)?.title} - Recent Tickets
            </h3>
            <button
              onClick={() => setSelectedQuadrant(null)}
              className="px-4 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-white text-sm transition-colors"
            >
              ← Back
            </button>
          </div>

          <div className="space-y-3">
            {selectedData.slice(0, 10).map((ticket, idx) => (
              <div
                key={idx}
                className="p-4 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-medium text-white mb-1">
                      {ticket.ticketKey}: {ticket.ticketTitle?.substring(0, 80)}
                      {ticket.ticketTitle && ticket.ticketTitle.length > 80 ? '...' : ''}
                    </div>
                    <div className="text-sm text-gray-400">
                      Agent: {ticket.assignedAgent || 'Unassigned'}
                    </div>
                    <div className="text-sm text-gray-500">
                      Topic: {ticket.aiDiscoveredTopic}
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <div className={`px-2 py-1 rounded ${
                      ticket.agentSentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
                      ticket.agentSentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      Agent: {(ticket.agentSentimentScore * 100).toFixed(0)}%
                    </div>
                    <div className={`px-2 py-1 rounded ${
                      ticket.customerSentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
                      ticket.customerSentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      Customer: {(ticket.customerSentimentScore * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selectedData.length > 10 && (
            <div className="mt-4 text-center text-sm text-gray-500">
              Showing 10 of {selectedData.length.toLocaleString()} tickets
            </div>
          )}
        </div>
      )}
    </div>
  );
}
