'use client';

import {
  User,
  Phone,
  Clock,
  TrendingUp,
  TrendingDown,
  Award,
  AlertTriangle,
  Target,
  Star,
  ChevronRight,
  Building2,
  Mail,
  ThumbsUp,
  ThumbsDown,
  Minus,
} from 'lucide-react';

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

interface AgentProfileCardProps {
  agent: AgentStats;
  profile?: AgentProfile | null;
  loadingProfile?: boolean;
  profileError?: string | null;
  onViewTranscripts?: (agentName: string) => void;
  compact?: boolean;
}

const tierConfig = {
  top: {
    label: 'Top Performer',
    icon: Star,
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    textColor: 'text-emerald-400',
    iconColor: 'text-emerald-400',
  },
  good: {
    label: 'Good',
    icon: TrendingUp,
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-400',
    iconColor: 'text-blue-400',
  },
  average: {
    label: 'Average',
    icon: Target,
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30',
    textColor: 'text-gray-400',
    iconColor: 'text-gray-400',
  },
  'needs-improvement': {
    label: 'Needs Improvement',
    icon: AlertTriangle,
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    textColor: 'text-amber-400',
    iconColor: 'text-amber-400',
  },
  critical: {
    label: 'Critical',
    icon: TrendingDown,
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-400',
    iconColor: 'text-red-400',
  },
};

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export function AgentProfileCard({
  agent,
  profile,
  loadingProfile,
  profileError,
  onViewTranscripts,
  compact = false,
}: AgentProfileCardProps) {
  const tier = tierConfig[agent.performanceTier];
  const TierIcon = tier.icon;

  // Use new fields if available, fall back to legacy fields
  const agentPos = agent.agentPositiveRate ?? agent.positiveRate;
  const agentNeut = agent.agentNeutralRate ?? agent.neutralRate;
  const agentNeg = agent.agentNegativeRate ?? agent.negativeRate;
  const agentScore = agent.agentSentimentScore ?? agent.sentimentScore;

  const custPos = agent.customerPositiveRate ?? 0;
  const custNeut = agent.customerNeutralRate ?? 0;
  const custNeg = agent.customerNegativeRate ?? 0;
  const custScore = agent.customerSentimentScore ?? 0;

  const hasCustomerData = agent.customerPositiveRate !== undefined;

  if (compact) {
    // Rich tile card for rankings grid
    return (
      <div
        className={`p-4 rounded-xl border ${tier.bgColor} ${tier.borderColor} hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20 transition-all cursor-pointer group`}
        onClick={() => onViewTranscripts?.(agent.name)}
      >
        {/* Header: Name + Tier Badge */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${tier.bgColor}`}>
              <User className={`h-5 w-5 ${tier.iconColor}`} />
            </div>
            <div>
              <p className="font-semibold text-white group-hover:text-blue-300 transition-colors">{agent.name}</p>
              <p className="text-xs text-gray-500">{agent.department || 'Unknown Dept'}</p>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${tier.bgColor} ${tier.borderColor} border`}>
            <TierIcon className={`h-3.5 w-3.5 ${tier.iconColor}`} />
            <span className={`text-xs font-medium ${tier.textColor}`}>{tier.label}</span>
          </div>
        </div>

        {/* Score + Key Metrics Row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 bg-[#0f1420] rounded-lg">
            <p className={`text-lg font-bold ${tier.textColor}`}>
              {(agentScore * 100).toFixed(0)}
            </p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Agent</p>
          </div>
          <div className="text-center p-2 bg-[#0f1420] rounded-lg">
            <p className="text-lg font-bold text-white">{agent.callCount}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Calls</p>
          </div>
          <div className="text-center p-2 bg-[#0f1420] rounded-lg">
            <p className="text-lg font-bold text-blue-400">{hasCustomerData ? (custScore * 100).toFixed(0) : '-'}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Customer</p>
          </div>
        </div>

        {/* Agent Performance Bar */}
        <div className="mb-2">
          <div className="text-[9px] text-gray-500 mb-1 uppercase tracking-wider">Agent Performance</div>
          <div className="flex items-center h-2 rounded-full overflow-hidden bg-[#0f1420]">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${agentPos}%` }}
            />
            <div
              className="h-full bg-gray-600"
              style={{ width: `${agentNeut}%` }}
            />
            <div
              className="h-full bg-red-500 transition-all"
              style={{ width: `${agentNeg}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] mt-1">
            <span className="text-emerald-400">{agentPos.toFixed(0)}%</span>
            <span className="text-gray-500">{agentNeut.toFixed(0)}%</span>
            <span className="text-red-400">{agentNeg.toFixed(0)}%</span>
          </div>
        </div>

        {/* Customer Sentiment Bar */}
        {hasCustomerData && (
          <div className="mb-2">
            <div className="text-[9px] text-gray-500 mb-1 uppercase tracking-wider">Customer Sentiment</div>
            <div className="flex items-center h-2 rounded-full overflow-hidden bg-[#0f1420]">
              <div
                className="h-full bg-emerald-500/70 transition-all"
                style={{ width: `${custPos}%` }}
              />
              <div
                className="h-full bg-gray-600/70"
                style={{ width: `${custNeut}%` }}
              />
              <div
                className="h-full bg-red-500/70 transition-all"
                style={{ width: `${custNeg}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] mt-1">
              <span className="text-emerald-400/70">{custPos.toFixed(0)}%</span>
              <span className="text-gray-500/70">{custNeut.toFixed(0)}%</span>
              <span className="text-red-400/70">{custNeg.toFixed(0)}%</span>
            </div>
          </div>
        )}

        {/* Click hint */}
        <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-center gap-1 text-[10px] text-gray-600 group-hover:text-blue-400 transition-colors">
          <span>Click for full profile</span>
          <ChevronRight className="h-3 w-3" />
        </div>
      </div>
    );
  }

  // Full profile card
  return (
    <div className="space-y-4">
      {/* Header with tier badge */}
      <div className={`p-4 rounded-xl border ${tier.bgColor} ${tier.borderColor}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${tier.bgColor}`}>
              <User className={`h-6 w-6 ${tier.iconColor}`} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">{agent.name}</h3>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                {agent.department && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {agent.department}
                  </span>
                )}
                {agent.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {agent.email}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${tier.bgColor} ${tier.borderColor} border`}>
            <TierIcon className={`h-4 w-4 ${tier.iconColor}`} />
            <span className={`text-sm font-medium ${tier.textColor}`}>{tier.label}</span>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-[#1a1f2e] rounded-xl border border-white/[0.08]">
          <div className="flex items-center gap-2 mb-1">
            <Phone className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-gray-400">Total Calls</span>
          </div>
          <p className="text-xl font-semibold text-white">{agent.callCount}</p>
        </div>
        <div className="p-3 bg-[#1a1f2e] rounded-xl border border-white/[0.08]">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-purple-400" />
            <span className="text-xs text-gray-400">Avg Duration</span>
          </div>
          <p className="text-xl font-semibold text-white">{formatDuration(agent.avgDuration)}</p>
        </div>
        <div className="p-3 bg-[#1a1f2e] rounded-xl border border-white/[0.08]">
          <div className="flex items-center gap-2 mb-1">
            <Award className={`h-4 w-4 ${tier.iconColor}`} />
            <span className="text-xs text-gray-400">Agent Score</span>
          </div>
          <p className={`text-xl font-semibold ${tier.textColor}`}>
            {(agentScore * 100).toFixed(0)}%
          </p>
        </div>
        <div className="p-3 bg-[#1a1f2e] rounded-xl border border-white/[0.08]">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-gray-400">Customer Score</span>
          </div>
          <p className="text-xl font-semibold text-blue-400">
            {hasCustomerData ? (custScore * 100).toFixed(0) + '%' : 'N/A'}
          </p>
        </div>
      </div>

      {/* Sentiment Breakdown - Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Agent Performance */}
        <div className="p-4 bg-[#1a1f2e] rounded-xl border border-white/[0.08]">
          <h4 className="text-sm font-medium text-gray-400 mb-3">Agent Performance</h4>
          <div className="flex items-center gap-2 h-4 rounded-full overflow-hidden bg-[#0f1420]">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${agentPos}%` }}
            />
            <div
              className="h-full bg-gray-500"
              style={{ width: `${agentNeut}%` }}
            />
            <div
              className="h-full bg-red-500"
              style={{ width: `${agentNeg}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs">
            <span className="flex items-center gap-1 text-emerald-400">
              <ThumbsUp className="h-3 w-3" />
              {agentPos.toFixed(1)}% Positive
            </span>
            <span className="flex items-center gap-1 text-gray-400">
              <Minus className="h-3 w-3" />
              {agentNeut.toFixed(1)}% Neutral
            </span>
            <span className="flex items-center gap-1 text-red-400">
              <ThumbsDown className="h-3 w-3" />
              {agentNeg.toFixed(1)}% Negative
            </span>
          </div>
        </div>

        {/* Customer Sentiment */}
        <div className="p-4 bg-[#1a1f2e] rounded-xl border border-white/[0.08]">
          <h4 className="text-sm font-medium text-gray-400 mb-3">Customer Sentiment</h4>
          {hasCustomerData ? (
            <>
              <div className="flex items-center gap-2 h-4 rounded-full overflow-hidden bg-[#0f1420]">
                <div
                  className="h-full bg-emerald-500/70"
                  style={{ width: `${custPos}%` }}
                />
                <div
                  className="h-full bg-gray-500/70"
                  style={{ width: `${custNeut}%` }}
                />
                <div
                  className="h-full bg-red-500/70"
                  style={{ width: `${custNeg}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs">
                <span className="flex items-center gap-1 text-emerald-400/70">
                  <ThumbsUp className="h-3 w-3" />
                  {custPos.toFixed(1)}% Positive
                </span>
                <span className="flex items-center gap-1 text-gray-400/70">
                  <Minus className="h-3 w-3" />
                  {custNeut.toFixed(1)}% Neutral
                </span>
                <span className="flex items-center gap-1 text-red-400/70">
                  <ThumbsDown className="h-3 w-3" />
                  {custNeg.toFixed(1)}% Negative
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-16 text-gray-500 text-sm">
              Customer sentiment data not available
            </div>
          )}
        </div>
      </div>

      {/* AI-Generated Profile Insights */}
      {loadingProfile ? (
        <div className="p-6 bg-[#1a1f2e] rounded-xl border border-white/[0.08]">
          <div className="flex items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500/20 border-t-blue-500" />
            <span className="text-gray-400">Generating AI coaching insights...</span>
          </div>
        </div>
      ) : profileError ? (
        <div className="p-6 bg-amber-500/10 rounded-xl border border-amber-500/20">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <h4 className="text-sm font-medium text-amber-400">Unable to Load AI Insights</h4>
          </div>
          <p className="text-gray-300 text-sm mb-3">{profileError}</p>
          <p className="text-gray-400 text-xs">
            The basic performance metrics are still available above. AI coaching insights require an OpenRouter API connection.
          </p>
        </div>
      ) : profile ? (
        <div className="space-y-4">
          {/* Overall Assessment */}
          <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <h4 className="text-sm font-medium text-blue-400 mb-2">Overall Assessment</h4>
            <p className="text-gray-300">{profile.overallAssessment}</p>
          </div>

          {/* Strengths */}
          {profile.strengths.length > 0 && (
            <div className="p-4 bg-[#1a1f2e] rounded-xl border border-white/[0.08]">
              <h4 className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
                <Star className="h-4 w-4" />
                Strengths
              </h4>
              <ul className="space-y-2">
                {profile.strengths.map((strength, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Areas for Improvement */}
          {profile.areasForImprovement.length > 0 && (
            <div className="p-4 bg-[#1a1f2e] rounded-xl border border-white/[0.08]">
              <h4 className="text-sm font-medium text-amber-400 mb-3 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Areas for Improvement
              </h4>
              <ul className="space-y-2">
                {profile.areasForImprovement.map((area, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-amber-400 mt-0.5">•</span>
                    {area}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {profile.recommendations.length > 0 && (
            <div className="p-4 bg-[#1a1f2e] rounded-xl border border-white/[0.08]">
              <h4 className="text-sm font-medium text-blue-400 mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Coaching Recommendations
              </h4>
              <ul className="space-y-2">
                {profile.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-blue-400 mt-0.5">{idx + 1}.</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      {/* Recent Calls */}
      {agent.recentCalls.length > 0 && (
        <div className="p-4 bg-[#1a1f2e] rounded-xl border border-white/[0.08]">
          <h4 className="text-sm font-medium text-gray-400 mb-3">Recent Calls</h4>
          <div className="space-y-2">
            {agent.recentCalls.slice(0, 5).map((call, idx) => (
              <div
                key={call.id}
                className="flex items-center justify-between p-2 rounded-lg bg-[#0f1420] hover:bg-white/[0.02] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  {call.sentiment === 'positive' ? (
                    <ThumbsUp className="h-4 w-4 text-emerald-400" />
                  ) : call.sentiment === 'negative' ? (
                    <ThumbsDown className="h-4 w-4 text-red-400" />
                  ) : (
                    <Minus className="h-4 w-4 text-gray-400" />
                  )}
                  <div>
                    <p className="text-sm text-white truncate max-w-[300px]">
                      {call.summary || 'No summary available'}
                    </p>
                    <p className="text-xs text-gray-500">{formatDate(call.date)}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-500">{formatDuration(call.duration)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View All Calls Button */}
      {onViewTranscripts && (
        <button
          onClick={() => onViewTranscripts(agent.name)}
          className="w-full p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors flex items-center justify-center gap-2"
        >
          <Phone className="h-4 w-4" />
          View All {agent.callCount} Calls
        </button>
      )}
    </div>
  );
}
