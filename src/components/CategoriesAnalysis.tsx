'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Tag, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CategoryStat {
  category: string;
  subcategory: string;
  count: number;
  percentage: number;
  avgConfidence: number;
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
];

export default function CategoriesAnalysis() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CategoryStat[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetchCategoryStats();
  }, []);

  const fetchCategoryStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/analytics?type=categories');
      const result = await response.json();

      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Error fetching category stats:', error);
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

  // Group by main category
  const categoryGroups = stats.reduce((acc, stat) => {
    if (!acc[stat.category]) {
      acc[stat.category] = [];
    }
    acc[stat.category].push(stat);
    return {};
  }, {} as { [key: string]: CategoryStat[] });

  // Get top-level category totals
  const categoryTotals = Object.entries(categoryGroups).map(([category, items]) => ({
    category,
    count: items.reduce((sum, item) => sum + item.count, 0),
    avgConfidence: items.reduce((sum, item) => sum + item.avgConfidence, 0) / items.length,
  })).sort((a, b) => b.count - a.count);

  const selectedCategoryData = selectedCategory
    ? categoryGroups[selectedCategory] || []
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-purple-500/10 rounded-2xl p-6 border border-purple-500/20">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600">
            <Tag className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Category Analysis</h2>
            <p className="text-gray-400">Multi-level categorization with confidence scoring</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#131a29] rounded-xl p-6 border border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Tag className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{categoryTotals.length}</div>
              <div className="text-sm text-gray-400">Total Categories</div>
            </div>
          </div>
        </div>

        <div className="bg-[#131a29] rounded-xl p-6 border border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/20">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats.length}</div>
              <div className="text-sm text-gray-400">Subcategories</div>
            </div>
          </div>
        </div>

        <div className="bg-[#131a29] rounded-xl p-6 border border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <AlertCircle className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {(stats.reduce((sum, s) => sum + s.avgConfidence, 0) / stats.length * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-400">Avg Confidence</div>
            </div>
          </div>
        </div>

        <div className="bg-[#131a29] rounded-xl p-6 border border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <TrendingUp className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {stats.reduce((sum, s) => sum + s.count, 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-400">Total Items</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="bg-[#131a29] rounded-xl p-6 border border-white/[0.08]">
          <h3 className="text-lg font-semibold text-white mb-4">Category Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryTotals}
                dataKey="count"
                nameKey="category"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {categoryTotals.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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

        {/* Top Categories */}
        <div className="bg-[#131a29] rounded-xl p-6 border border-white/[0.08]">
          <h3 className="text-lg font-semibold text-white mb-4">Top Categories</h3>
          <div className="space-y-3">
            {categoryTotals.slice(0, 10).map((cat, idx) => (
              <div
                key={cat.category}
                onClick={() => setSelectedCategory(cat.category)}
                className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <div>
                    <div className="font-medium text-white">{cat.category}</div>
                    <div className="text-xs text-gray-400">
                      {cat.count.toLocaleString()} items ({(cat.avgConfidence * 100).toFixed(1)}% confidence)
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-400">{idx + 1}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Subcategory Breakdown */}
      {selectedCategory && (
        <div className="bg-[#131a29] rounded-xl p-6 border border-white/[0.08]">
          <h3 className="text-lg font-semibold text-white mb-4">
            {selectedCategory} - Subcategory Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={selectedCategoryData}>
              <XAxis
                dataKey="subcategory"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis tick={{ fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>

          <button
            onClick={() => setSelectedCategory(null)}
            className="mt-4 px-4 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-white text-sm transition-colors"
          >
            ← Back to Categories
          </button>
        </div>
      )}

      {/* All Categories Table */}
      <div className="bg-[#131a29] rounded-xl p-6 border border-white/[0.08]">
        <h3 className="text-lg font-semibold text-white mb-4">All Categories & Subcategories</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Category</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Subcategory</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Count</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Percentage</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat, idx) => (
                <tr key={idx} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="py-3 px-4 text-sm text-white">{stat.category}</td>
                  <td className="py-3 px-4 text-sm text-gray-300">{stat.subcategory}</td>
                  <td className="py-3 px-4 text-sm text-right text-white">{stat.count.toLocaleString()}</td>
                  <td className="py-3 px-4 text-sm text-right text-gray-300">
                    {stat.percentage.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-sm text-right">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        stat.avgConfidence > 0.8
                          ? 'bg-green-500/20 text-green-400'
                          : stat.avgConfidence > 0.6
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {(stat.avgConfidence * 100).toFixed(1)}%
                    </span>
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
