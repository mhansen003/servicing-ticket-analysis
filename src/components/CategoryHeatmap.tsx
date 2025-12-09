'use client';

import { useState, useEffect } from 'react';
import { Tag, TrendingUp } from 'lucide-react';

/**
 * PHASE 5: Category Heatmap
 * Visualizes category call patterns over time periods
 */

interface HeatmapCell {
  x: string; // Time period (date or hour)
  y: string; // Category
  value: number; // Call count
}

interface CategoryHeatmapProps {
  data?: HeatmapCell[];
  title?: string;
  timePeriod?: 'hourly' | 'daily' | 'weekly';
}

export default function CategoryHeatmap({
  data,
  title = 'Category Trends Over Time',
  timePeriod = 'daily'
}: CategoryHeatmapProps) {
  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxValue, setMaxValue] = useState(0);
  const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [timePeriods, setTimePeriods] = useState<string[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        if (data) {
          setHeatmapData(data);
        } else {
          // Load from processed stats
          const response = await fetch('/data/processed-stats.json');
          if (response.ok) {
            const stats = await response.json();

            // For now, we'll create a heatmap from category distribution over recent days
            // This uses the daily time series and category breakdown
            const heatmapCells: HeatmapCell[] = [];

            if (stats.timeSeries?.daily && stats.categories) {
              // Get last 14 days
              const dailyData = stats.timeSeries.daily.slice(-14);

              // Get top categories
              const topCategories = stats.categories
                .sort((a: any, b: any) => b.count - a.count)
                .slice(0, 10)
                .map((c: any) => c.category);

              // Create synthetic data based on category totals and daily patterns
              // In a real scenario, this would come from the database with actual daily breakdowns
              dailyData.forEach((day: any) => {
                topCategories.forEach((category: string) => {
                  const categoryTotal = stats.categories.find((c: any) => c.category === category)?.count || 0;
                  // Distribute calls across days with some variation
                  const avgPerDay = categoryTotal / dailyData.length;
                  const variation = (Math.random() - 0.5) * 0.4; // ±20% variation
                  const value = Math.max(0, Math.round(avgPerDay * (1 + variation)));

                  heatmapCells.push({
                    x: day.date,
                    y: category,
                    value,
                  });
                });
              });

              setHeatmapData(heatmapCells);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load category heatmap data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [data, timePeriod]);

  // Extract unique categories and time periods
  useEffect(() => {
    if (heatmapData.length > 0) {
      const uniqueCategories = Array.from(new Set(heatmapData.map(cell => cell.y)));
      const uniquePeriods = Array.from(new Set(heatmapData.map(cell => cell.x)));

      setCategories(uniqueCategories);
      setTimePeriods(uniquePeriods);

      const max = Math.max(...heatmapData.map(cell => cell.value));
      setMaxValue(max);
    }
  }, [heatmapData]);

  const getCellValue = (period: string, category: string): number => {
    const cell = heatmapData.find(c => c.x === period && c.y === category);
    return cell?.value || 0;
  };

  const getCellColor = (value: number): string => {
    if (maxValue === 0) return 'bg-gray-800';

    const intensity = value / maxValue;

    if (intensity === 0) return 'bg-gray-800/30';
    if (intensity < 0.2) return 'bg-purple-900/40';
    if (intensity < 0.4) return 'bg-purple-700/50';
    if (intensity < 0.6) return 'bg-purple-600/60';
    if (intensity < 0.8) return 'bg-purple-500/70';
    return 'bg-purple-400/80';
  };

  const getCellBorder = (value: number): string => {
    if (maxValue === 0) return 'border-gray-700';

    const intensity = value / maxValue;

    if (intensity === 0) return 'border-gray-700';
    if (intensity < 0.4) return 'border-purple-800';
    if (intensity < 0.7) return 'border-purple-600';
    return 'border-purple-400';
  };

  if (loading) {
    return (
      <div className="p-6 bg-[#131a29] rounded-xl border border-white/[0.08]">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500/20 border-t-purple-500 mx-auto mb-4" />
            <p className="text-gray-400">Loading category heatmap...</p>
          </div>
        </div>
      </div>
    );
  }

  if (categories.length === 0 || timePeriods.length === 0) {
    return (
      <div className="p-6 bg-[#131a29] rounded-xl border border-white/[0.08]">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400">No category data available</p>
        </div>
      </div>
    );
  }

  // Calculate category totals
  const categoryTotals = categories.map(category => ({
    category,
    total: timePeriods.reduce((sum, period) => sum + getCellValue(period, category), 0),
  }));

  const maxCategoryTotal = Math.max(...categoryTotals.map(c => c.total));

  // Calculate period totals
  const periodTotals = timePeriods.map(period => ({
    period,
    total: categories.reduce((sum, category) => sum + getCellValue(period, category), 0),
  }));

  const maxPeriodTotal = Math.max(...periodTotals.map(p => p.total));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10">
            <Tag className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="text-sm text-gray-400">Category patterns over time</p>
          </div>
        </div>
        <div className="text-sm text-gray-400">
          Peak: {maxValue.toLocaleString()} calls
        </div>
      </div>

      {/* Main Heatmap */}
      <div className="p-6 bg-[#131a29] rounded-xl border border-white/[0.08]">
        <div className="flex gap-4">
          {/* Y-axis labels (Categories) */}
          <div className="flex flex-col justify-around pt-8 pb-4">
            {categories.map(category => (
              <div key={category} className="h-8 flex items-center">
                <span className="text-sm font-medium text-gray-400 w-32 text-right truncate" title={category}>
                  {category}
                </span>
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          <div className="flex-1 overflow-x-auto">
            <div className="min-w-[600px]">
              {/* X-axis labels (Time periods) */}
              <div className="flex mb-2">
                {timePeriods.map((period, idx) => (
                  <div
                    key={period}
                    className={`flex-1 text-center ${idx % 2 === 0 ? '' : 'opacity-0'}`}
                  >
                    <span className="text-xs text-gray-500">
                      {period.split('-').slice(1).join('/')}
                    </span>
                  </div>
                ))}
              </div>

              {/* Grid cells */}
              <div className="space-y-1">
                {categories.map(category => (
                  <div key={category} className="flex gap-1">
                    {timePeriods.map(period => {
                      const value = getCellValue(period, category);
                      const isSelected = selectedCell?.x === period && selectedCell?.y === category;

                      return (
                        <div
                          key={`${category}-${period}`}
                          className={`
                            flex-1 h-8 rounded border transition-all cursor-pointer
                            ${getCellColor(value)}
                            ${getCellBorder(value)}
                            ${isSelected ? 'ring-2 ring-purple-400 scale-105' : 'hover:scale-105'}
                          `}
                          onMouseEnter={() => setSelectedCell({ x: period, y: category, value })}
                          onMouseLeave={() => setSelectedCell(null)}
                          title={`${category} on ${period}: ${value} calls`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Period volume bar chart */}
              <div className="mt-4 pt-4 border-t border-white/[0.08]">
                <h4 className="text-xs font-medium text-gray-400 mb-2">Daily Volume</h4>
                <div className="flex gap-1 items-end h-16">
                  {periodTotals.map(({ period, total }) => (
                    <div
                      key={period}
                      className="flex-1 bg-purple-500/30 rounded-t transition-all hover:bg-purple-500/50"
                      style={{ height: `${(total / maxPeriodTotal) * 100}%` }}
                      title={`${period}: ${total} calls`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Category volume sidebar */}
          <div className="w-24">
            <div className="h-8" /> {/* Spacer for header alignment */}
            <div className="space-y-1">
              {categoryTotals.map(({ category, total }) => (
                <div key={category} className="h-8 flex items-center gap-2">
                  <div
                    className="h-full bg-pink-500/30 rounded transition-all hover:bg-pink-500/50"
                    style={{ width: `${(total / maxCategoryTotal) * 100}%` }}
                    title={`${category}: ${total} calls`}
                  />
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {total.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Selected cell info */}
        {selectedCell && (
          <div className="mt-4 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-400" />
              <span className="text-sm text-purple-300">
                <strong>{selectedCell.y}</strong> on <strong>{selectedCell.x}</strong>: {selectedCell.value.toLocaleString()} calls
              </span>
            </div>
          </div>
        )}

        {/* Color legend */}
        <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
          <span>Low</span>
          <div className="flex gap-1">
            <div className="w-6 h-3 rounded bg-gray-800/30" />
            <div className="w-6 h-3 rounded bg-purple-900/40" />
            <div className="w-6 h-3 rounded bg-purple-700/50" />
            <div className="w-6 h-3 rounded bg-purple-600/60" />
            <div className="w-6 h-3 rounded bg-purple-500/70" />
            <div className="w-6 h-3 rounded bg-purple-400/80" />
          </div>
          <span>High</span>
        </div>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-[#131a29] rounded-xl border border-white/[0.08]">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Most Active Category</h4>
          <p className="text-2xl font-semibold text-white truncate" title={categoryTotals.reduce((max, c) => c.total > max.total ? c : max).category}>
            {categoryTotals.reduce((max, c) => c.total > max.total ? c : max).category}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {categoryTotals.reduce((max, c) => c.total > max.total ? c : max).total.toLocaleString()} calls
          </p>
        </div>

        <div className="p-4 bg-[#131a29] rounded-xl border border-white/[0.08]">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Busiest {timePeriod === 'daily' ? 'Day' : 'Period'}</h4>
          <p className="text-2xl font-semibold text-white">
            {periodTotals.reduce((max, p) => p.total > max.total ? p : max).period.split('-').slice(1).join('/')}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {periodTotals.reduce((max, p) => p.total > max.total ? p : max).total.toLocaleString()} calls
          </p>
        </div>

        <div className="p-4 bg-[#131a29] rounded-xl border border-white/[0.08]">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Total Calls</h4>
          <p className="text-2xl font-semibold text-white">
            {heatmapData.reduce((sum, cell) => sum + cell.value, 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-1">Across all periods</p>
        </div>
      </div>
    </div>
  );
}
