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
                    className="flex-1 min-w-[50px] h-10 mx-0.5 rounded-md flex items-center justify-center transition-all hover:scale-105 cursor-pointer group relative"
                    style={{ backgroundColor: colors.bg }}
                  >
                    {showValues && value > 0 && (
                      <span className={`text-xs font-medium ${colors.text}`}>
                        {valueFormatter(value)}
                      </span>
                    )}

                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#1a2332] rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                      <p className="text-xs text-gray-400">{xLabel} × {yLabel}</p>
                      <p className="text-sm font-semibold text-white">{valueFormatter(value)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-4">
        <span className="text-xs text-gray-500">Low</span>
        <div className="flex gap-0.5">
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((intensity) => (
            <div
              key={intensity}
              className="w-6 h-3 rounded-sm"
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
        <span className="text-xs text-gray-500">High</span>
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

interface IssueHeatmapProps {
  data: IssueCell[];
  title: string;
}

export function IssueHeatmap({ data, title }: IssueHeatmapProps) {
  const severityColors = {
    critical: 'bg-red-500/80 border-red-500/50',
    warning: 'bg-amber-500/60 border-amber-500/40',
    normal: 'bg-blue-500/40 border-blue-500/30',
    good: 'bg-emerald-500/40 border-emerald-500/30',
  };

  const severityIcons = {
    critical: '🔴',
    warning: '🟡',
    normal: '🔵',
    good: '🟢',
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
        <div className="flex items-center gap-3">
          {Object.entries(severityIcons).map(([key, icon]) => (
            <div key={key} className="flex items-center gap-1">
              <span className="text-sm">{icon}</span>
              <span className="text-xs text-gray-500 capitalize">{key}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {Object.entries(groupedData).map(([category, cells]) => (
          <div key={category}>
            <h4 className="text-sm font-medium text-gray-400 mb-2">{category}</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {cells.map((cell) => (
                <div
                  key={`${cell.category}-${cell.metric}`}
                  className={`p-3 rounded-xl border ${severityColors[cell.severity]} transition-all hover:scale-[1.02]`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-gray-300">{cell.metric}</p>
                      <p className="text-lg font-bold text-white mt-1">
                        {cell.value.toLocaleString()}
                      </p>
                    </div>
                    <span className="text-lg">{severityIcons[cell.severity]}</span>
                  </div>
                  {cell.description && (
                    <p className="text-xs text-gray-400 mt-2">{cell.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
