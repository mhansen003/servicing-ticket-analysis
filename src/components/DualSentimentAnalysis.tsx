'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import { Users, User, Smile, Meh, Frown } from 'lucide-react';

interface AnalysisData {
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
}

const COLORS = {
  positive: '#10b981',
  neutral: '#6b7280',
  negative: '#ef4444',
};

export default function DualSentimentAnalysis() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalysisData | null>(null);

  useEffect(() => {
    loadAnalysisData();
  }, []);

  const loadAnalysisData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/data/deep-analysis.json');
      const analysisData = await response.json();
      setData(analysisData);
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
        <p className="text-gray-400">No analysis data available</p>
      </div>
    );
  }

  const agentData = [
    { name: 'Positive', value: data.summary.agentSentiment.positive, color: COLORS.positive },
    { name: 'Neutral', value: data.summary.agentSentiment.neutral, color: COLORS.neutral },
    { name: 'Negative', value: data.summary.agentSentiment.negative, color: COLORS.negative },
  ];

  const customerData = [
    { name: 'Positive', value: data.summary.customerSentiment.positive, color: COLORS.positive },
    { name: 'Neutral', value: data.summary.customerSentiment.neutral, color: COLORS.neutral },
    { name: 'Negative', value: data.summary.customerSentiment.negative, color: COLORS.negative },
  ];

  const comparisonData = [
    {
      category: 'Positive',
      Agent: data.summary.agentSentiment.positive,
      Customer: data.summary.customerSentiment.positive,
    },
    {
      category: 'Neutral',
      Agent: data.summary.agentSentiment.neutral,
      Customer: data.summary.customerSentiment.neutral,
    },
    {
      category: 'Negative',
      Agent: data.summary.agentSentiment.negative,
      Customer: data.summary.customerSentiment.negative,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-2xl p-6 border border-blue-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Dual Sentiment Analysis</h2>
              <p className="text-gray-400">Agent Performance vs Customer Satisfaction</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Analyzed</div>
            <div className="text-2xl font-bold text-white">
              {data.metadata.analyzedTickets.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">tickets</div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Agent Sentiment */}
        <div className="bg-[#131a29] rounded-xl p-6 border border-white/[0.08]">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <User className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Agent Performance</h3>
              <div className="text-sm text-gray-400">
                Avg Score: {(data.summary.avgAgentScore * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10">
              <div className="flex items-center gap-3">
                <Smile className="h-5 w-5 text-green-500" />
                <span className="text-white font-medium">Positive</span>
              </div>
              <div className="text-right">
                <div className="text-white font-bold">
                  {data.summary.agentSentiment.positive.toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">
                  {((data.summary.agentSentiment.positive / data.metadata.analyzedTickets) * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-500/10">
              <div className="flex items-center gap-3">
                <Meh className="h-5 w-5 text-gray-500" />
                <span className="text-white font-medium">Neutral</span>
              </div>
              <div className="text-right">
                <div className="text-white font-bold">
                  {data.summary.agentSentiment.neutral.toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">
                  {((data.summary.agentSentiment.neutral / data.metadata.analyzedTickets) * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
              <div className="flex items-center gap-3">
                <Frown className="h-5 w-5 text-red-500" />
                <span className="text-white font-medium">Negative</span>
              </div>
              <div className="text-right">
                <div className="text-white font-bold">
                  {data.summary.agentSentiment.negative.toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">
                  {((data.summary.agentSentiment.negative / data.metadata.analyzedTickets) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Sentiment */}
        <div className="bg-[#131a29] rounded-xl p-6 border border-white/[0.08]">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Users className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Customer Satisfaction</h3>
              <div className="text-sm text-gray-400">
                Avg Score: {(data.summary.avgCustomerScore * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10">
              <div className="flex items-center gap-3">
                <Smile className="h-5 w-5 text-green-500" />
                <span className="text-white font-medium">Positive</span>
              </div>
              <div className="text-right">
                <div className="text-white font-bold">
                  {data.summary.customerSentiment.positive.toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">
                  {((data.summary.customerSentiment.positive / data.metadata.analyzedTickets) * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-500/10">
              <div className="flex items-center gap-3">
                <Meh className="h-5 w-5 text-gray-500" />
                <span className="text-white font-medium">Neutral</span>
              </div>
              <div className="text-right">
                <div className="text-white font-bold">
                  {data.summary.customerSentiment.neutral.toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">
                  {((data.summary.customerSentiment.neutral / data.metadata.analyzedTickets) * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
              <div className="flex items-center gap-3">
                <Frown className="h-5 w-5 text-red-500" />
                <span className="text-white font-medium">Negative</span>
              </div>
              <div className="text-right">
                <div className="text-white font-bold">
                  {data.summary.customerSentiment.negative.toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">
                  {((data.summary.customerSentiment.negative / data.metadata.analyzedTickets) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Pie Chart */}
        <div className="bg-[#131a29] rounded-xl p-6 border border-white/[0.08]">
          <h3 className="text-lg font-semibold text-white mb-4">Agent Sentiment Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={agentData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {agentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Customer Pie Chart */}
        <div className="bg-[#131a29] rounded-xl p-6 border border-white/[0.08]">
          <h3 className="text-lg font-semibold text-white mb-4">Customer Sentiment Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={customerData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {customerData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Comparison Bar Chart */}
      <div className="bg-[#131a29] rounded-xl p-6 border border-white/[0.08]">
        <h3 className="text-lg font-semibold text-white mb-4">Agent vs Customer Comparison</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={comparisonData}>
            <XAxis dataKey="category" tick={{ fill: '#9ca3af' }} />
            <YAxis tick={{ fill: '#9ca3af' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Bar dataKey="Agent" fill="#3b82f6" />
            <Bar dataKey="Customer" fill="#a855f7" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Analysis Metadata */}
      <div className="bg-[#131a29] rounded-xl p-6 border border-white/[0.08]">
        <h3 className="text-lg font-semibold text-white mb-4">Analysis Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-400">Total Tickets</div>
            <div className="text-xl font-bold text-white">
              {data.metadata.totalTickets.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Analyzed</div>
            <div className="text-xl font-bold text-white">
              {data.metadata.analyzedTickets.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Total Cost</div>
            <div className="text-xl font-bold text-white">${data.metadata.totalCost.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Analysis Date</div>
            <div className="text-sm font-medium text-white">
              {new Date(data.metadata.analysisDate).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
