'use client';

import { useState, useEffect } from 'react';
import { Calendar, TrendingUp } from 'lucide-react';

/**
 * PHASE 5: Interactive Call Volume Heatmap
 * Visualizes call patterns by day of week and hour of day
 */

interface HeatmapCell {
  x: string; // Hour (00:00 - 23:00)
  y: string; // Day of week
  value: number; // Call count
}

interface CallVolumeHeatmapProps {
  data?: HeatmapCell[];
  title?: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

export default function CallVolumeHeatmap({ data, title = 'Call Volume Heatmap' }: CallVolumeHeatmapProps) {
  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxValue, setMaxValue] = useState(0);
  const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null);

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
            if (stats.heatmaps?.dayHour?.data) {
              setHeatmapData(stats.heatmaps.dayHour.data);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load heatmap data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [data]);

  // Calculate max value for color scaling
  useEffect(() => {
    if (heatmapData.length > 0) {
      const max = Math.max(...heatmapData.map(cell => cell.value));
      setMaxValue(max);
    }
  }, [heatmapData]);

  const getCellValue = (hour: string, day: string): number => {
    const cell = heatmapData.find(c => c.x === hour && c.y === day);
    return cell?.value || 0;
  };

  const getCellColor = (value: number): string => {
    if (maxValue === 0) return 'bg-gray-800';

    const intensity = value / maxValue;

    if (intensity === 0) return 'bg-gray-800/30';
    if (intensity < 0.2) return 'bg-blue-900/40';
    if (intensity < 0.4) return 'bg-blue-700/50';
    if (intensity < 0.6) return 'bg-blue-600/60';
    if (intensity < 0.8) return 'bg-blue-500/70';
    return 'bg-blue-400/80';
  };

  const getCellBorder = (value: number): string => {
    if (maxValue === 0) return 'border-gray-700';

    const intensity = value / maxValue;

    if (intensity === 0) return 'border-gray-700';
    if (intensity < 0.4) return 'border-blue-800';
    if (intensity < 0.7) return 'border-blue-600';
    return 'border-blue-400';
  };

  if (loading) {
    return (
      <div className="p-6 bg-[#131a29] rounded-xl border border-white/[0.08]">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500/20 border-t-blue-500 mx-auto mb-4" />
            <p className="text-gray-400">Loading heatmap...</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate hourly totals for the bar chart
  const hourlyTotals = HOURS.map(hour => ({
    hour,
    total: DAYS.reduce((sum, day) => sum + getCellValue(hour, day), 0),
  }));

  const maxHourlyTotal = Math.max(...hourlyTotals.map(h => h.total));

  // Calculate daily totals
  const dailyTotals = DAYS.map(day => ({
    day,
    total: HOURS.reduce((sum, hour) => sum + getCellValue(hour, day), 0),
  }));

  const maxDailyTotal = Math.max(...dailyTotals.map(d => d.total));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10">
            <Calendar className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="text-sm text-gray-400">Call patterns by day and hour</p>
          </div>
        </div>
        <div className="text-sm text-gray-400">
          Peak: {maxValue.toLocaleString()} calls
        </div>
      </div>

      {/* Main Heatmap */}
      <div className="p-6 bg-[#131a29] rounded-xl border border-white/[0.08]">
        <div className="flex gap-4">
          {/* Y-axis labels (Days) */}
          <div className="flex flex-col justify-around pt-8 pb-4">
            {DAYS.map(day => (
              <div key={day} className="h-8 flex items-center">
                <span className="text-sm font-medium text-gray-400 w-10 text-right">{day}</span>
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          <div className="flex-1 overflow-x-auto">
            <div className="min-w-[800px]">
              {/* X-axis labels (Hours) - show every 3 hours */}
              <div className="flex mb-2">
                {HOURS.filter((_, i) => i % 3 === 0).map(hour => (
                  <div key={hour} className="flex-1 text-center">
                    <span className="text-xs text-gray-500">{hour}</span>
                  </div>
                ))}
              </div>

              {/* Grid cells */}
              <div className="space-y-1">
                {DAYS.map(day => (
                  <div key={day} className="flex gap-1">
                    {HOURS.map(hour => {
                      const value = getCellValue(hour, day);
                      const isSelected = selectedCell?.x === hour && selectedCell?.y === day;

                      return (
                        <div
                          key={`${day}-${hour}`}
                          className={`
                            flex-1 h-8 rounded border transition-all cursor-pointer
                            ${getCellColor(value)}
                            ${getCellBorder(value)}
                            ${isSelected ? 'ring-2 ring-blue-400 scale-105' : 'hover:scale-105'}
                          `}
                          onMouseEnter={() => setSelectedCell({ x: hour, y: day, value })}
                          onMouseLeave={() => setSelectedCell(null)}
                          title={`${day} ${hour}: ${value} calls`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Hourly volume bar chart */}
              <div className="mt-4 pt-4 border-t border-white/[0.08]">
                <h4 className="text-xs font-medium text-gray-400 mb-2">Hourly Volume</h4>
                <div className="flex gap-1 items-end h-16">
                  {hourlyTotals.map(({ hour, total }) => (
                    <div
                      key={hour}
                      className="flex-1 bg-blue-500/30 rounded-t transition-all hover:bg-blue-500/50"
                      style={{ height: `${(total / maxHourlyTotal) * 100}%` }}
                      title={`${hour}: ${total} calls`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Daily volume sidebar */}
          <div className="w-24">
            <div className="h-8" /> {/* Spacer for header alignment */}
            <div className="space-y-1">
              {dailyTotals.map(({ day, total }) => (
                <div key={day} className="h-8 flex items-center gap-2">
                  <div
                    className="h-full bg-purple-500/30 rounded transition-all hover:bg-purple-500/50"
                    style={{ width: `${(total / maxDailyTotal) * 100}%` }}
                    title={`${day}: ${total} calls`}
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
          <div className="mt-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-blue-300">
                <strong>{selectedCell.y} {selectedCell.x}:</strong> {selectedCell.value.toLocaleString()} calls
              </span>
            </div>
          </div>
        )}

        {/* Color legend */}
        <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
          <span>Low</span>
          <div className="flex gap-1">
            <div className="w-6 h-3 rounded bg-gray-800/30" />
            <div className="w-6 h-3 rounded bg-blue-900/40" />
            <div className="w-6 h-3 rounded bg-blue-700/50" />
            <div className="w-6 h-3 rounded bg-blue-600/60" />
            <div className="w-6 h-3 rounded bg-blue-500/70" />
            <div className="w-6 h-3 rounded bg-blue-400/80" />
          </div>
          <span>High</span>
        </div>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-[#131a29] rounded-xl border border-white/[0.08]">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Busiest Day</h4>
          <p className="text-2xl font-semibold text-white">
            {dailyTotals.reduce((max, d) => d.total > max.total ? d : max).day}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {dailyTotals.reduce((max, d) => d.total > max.total ? d : max).total.toLocaleString()} calls
          </p>
        </div>

        <div className="p-4 bg-[#131a29] rounded-xl border border-white/[0.08]">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Peak Hour</h4>
          <p className="text-2xl font-semibold text-white">
            {hourlyTotals.reduce((max, h) => h.total > max.total ? h : max).hour}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {hourlyTotals.reduce((max, h) => h.total > max.total ? h : max).total.toLocaleString()} calls
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
