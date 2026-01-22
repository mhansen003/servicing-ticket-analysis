'use client';

import { useState } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Treemap,
} from 'recharts';
import { TrendingUp, Target, Grid3x3, Layers, Users, ExternalLink } from 'lucide-react';
import { getADOUrl } from './TicketLink';

interface Ticket {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  project: string;
  assignee: string;
  responseTime: number;
  resolutionTime: number;
  category: string;
}

interface AdvancedChartsProps {
  tickets: Ticket[];
  onDrillDown?: (filterType: 'category' | 'project' | 'status', filterValue: string, title: string) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  Critical: '#ef4444',
  High: '#f59e0b',
  Medium: '#3b82f6',
  Low: '#10b981',
};

const STATUS_COLORS: Record<string, string> = {
  'New': '#8b5cf6',
  'Assigned': '#3b82f6',
  'In Progress': '#f59e0b',
  'Request Complete': '#10b981',
  'Closed': '#6b7280',
  'Reopened': '#ef4444',
};

export function AdvancedCharts({ tickets, onDrillDown }: AdvancedChartsProps) {
  const [scatterView, setScatterView] = useState<'priority' | 'status' | 'category'>('priority');

  // Scatter Plot Data: Response Time vs Resolution Time
  const scatterData = tickets
    .filter(t => t.responseTime > 0 && t.resolutionTime > 0)
    .map(t => ({
      x: t.responseTime / 60, // Convert to hours
      y: t.resolutionTime / 60,
      priority: t.priority,
      status: t.status,
      category: t.category,
      project: t.project,
      assignee: t.assignee,
      key: t.key,
      title: t.title,
    }));

  // Bubble Chart Data: Project workload with priority distribution
  const projectBubbles = Object.entries(
    tickets.reduce((acc, t) => {
      if (!acc[t.project]) {
        acc[t.project] = {
          project: t.project,
          total: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          avgResolution: 0,
          totalResolution: 0,
        };
      }
      acc[t.project].total++;
      acc[t.project][t.priority.toLowerCase() as 'critical' | 'high' | 'medium' | 'low']++;
      if (t.resolutionTime > 0) {
        acc[t.project].totalResolution += t.resolutionTime;
      }
      return acc;
    }, {} as Record<string, any>)
  ).map(([project, data]) => ({
    project,
    total: data.total,
    critical: data.critical,
    high: data.high,
    medium: data.medium,
    low: data.low,
    avgResolution: data.totalResolution > 0 ? data.totalResolution / data.total / 60 : 0,
    x: data.total,
    y: data.totalResolution > 0 ? data.totalResolution / data.total / 60 : 0,
    z: data.critical + data.high, // Size by high-priority tickets
  }));

  // Treemap Data: Category distribution (simplified - no nesting)
  const treemapData = Object.entries(
    tickets.reduce((acc, t) => {
      if (!acc[t.category]) {
        acc[t.category] = { name: t.category, value: 0 };
      }
      acc[t.category].value++;
      return acc;
    }, {} as Record<string, any>)
  )
    .map(([_, data]) => data)
    .sort((a, b) => b.value - a.value); // Sort by size for better layout

  // Priority-Status Matrix
  const priorityStatusMatrix = tickets.reduce((acc, t) => {
    const key = `${t.priority}-${t.status}`;
    if (!acc[key]) {
      acc[key] = { priority: t.priority, status: t.status, count: 0 };
    }
    acc[key].count++;
    return acc;
  }, {} as Record<string, any>);

  const matrixData = Object.values(priorityStatusMatrix);

  // Assignee Performance Radar
  const assigneeStats = Object.entries(
    tickets.reduce((acc, t) => {
      if (!acc[t.assignee]) {
        acc[t.assignee] = {
          assignee: t.assignee,
          volume: 0,
          avgResponse: 0,
          avgResolution: 0,
          completionRate: 0,
          totalResponse: 0,
          totalResolution: 0,
          completed: 0,
        };
      }
      acc[t.assignee].volume++;
      if (t.responseTime > 0) acc[t.assignee].totalResponse += t.responseTime;
      if (t.resolutionTime > 0) acc[t.assignee].totalResolution += t.resolutionTime;
      if (t.status === 'Request Complete' || t.status === 'Closed') acc[t.assignee].completed++;
      return acc;
    }, {} as Record<string, any>)
  )
    .map(([assignee, data]) => ({
      assignee,
      volume: data.volume,
      avgResponse: data.totalResponse > 0 ? (data.totalResponse / data.volume / 60).toFixed(1) : 0,
      avgResolution: data.totalResolution > 0 ? (data.totalResolution / data.volume / 60).toFixed(1) : 0,
      completionRate: ((data.completed / data.volume) * 100).toFixed(1),
    }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 8); // Top 8 assignees

  // Normalize radar data for better visualization
  const maxVolume = Math.max(...assigneeStats.map(a => a.volume));
  const maxResponse = Math.max(...assigneeStats.map(a => Number(a.avgResponse)));
  const maxResolution = Math.max(...assigneeStats.map(a => Number(a.avgResolution)));

  const radarData = assigneeStats.map(a => ({
    assignee: a.assignee.split(',')[0], // Last name only
    Volume: ((a.volume / maxVolume) * 100).toFixed(0),
    'Fast Response': maxResponse > 0 ? (100 - (Number(a.avgResponse) / maxResponse) * 100).toFixed(0) : 100,
    'Fast Resolution': maxResolution > 0 ? (100 - (Number(a.avgResolution) / maxResolution) * 100).toFixed(0) : 100,
    'Completion Rate': a.completionRate,
  }));

  const CustomScatterTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#1a1f2e] border border-white/[0.08] rounded-lg p-3 shadow-xl">
          <a
            href={getADOUrl(data.key)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 font-semibold text-sm mb-1 flex items-center gap-1 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {data.key}
            <ExternalLink className="h-3 w-3" />
          </a>
          <p className="text-gray-400 text-xs mb-2 truncate max-w-[200px]">{data.title}</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Response:</span>
              <span className="text-white">{data.x.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Resolution:</span>
              <span className="text-white">{data.y.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Priority:</span>
              <span className={`font-medium`} style={{ color: PRIORITY_COLORS[data.priority] }}>
                {data.priority}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Category:</span>
              <span className="text-white">{data.category}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomTreemapContent = ({ x, y, width, height, name, value, index }: any) => {
    if (width < 50 || height < 35) return null;

    // Color palette for categories
    const colors = [
      '#3b82f6', // blue
      '#10b981', // emerald
      '#f59e0b', // amber
      '#ef4444', // red
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#06b6d4', // cyan
      '#84cc16', // lime
    ];
    const color = colors[index % colors.length];

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: color,
            stroke: '#0a0e17',
            strokeWidth: 2,
            opacity: 0.7,
          }}
          className="cursor-pointer hover:opacity-100 transition-opacity"
          onClick={() => {
            if (onDrillDown) {
              onDrillDown('category', name, `Category: ${name}`);
            }
          }}
        />
        <text
          x={x + width / 2}
          y={y + height / 2 - 8}
          textAnchor="middle"
          fill="#fff"
          fontSize={width < 100 ? 11 : 13}
          fontWeight="600"
        >
          {name.length > 20 ? name.substring(0, 17) + '...' : name}
        </text>
        <text
          x={x + width / 2}
          y={y + height / 2 + 8}
          textAnchor="middle"
          fill="#e5e7eb"
          fontSize={11}
          fontWeight="500"
        >
          {value.toLocaleString()} tickets
        </text>
        <text
          x={x + width / 2}
          y={y + height / 2 + 22}
          textAnchor="middle"
          fill="#d1d5db"
          fontSize={9}
        >
          {((value / tickets.length) * 100).toFixed(1)}%
        </text>
      </g>
    );
  };

  const getScatterColor = (item: any) => {
    switch (scatterView) {
      case 'priority':
        return PRIORITY_COLORS[item.priority] || '#6b7280';
      case 'status':
        return STATUS_COLORS[item.status] || '#6b7280';
      case 'category':
        // Use a hash of category name for consistent colors
        const hash = item.category.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
        return colors[hash % colors.length];
    }
  };

  return (
    <div className="space-y-6">
      {/* Scatter Plot: Response Time vs Resolution Time */}
      <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <TrendingUp className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Performance Scatter Plot</h3>
              <p className="text-sm text-gray-400">Response time vs Resolution time analysis</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setScatterView('priority')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                scatterView === 'priority'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/[0.05] text-gray-400 hover:text-white'
              }`}
            >
              By Priority
            </button>
            <button
              onClick={() => setScatterView('status')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                scatterView === 'status'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/[0.05] text-gray-400 hover:text-white'
              }`}
            >
              By Status
            </button>
            <button
              onClick={() => setScatterView('category')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                scatterView === 'category'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/[0.05] text-gray-400 hover:text-white'
              }`}
            >
              By Category
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              type="number"
              dataKey="x"
              name="Response Time"
              unit="h"
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              label={{ value: 'Response Time (hours)', position: 'insideBottom', offset: -10, fill: '#6b7280' }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Resolution Time"
              unit="h"
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              label={{ value: 'Resolution Time (hours)', angle: -90, position: 'insideLeft', fill: '#6b7280' }}
            />
            <ZAxis range={[50, 200]} />
            <Tooltip content={<CustomScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={scatterData}>
              {scatterData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getScatterColor(entry)} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Faster response & resolution = bottom-left quadrant</span>
          </div>
        </div>
      </div>

      {/* Row: Bubble Chart + Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bubble Chart: Project Workload */}
        <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Target className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Project Workload</h3>
              <p className="text-sm text-gray-400">Volume vs avg resolution time</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                type="number"
                dataKey="x"
                name="Tickets"
                stroke="#6b7280"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                label={{ value: 'Total Tickets', position: 'insideBottom', offset: -10, fill: '#6b7280' }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Avg Resolution"
                unit="h"
                stroke="#6b7280"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                label={{ value: 'Avg Resolution (hours)', angle: -90, position: 'insideLeft', fill: '#6b7280' }}
              />
              <ZAxis type="number" dataKey="z" range={[100, 1000]} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-[#1a1f2e] border border-white/[0.08] rounded-lg p-3 shadow-xl">
                        <p className="text-white font-semibold text-sm mb-2">{data.project}</p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">Total:</span>
                            <span className="text-white">{data.total}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">Avg Resolution:</span>
                            <span className="text-white">{data.avgResolution.toFixed(1)}h</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-red-400">Critical:</span>
                            <span className="text-white">{data.critical}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-orange-400">High:</span>
                            <span className="text-white">{data.high}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
                cursor={{ strokeDasharray: '3 3' }}
              />
              <Scatter
                data={projectBubbles}
                fill="#3b82f6"
                onClick={(data) => {
                  if (onDrillDown) {
                    onDrillDown('project', data.project, `Project: ${data.project}`);
                  }
                }}
                className="cursor-pointer"
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Priority-Status Matrix */}
        <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Grid3x3 className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Priority × Status Matrix</h3>
              <p className="text-sm text-gray-400">Distribution analysis</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {['Critical', 'High', 'Medium', 'Low'].map((priority) => (
              <div key={priority} className="space-y-2">
                <div className="text-xs font-medium text-center" style={{ color: PRIORITY_COLORS[priority] }}>
                  {priority}
                </div>
                {['New', 'In Progress', 'Request Complete'].map((status) => {
                  const cell = matrixData.find(m => m.priority === priority && m.status === status);
                  const count = cell?.count || 0;
                  const maxCount = Math.max(...matrixData.map(m => m.count));
                  const opacity = count > 0 ? 0.3 + (count / maxCount) * 0.7 : 0.1;

                  return (
                    <div
                      key={status}
                      className="relative h-16 rounded-lg flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-500/50 transition-all group"
                      style={{
                        backgroundColor: PRIORITY_COLORS[priority],
                        opacity,
                      }}
                      onClick={() => {
                        if (count > 0 && onDrillDown) {
                          onDrillDown('status', status, `${priority} Priority - ${status}`);
                        }
                      }}
                    >
                      <span className="text-white font-semibold text-sm">{count}</span>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors" />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
            <span>Rows: New → In Progress → Complete</span>
          </div>
        </div>
      </div>

      {/* Row: Treemap + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Treemap: Category Hierarchy */}
        <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Layers className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Category Distribution</h3>
              <p className="text-sm text-gray-400">Visual breakdown by ticket volume</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <Treemap
              data={treemapData}
              dataKey="value"
              stroke="#0a0e17"
              fill="#3b82f6"
              content={<CustomTreemapContent />}
            />
          </ResponsiveContainer>
        </div>

        {/* Radar: Assignee Performance */}
        <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Users className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Top Assignee Performance</h3>
              <p className="text-sm text-gray-400">Multi-metric comparison</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#1f2937" />
              <PolarAngleAxis
                dataKey="assignee"
                stroke="#6b7280"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
              />
              <PolarRadiusAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Radar
                name="Volume"
                dataKey="Volume"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
              />
              <Radar
                name="Fast Response"
                dataKey="Fast Response"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.3}
              />
              <Radar
                name="Completion Rate"
                dataKey="Completion Rate"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.3}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1f2e',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#ffffff',
                }}
                labelStyle={{ color: '#9ca3af' }}
                itemStyle={{ color: '#ffffff' }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
