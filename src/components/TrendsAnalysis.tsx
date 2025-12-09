'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  CartesianGrid,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Calendar, AlertTriangle, CheckCircle } from 'lucide-react';
import CallVolumeHeatmap from './CallVolumeHeatmap';

interface BaselineComparison {
  category: string;
  subcategory: string;
  baselineCount: number;
  recentCount: number;
  change: number;
  percentChange: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export default function TrendsAnalysis() {
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState<BaselineComparison[]>([]);
  const [daysRecent, setDaysRecent] = useState(21);
  const [filterTrend, setFilterTrend] = useState<'all' | 'increasing' | 'decreasing' | 'stable'>('all');

  useEffect(() => {
    fetchTrends();
  }, [daysRecent]);

  const fetchTrends = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics?type=baseline&daysRecent=${daysRecent}`);
      const result = await response.json();

      if (result.success) {
        setTrends(result.data);
      }
    } catch (error) {
      console.error('Error fetching trends:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500/20 border-t-blue-500" />
      </div>
    );
  }

  const filteredTrends = trends.filter(t =>
    filterTrend === 'all' ? true : t.trend === filterTrend
  );

  const increasingCount = trends.filter(t => t.trend === 'increasing').length;
  const decreasingCount = trends.filter(t => t.trend === 'decreasing').length;
  const stableCount = trends.filter(t => t.trend === 'stable').length;

  // Top increasing issues
  const topIncreasing = trends
    .filter(t => t.trend === 'increasing')
    .sort((a, b) => b.change - a.change)
    .slice(0, 10);

  // Top decreasing issues (improvements)
  const topDecreasing = trends
    .filter(t => t.trend === 'decreasing')
    .sort((a, b) => a.change - b.change)
    .slice(0, 10);

  // Prepare chart data
  const chartData = filteredTrends.slice(0, 15).map(t => ({
    name: `${t.category} - ${t.subcategory}`,
    baseline: t.baselineCount,
    recent: t.recentCount,
    change: t.change,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 rounded-2xl p-6 border border-blue-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Trend Analysis</h2>
              <p className="text-gray-400">Baseline vs Recent Comparison</p>
            </div>
          </div>

          {/* Days selector */}
          <select
            value={daysRecent}
            onChange={(e) => setDaysRecent(parseInt(e.target.value))}
            className="px-4 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={21}>Last 21 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#131a29] rounded-xl p-6 border border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <TrendingUp className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{increasingCount}</div>
              <div className="text-sm text-gray-400">Increasing Issues</div>
            </div>
          </div>
        </div>

        <div className="bg-[#131a29] rounded-xl p-6 border border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/20">
              <TrendingDown className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{decreasingCount}</div>
              <div className="text-sm text-gray-400">Improving Issues</div>
            </div>
          </div>
        </div>

        <div className="bg-[#131a29] rounded-xl p-6 border border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-500/20">
              <Minus className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stableCount}</div>
              <div className="text-sm text-gray-400">Stable</div>
            </div>
          </div>
        </div>

        <div className="bg-[#131a29] rounded-xl p-6 border border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Calendar className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{daysRecent}</div>
              <div className="text-sm text-gray-400">Day Window</div>
            </div>
          </div>
        </div>
      </div>

      {/* Call Volume Heatmap */}
      <CallVolumeHeatmap />

      {/* Filter Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilterTrend('all')}
          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
            filterTrend === 'all'
              ? 'bg-blue-500 text-white'
              : 'bg-white/[0.05] text-gray-400 hover:bg-white/[0.08]'
          }`}
        >
          All Trends
        </button>
        <button
          onClick={() => setFilterTrend('increasing')}
          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
            filterTrend === 'increasing'
              ? 'bg-red-500 text-white'
              : 'bg-white/[0.05] text-gray-400 hover:bg-white/[0.08]'
          }`}
        >
          Increasing
        </button>
        <button
          onClick={() => setFilterTrend('decreasing')}
          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
            filterTrend === 'decreasing'
              ? 'bg-green-500 text-white'
              : 'bg-white/[0.05] text-gray-400 hover:bg-white/[0.08]'
          }`}
        >
          Decreasing
        </button>
        <button
          onClick={() => setFilterTrend('stable')}
          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
            filterTrend === 'stable'
              ? 'bg-gray-500 text-white'
              : 'bg-white/[0.05] text-gray-400 hover:bg-white/[0.08]'
          }`}
        >
          Stable
        </button>
      </div>

      {/* Baseline vs Recent Chart */}
      <div className="bg-[#131a29] rounded-xl p-6 border border-white/[0.08]">
        <h3 className="text-lg font-semibold text-white mb-4">Baseline vs Recent</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={150}
            />
            <YAxis tick={{ fill: '#9ca3af' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Bar dataKey="baseline" fill="#3b82f6" name="Baseline" />
            <Bar dataKey="recent" fill="#10b981" name="Recent" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Two Column: Increasing and Decreasing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Increasing Issues */}
        <div className="bg-[#131a29] rounded-xl p-6 border border-red-500/20">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h3 className="text-lg font-semibold text-white">Top Increasing Issues</h3>
          </div>
          <div className="space-y-2">
            {topIncreasing.map((trend, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20"
              >
                <div>
                  <div className="font-medium text-white text-sm">{trend.category}</div>
                  <div className="text-xs text-gray-400">{trend.subcategory}</div>
                </div>
                <div className="text-right">
                  <div className="text-red-400 font-bold">+{trend.change}</div>
                  <div className="text-xs text-gray-400">({trend.percentChange.toFixed(1)}%)</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Decreasing Issues (Improvements) */}
        <div className="bg-[#131a29] rounded-xl p-6 border border-green-500/20">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <h3 className="text-lg font-semibold text-white">Top Improving Issues</h3>
          </div>
          <div className="space-y-2">
            {topDecreasing.map((trend, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20"
              >
                <div>
                  <div className="font-medium text-white text-sm">{trend.category}</div>
                  <div className="text-xs text-gray-400">{trend.subcategory}</div>
                </div>
                <div className="text-right">
                  <div className="text-green-400 font-bold">{trend.change}</div>
                  <div className="text-xs text-gray-400">({trend.percentChange.toFixed(1)}%)</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full Trends Table */}
      <div className="bg-[#131a29] rounded-xl p-6 border border-white/[0.08]">
        <h3 className="text-lg font-semibold text-white mb-4">All Trends</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Category</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Subcategory</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Baseline</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Recent</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Change</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">% Change</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Trend</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrends.map((trend, idx) => (
                <tr key={idx} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="py-3 px-4 text-sm text-white">{trend.category}</td>
                  <td className="py-3 px-4 text-sm text-gray-300">{trend.subcategory}</td>
                  <td className="py-3 px-4 text-sm text-right text-gray-300">{trend.baselineCount}</td>
                  <td className="py-3 px-4 text-sm text-right text-white">{trend.recentCount}</td>
                  <td className={`py-3 px-4 text-sm text-right font-medium ${
                    trend.change > 0 ? 'text-red-400' : trend.change < 0 ? 'text-green-400' : 'text-gray-400'
                  }`}>
                    {trend.change > 0 ? '+' : ''}{trend.change}
                  </td>
                  <td className={`py-3 px-4 text-sm text-right ${
                    trend.percentChange > 0 ? 'text-red-400' : trend.percentChange < 0 ? 'text-green-400' : 'text-gray-400'
                  }`}>
                    {trend.percentChange > 0 ? '+' : ''}{trend.percentChange.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-center">
                    {trend.trend === 'increasing' && <TrendingUp className="h-4 w-4 text-red-500 mx-auto" />}
                    {trend.trend === 'decreasing' && <TrendingDown className="h-4 w-4 text-green-500 mx-auto" />}
                    {trend.trend === 'stable' && <Minus className="h-4 w-4 text-gray-400 mx-auto" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
