'use client';

import { useMemo } from 'react';

interface HeatmapCell {
  x: string;
  y: string;
  value: number;
  label?: string;
}

interface HeatmapProps {
  data: HeatmapCell[];
  xLabels: string[];
  yLabels: string[];
  title: string;
  subtitle?: string;
  colorScale?: 'blue' | 'red' | 'green' | 'purple';
  showValues?: boolean;
  valueFormatter?: (value: number) => string;
  // NEW: Context-aware legend descriptions
  legendLowLabel?: string;
  legendHighLabel?: string;
  legendDescription?: string;
  // NEW: Click handler for drill-down
  onCellClick?: (x: string, y: string, value: number) => void;
}

export function Heatmap({
  data,
  xLabels,
  yLabels,
  title,
  subtitle,
  colorScale = 'blue',
  showValues = true,
  valueFormatter = (v) => v.toLocaleString(),
  legendLowLabel = 'Low',
  legendHighLabel = 'High',
  legendDescription,
  onCellClick,
}: HeatmapProps) {
  const { maxValue, minValue, dataMap } = useMemo(() => {
    const values = data.map((d) => d.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const map = new Map<string, HeatmapCell>();
    data.forEach((d) => map.set(`${d.x}-${d.y}`, d));
    return { maxValue: max, minValue: min, dataMap: map };
  }, [data]);

  const getColor = (value: number) => {
    const intensity = maxValue > 0 ? (value - minValue) / (maxValue - minValue) : 0;

    const colorMaps = {
      blue: {
        bg: `rgba(59, 130, 246, ${0.1 + intensity * 0.7})`,
        text: intensity > 0.5 ? 'text-white' : 'text-blue-200',
      },
      red: {
        bg: `rgba(239, 68, 68, ${0.1 + intensity * 0.7})`,
        text: intensity > 0.5 ? 'text-white' : 'text-red-200',
      },
      green: {
        bg: `rgba(34, 197, 94, ${0.1 + intensity * 0.7})`,
        text: intensity > 0.5 ? 'text-white' : 'text-green-200',
      },
      purple: {
        bg: `rgba(139, 92, 246, ${0.1 + intensity * 0.7})`,
        text: intensity > 0.5 ? 'text-white' : 'text-purple-200',
      },
    };

    return colorMaps[colorScale];
  };

  return (
    <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* X-axis labels */}
          <div className="flex mb-2">
            <div className="w-20 flex-shrink-0" />
            {xLabels.map((label) => (
              <div
                key={label}
                className="flex-1 min-w-[50px] text-center text-xs text-gray-500 font-medium"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          {yLabels.map((yLabel) => (
            <div key={yLabel} className="flex mb-1">
              <div className="w-20 flex-shrink-0 flex items-center text-xs text-gray-400 pr-2 truncate">
                {yLabel}
              </div>
              {xLabels.map((xLabel) => {
                const cell = dataMap.get(`${xLabel}-${yLabel}`);
                const value = cell?.value ?? 0;
                const colors = getColor(value);

                return (
                  <div
                    key={`${xLabel}-${yLabel}`}
                    className={`flex-1 min-w-[50px] h-10 mx-0.5 rounded-md flex items-center justify-center transition-all hover:scale-105 group relative ${
                      onCellClick ? 'cursor-pointer hover:ring-2 hover:ring-white/30' : 'cursor-default'
                    }`}
                    style={{ backgroundColor: colors.bg }}
                    onClick={() => onCellClick?.(xLabel, yLabel, value)}
                  >
                    {showValues && value > 0 && (
                      <span className={`text-xs font-medium ${colors.text}`}>
                        {valueFormatter(value)}
                      </span>
                    )}

                    {/* Enhanced Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#1a2332] rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap shadow-xl">
                      <p className="text-xs text-gray-400 mb-1">{yLabel}</p>
                      <p className="text-xs text-gray-500">{xLabel}</p>
                      <p className="text-sm font-semibold text-white mt-1">{valueFormatter(value)} tickets</p>
                      {onCellClick && value > 0 && (
                        <p className="text-xs text-blue-400 mt-1">Click to view details →</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Enhanced Legend */}
      <div className="mt-4 pt-4 border-t border-white/[0.06]">
        {legendDescription && (
          <p className="text-xs text-gray-500 mb-2 text-center">{legendDescription}</p>
        )}
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs text-gray-400 min-w-[80px] text-right">{legendLowLabel}</span>
          <div className="flex gap-0.5">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((intensity) => (
              <div
                key={intensity}
                className="w-8 h-4 rounded-sm"
                style={{
                  backgroundColor:
                    colorScale === 'blue'
                      ? `rgba(59, 130, 246, ${intensity})`
                      : colorScale === 'red'
                      ? `rgba(239, 68, 68, ${intensity})`
                      : colorScale === 'green'
                      ? `rgba(34, 197, 94, ${intensity})`
                      : `rgba(139, 92, 246, ${intensity})`,
                }}
              />
            ))}
          </div>
          <span className="text-xs text-gray-400 min-w-[80px]">{legendHighLabel}</span>
        </div>
        <div className="flex justify-center gap-8 mt-2">
          <span className="text-xs text-gray-600">Min: {valueFormatter(minValue)}</span>
          <span className="text-xs text-gray-600">Max: {valueFormatter(maxValue)}</span>
        </div>
      </div>
    </div>
  );
}

// Specialized issue heatmap with severity indicators
interface IssueCell {
  category: string;
  metric: string;
  value: number;
  severity: 'critical' | 'warning' | 'normal' | 'good';
  description?: string;
}

// Filter info for issue drill-down
export interface IssueFilter {
  type: 'project' | 'assignee' | 'status' | 'noResponse';
  value: string;
  category: string;
  metric: string;
}

interface IssueHeatmapProps {
  data: IssueCell[];
  title: string;
  onCellClick?: (filter: IssueFilter) => void;
}

// Category descriptions to explain what each section means
const categoryDescriptions: Record<string, string> = {
  'Project Health': 'Percentage of tickets that are still OPEN (not resolved) per project',
  'Workload': 'Team members with the most OPEN tickets assigned to them',
  'Response Time': 'OPEN tickets that have been waiting too long without a response',
  'Volume Trend': 'How ticket volume is changing month-over-month',
  'Summary': 'Overall open ticket metrics across all projects',
};

// Format value based on category type for clarity
const formatIssueValue = (category: string, value: number): string => {
  if (category === 'Project Health') {
    return `${value}%`; // These are percentages (open rate)
  } else if (category === 'Volume Trend') {
    return `${value > 0 ? '+' : ''}${value}%`; // Show +/- for trends
  } else {
    return value.toLocaleString(); // Regular numbers for counts
  }
};

// Get a label that explains what the value means
const getValueLabel = (category: string): string => {
  if (category === 'Project Health') return 'still open';
  if (category === 'Workload') return 'open tickets';
  if (category === 'Response Time') return 'waiting';
  if (category === 'Volume Trend') return 'vs last month';
  if (category === 'Summary') return 'open';
  return '';
};

export function IssueHeatmap({ data, title, onCellClick }: IssueHeatmapProps) {
  const severityColors = {
    critical: 'bg-red-500/20 border-red-500/40',
    warning: 'bg-amber-500/20 border-amber-500/40',
    normal: 'bg-blue-500/20 border-blue-500/40',
    good: 'bg-emerald-500/20 border-emerald-500/40',
  };

  const severityLabels = {
    critical: { icon: '🔴', text: 'Critical', color: 'text-red-400' },
    warning: { icon: '🟡', text: 'Warning', color: 'text-amber-400' },
    normal: { icon: '🔵', text: 'Normal', color: 'text-blue-400' },
    good: { icon: '🟢', text: 'Good', color: 'text-emerald-400' },
  };

  const groupedData = useMemo(() => {
    const groups: Record<string, IssueCell[]> = {};
    data.forEach((cell) => {
      if (!groups[cell.category]) groups[cell.category] = [];
      groups[cell.category].push(cell);
    });
    return groups;
  }, [data]);

  return (
    <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <div className="flex items-center gap-4">
          {Object.entries(severityLabels).map(([key, { icon, text, color }]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="text-sm">{icon}</span>
              <span className={`text-xs ${color}`}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedData).map(([category, cells]) => (
          <div key={category}>
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-white">{category}</h4>
              {categoryDescriptions[category] && (
                <p className="text-xs text-gray-500 mt-0.5">{categoryDescriptions[category]}</p>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {cells.map((cell) => {
                // Determine filter type based on category
                const getFilterType = (): IssueFilter['type'] => {
                  if (cell.category === 'Project Health') return 'project';
                  if (cell.category === 'Workload') return 'assignee';
                  if (cell.category === 'Response Time') return 'noResponse';
                  return 'project';
                };

                const handleClick = () => {
                  if (onCellClick && cell.category !== 'Volume Trend' && cell.category !== 'Summary') {
                    onCellClick({
                      type: getFilterType(),
                      value: cell.metric,
                      category: cell.category,
                      metric: cell.metric,
                    });
                  }
                };

                const isClickable = onCellClick && cell.category !== 'Volume Trend' && cell.category !== 'Summary';

                return (
                  <div
                    key={`${cell.category}-${cell.metric}`}
                    onClick={handleClick}
                    className={`p-4 rounded-xl border ${severityColors[cell.severity]} transition-all hover:scale-[1.02] ${
                      isClickable ? 'cursor-pointer hover:ring-2 hover:ring-white/20' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-200 truncate">{cell.metric}</p>
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <p className="text-2xl font-bold text-white">
                            {formatIssueValue(cell.category, cell.value)}
                          </p>
                          {getValueLabel(cell.category) && (
                            <span className="text-xs text-gray-500">{getValueLabel(cell.category)}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-lg flex-shrink-0">{severityLabels[cell.severity].icon}</span>
                    </div>
                    {cell.description && (
                      <p className="text-xs text-gray-400 mt-2 leading-relaxed">{cell.description}</p>
                    )}
                    {isClickable && (
                      <p className="text-xs text-blue-400 mt-2">Click to view tickets →</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
