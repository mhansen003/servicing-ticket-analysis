'use client';

import { useState } from 'react';
import {
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  User,
  Users,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Brain,
  Heart,
  Target,
  Shield,
} from 'lucide-react';

interface CallAnalysis {
  overallScores: {
    customerSatisfaction: number;
    resolutionConfidence: number;
    agentProfessionalism: number;
    empathyConnection: number;
    communicationClarity: number;
    overallCallImpact: number;
  };
  executiveSummary: {
    overview: string;
    reasonForContact: string;
    mainActions: string;
    resolutionOutcome: string;
    emotionalTrajectory: string;
  };
  keyInteractionPoints: string[];
  followUpItems: Array<{
    party: 'Agent' | 'Customer' | 'Back Office';
    action: string;
    context: string;
    deadline: string;
  }>;
  sentimentProgression: {
    customer: {
      start: { tone: string; score: number };
      mid: { tone: string; score: number };
      end: { tone: string; score: number };
    };
    agent: {
      start: { tone: string; score: number };
      mid: { tone: string; score: number };
      end: { tone: string; score: number };
    };
  };
  communicationQuality: {
    customer: {
      clarity: number;
      empathy: number;
      activeListening: number;
      respectfulness: number;
      emotionalRegulation: number;
      responsiveness: number;
    };
    agent: {
      clarity: number;
      empathy: number;
      activeListening: number;
      respectfulness: number;
      emotionalRegulation: number;
      responsiveness: number;
    };
  };
  agentSummary: {
    toneProfessionalism: string;
    problemSolving: string;
    empathyConnection: string;
    deEscalation: string;
    closure: string;
  };
  customerSummary: {
    initialDisposition: string;
    engagementCooperation: string;
    toneEvolution: string;
    satisfactionLevel: string;
  };
  insights: {
    relationalFlow: string;
    conflictRecovery: string;
    psychologicalCommentary: string;
  };
}

interface CallScorecardProps {
  analysis: CallAnalysis | null;
  loading: boolean;
  error?: string;
}

// Score to color mapping
function getScoreColor(score: number): string {
  if (score >= 4.5) return 'text-emerald-400';
  if (score >= 3.5) return 'text-green-400';
  if (score >= 2.5) return 'text-yellow-400';
  if (score >= 1.5) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreBgColor(score: number): string {
  if (score >= 4.5) return 'bg-emerald-500/20 border-emerald-500/30';
  if (score >= 3.5) return 'bg-green-500/20 border-green-500/30';
  if (score >= 2.5) return 'bg-yellow-500/20 border-yellow-500/30';
  if (score >= 1.5) return 'bg-orange-500/20 border-orange-500/30';
  return 'bg-red-500/20 border-red-500/30';
}

function getScoreLabel(score: number): string {
  if (score >= 4.5) return 'Excellent';
  if (score >= 3.5) return 'Good';
  if (score >= 2.5) return 'Average';
  if (score >= 1.5) return 'Poor';
  return 'Very Poor';
}

// Star rating component
function StarRating({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) {
  const stars = [];
  const fullStars = Math.floor(score);
  const hasHalf = score % 1 >= 0.5;
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push(
        <Star key={i} className={`${iconSize} text-yellow-400 fill-yellow-400`} />
      );
    } else if (i === fullStars && hasHalf) {
      stars.push(
        <Star key={i} className={`${iconSize} text-yellow-400 fill-yellow-400/50`} />
      );
    } else {
      stars.push(
        <Star key={i} className={`${iconSize} text-gray-600`} />
      );
    }
  }
  return <div className="flex gap-0.5">{stars}</div>;
}

// Trend indicator for sentiment progression
function TrendIndicator({ start, end }: { start: number; end: number }) {
  const diff = end - start;
  if (diff > 0.5) {
    return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  } else if (diff < -0.5) {
    return <TrendingDown className="h-4 w-4 text-red-400" />;
  }
  return <Minus className="h-4 w-4 text-gray-400" />;
}

// Section header component
function SectionHeader({
  icon: Icon,
  title,
  expanded,
  onToggle,
}: {
  icon: React.ElementType;
  title: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-3 bg-[#1a1f2e] rounded-lg hover:bg-[#1e2538] transition-colors"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-medium text-white">{title}</span>
      </div>
      {expanded ? (
        <ChevronUp className="h-4 w-4 text-gray-400" />
      ) : (
        <ChevronDown className="h-4 w-4 text-gray-400" />
      )}
    </button>
  );
}

export function CallScorecard({ analysis, loading, error }: CallScorecardProps) {
  // All sections expanded by default for full visibility
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    summary: true,
    scores: true,
    sentiment: true,
    communication: true,
    behavioral: true,
    insights: true,
    followUp: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500/20 border-t-blue-500 mb-4" />
        <p className="text-sm text-blue-300 font-medium">Analyzing call...</p>
        <p className="text-xs text-gray-500 mt-1">This may take 10-15 seconds</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <AlertCircle className="h-8 w-8 text-red-400 mb-2" />
        <p className="text-sm text-red-300">{error}</p>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  // Calculate overall average score
  const scores = analysis.overallScores;
  const avgScore =
    (scores.customerSatisfaction +
      scores.resolutionConfidence +
      scores.agentProfessionalism +
      scores.empathyConnection +
      scores.communicationClarity +
      scores.overallCallImpact) /
    6;

  return (
    <div className="space-y-3 overflow-y-auto max-h-full">
      {/* Overall Score Card */}
      <div className={`p-4 rounded-xl border ${getScoreBgColor(avgScore)}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Overall Call Score</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-3xl font-bold ${getScoreColor(avgScore)}`}>
                {avgScore.toFixed(1)}
              </span>
              <span className="text-gray-500">/5</span>
            </div>
          </div>
          <div className="text-right">
            <StarRating score={avgScore} />
            <p className={`text-sm font-medium mt-1 ${getScoreColor(avgScore)}`}>
              {getScoreLabel(avgScore)}
            </p>
          </div>
        </div>

        {/* Score breakdown */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10">
          <div className="text-center">
            <p className="text-xs text-gray-500">CSAT</p>
            <p className={`text-lg font-semibold ${getScoreColor(scores.customerSatisfaction)}`}>
              {scores.customerSatisfaction}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Resolution</p>
            <p className={`text-lg font-semibold ${getScoreColor(scores.resolutionConfidence)}`}>
              {scores.resolutionConfidence}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Agent</p>
            <p className={`text-lg font-semibold ${getScoreColor(scores.agentProfessionalism)}`}>
              {scores.agentProfessionalism}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Empathy</p>
            <p className={`text-lg font-semibold ${getScoreColor(scores.empathyConnection)}`}>
              {scores.empathyConnection}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Clarity</p>
            <p className={`text-lg font-semibold ${getScoreColor(scores.communicationClarity)}`}>
              {scores.communicationClarity}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Impact</p>
            <p className={`text-lg font-semibold ${getScoreColor(scores.overallCallImpact)}`}>
              {scores.overallCallImpact}
            </p>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      <div>
        <SectionHeader
          icon={Target}
          title="Executive Summary"
          expanded={expandedSections.summary}
          onToggle={() => toggleSection('summary')}
        />
        {expandedSections.summary && (
          <div className="mt-2 p-3 bg-[#131825] rounded-lg border border-white/5 space-y-3">
            <p className="text-sm text-gray-300 leading-relaxed">
              {analysis.executiveSummary.overview}
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-gray-500 uppercase tracking-wide mb-1">Reason for Contact</p>
                <p className="text-gray-300">{analysis.executiveSummary.reasonForContact}</p>
              </div>
              <div>
                <p className="text-gray-500 uppercase tracking-wide mb-1">Resolution</p>
                <p className="text-gray-300">{analysis.executiveSummary.resolutionOutcome}</p>
              </div>
            </div>
            <div>
              <p className="text-gray-500 uppercase tracking-wide text-xs mb-1">Emotional Trajectory</p>
              <p className="text-gray-300 text-sm">{analysis.executiveSummary.emotionalTrajectory}</p>
            </div>
          </div>
        )}
      </div>

      {/* Key Interaction Points */}
      {analysis.keyInteractionPoints?.length > 0 && (
        <div>
          <SectionHeader
            icon={MessageSquare}
            title="Key Interaction Points"
            expanded={expandedSections.scores}
            onToggle={() => toggleSection('scores')}
          />
          {expandedSections.scores && (
            <div className="mt-2 p-3 bg-[#131825] rounded-lg border border-white/5">
              <ul className="space-y-2">
                {analysis.keyInteractionPoints.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span className="text-gray-300">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Sentiment Progression */}
      <div>
        <SectionHeader
          icon={Heart}
          title="Sentiment Progression"
          expanded={expandedSections.sentiment}
          onToggle={() => toggleSection('sentiment')}
        />
        {expandedSections.sentiment && (
          <div className="mt-2 p-3 bg-[#131825] rounded-lg border border-white/5">
            {/* Customer Sentiment */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-white">Customer</span>
                </div>
                <TrendIndicator
                  start={analysis.sentimentProgression.customer.start.score}
                  end={analysis.sentimentProgression.customer.end.score}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['start', 'mid', 'end'] as const).map((phase) => {
                  const data = analysis.sentimentProgression.customer[phase];
                  return (
                    <div
                      key={phase}
                      className={`p-2 rounded-lg text-center ${getScoreBgColor(data.score)}`}
                    >
                      <p className="text-[10px] text-gray-500 uppercase">{phase}</p>
                      <p className={`text-xs font-medium ${getScoreColor(data.score)}`}>
                        {data.tone}
                      </p>
                      <StarRating score={data.score} size="sm" />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Agent Sentiment */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-medium text-white">Agent</span>
                </div>
                <TrendIndicator
                  start={analysis.sentimentProgression.agent.start.score}
                  end={analysis.sentimentProgression.agent.end.score}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['start', 'mid', 'end'] as const).map((phase) => {
                  const data = analysis.sentimentProgression.agent[phase];
                  return (
                    <div
                      key={phase}
                      className={`p-2 rounded-lg text-center ${getScoreBgColor(data.score)}`}
                    >
                      <p className="text-[10px] text-gray-500 uppercase">{phase}</p>
                      <p className={`text-xs font-medium ${getScoreColor(data.score)}`}>
                        {data.tone}
                      </p>
                      <StarRating score={data.score} size="sm" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Communication Quality */}
      <div>
        <SectionHeader
          icon={MessageSquare}
          title="Communication Quality"
          expanded={expandedSections.communication}
          onToggle={() => toggleSection('communication')}
        />
        {expandedSections.communication && (
          <div className="mt-2 p-3 bg-[#131825] rounded-lg border border-white/5">
            <div className="grid grid-cols-2 gap-4">
              {/* Customer */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-xs font-medium text-gray-300">Customer</span>
                </div>
                <div className="space-y-1">
                  {Object.entries(analysis.communicationQuality.customer).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className={`text-xs font-medium ${getScoreColor(value)}`}>
                          {value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Agent */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-blue-400" />
                  <span className="text-xs font-medium text-gray-300">Agent</span>
                </div>
                <div className="space-y-1">
                  {Object.entries(analysis.communicationQuality.agent).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className={`text-xs font-medium ${getScoreColor(value)}`}>
                          {value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Behavioral Assessment */}
      <div>
        <SectionHeader
          icon={Brain}
          title="Behavioral Assessment"
          expanded={expandedSections.behavioral}
          onToggle={() => toggleSection('behavioral')}
        />
        {expandedSections.behavioral && (
          <div className="mt-2 p-3 bg-[#131825] rounded-lg border border-white/5 space-y-4">
            {/* Agent Summary */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium text-white">Agent Performance</span>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-gray-500">Tone & Professionalism:</span>
                  <p className="text-gray-300 mt-0.5">{analysis.agentSummary.toneProfessionalism}</p>
                </div>
                <div>
                  <span className="text-gray-500">Problem Solving:</span>
                  <p className="text-gray-300 mt-0.5">{analysis.agentSummary.problemSolving}</p>
                </div>
                <div>
                  <span className="text-gray-500">Empathy & Connection:</span>
                  <p className="text-gray-300 mt-0.5">{analysis.agentSummary.empathyConnection}</p>
                </div>
                <div>
                  <span className="text-gray-500">De-escalation:</span>
                  <p className="text-gray-300 mt-0.5">{analysis.agentSummary.deEscalation}</p>
                </div>
                <div>
                  <span className="text-gray-500">Closure:</span>
                  <p className="text-gray-300 mt-0.5">{analysis.agentSummary.closure}</p>
                </div>
              </div>
            </div>

            {/* Customer Summary */}
            <div className="pt-3 border-t border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-white">Customer Profile</span>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-gray-500">Initial Disposition:</span>
                  <p className="text-gray-300 mt-0.5">{analysis.customerSummary.initialDisposition}</p>
                </div>
                <div>
                  <span className="text-gray-500">Engagement:</span>
                  <p className="text-gray-300 mt-0.5">{analysis.customerSummary.engagementCooperation}</p>
                </div>
                <div>
                  <span className="text-gray-500">Tone Evolution:</span>
                  <p className="text-gray-300 mt-0.5">{analysis.customerSummary.toneEvolution}</p>
                </div>
                <div>
                  <span className="text-gray-500">Satisfaction Level:</span>
                  <p className="text-gray-300 mt-0.5">{analysis.customerSummary.satisfactionLevel}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Insights */}
      <div>
        <SectionHeader
          icon={Shield}
          title="Psychological & Communication Insights"
          expanded={expandedSections.insights}
          onToggle={() => toggleSection('insights')}
        />
        {expandedSections.insights && (
          <div className="mt-2 p-3 bg-[#131825] rounded-lg border border-white/5 space-y-3 text-xs">
            <div>
              <span className="text-gray-500">Relational Flow:</span>
              <p className="text-gray-300 mt-0.5">{analysis.insights.relationalFlow}</p>
            </div>
            <div>
              <span className="text-gray-500">Conflict & Recovery:</span>
              <p className="text-gray-300 mt-0.5">{analysis.insights.conflictRecovery}</p>
            </div>
            <div>
              <span className="text-gray-500">Psychological Commentary:</span>
              <p className="text-gray-300 mt-0.5">{analysis.insights.psychologicalCommentary}</p>
            </div>
          </div>
        )}
      </div>

      {/* Follow-Up Items */}
      {analysis.followUpItems?.length > 0 && (
        <div>
          <SectionHeader
            icon={Clock}
            title="Follow-Up Items"
            expanded={expandedSections.followUp}
            onToggle={() => toggleSection('followUp')}
          />
          {expandedSections.followUp && (
            <div className="mt-2 p-3 bg-[#131825] rounded-lg border border-white/5">
              <div className="space-y-2">
                {analysis.followUpItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-[#1a1f2e] rounded-lg border border-white/5"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded ${
                          item.party === 'Agent'
                            ? 'bg-blue-500/20 text-blue-300'
                            : item.party === 'Customer'
                            ? 'bg-gray-500/20 text-gray-300'
                            : 'bg-purple-500/20 text-purple-300'
                        }`}
                      >
                        {item.party}
                      </span>
                      {item.deadline && (
                        <span className="text-[10px] text-gray-500">{item.deadline}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-300">{item.action}</p>
                    {item.context && (
                      <p className="text-[10px] text-gray-500 mt-1">{item.context}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
