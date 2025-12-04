'use client';

import { useState } from 'react';
import { Heatmap, IssueHeatmap } from './Heatmap';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  Calendar,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface HeatmapData {
  data: { x: string; y: string; value: number }[];
  xLabels: string[];
  yLabels: string[];
}

interface Issue {
  category: string;
  metric: string;
  value: number;
  severity: 'critical' | 'warning' | 'normal' | 'good';
  description?: string;
}

interface Trends {
  volumeByDayOfWeek: { day: string; count: number }[];
  peakHours: { hour: string; count: number }[];
  projectsAtRisk: number;
  overloadedAssignees: number;
}

interface InsightsPanelProps {
  heatmaps: {
    dayHour: HeatmapData;
    projectStatus: HeatmapData;
  };
  issues: Issue[];
  trends: Trends;
}

export function InsightsPanel({ heatmaps, issues, trends }: InsightsPanelProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('issues');

  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="space-y-6">
      {/* Alert Summary Banner */}
      {(criticalCount > 0 || warningCount > 0) && (
        <div
          className={`rounded-2xl p-4 border ${
            criticalCount > 0
              ? 'bg-red-500/10 border-red-500/20'
              : 'bg-amber-500/10 border-amber-500/20'
          }`}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle
              className={`h-5 w-5 ${criticalCount > 0 ? 'text-red-400' : 'text-amber-400'}`}
            />
            <div className="flex-1">
              <p className={`font-medium ${criticalCount > 0 ? 'text-red-300' : 'text-amber-300'}`}>
                {criticalCount > 0 ? `${criticalCount} Critical Issues Detected` : `${warningCount} Warnings`}
              </p>
              <p className="text-sm text-gray-400 mt-0.5">
                Review the analysis below for actionable insights
              </p>
            </div>
            <div className="flex gap-2">
              {criticalCount > 0 && (
                <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-300 text-xs font-medium">
                  {criticalCount} Critical
                </span>
              )}
              {warningCount > 0 && (
                <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-medium">
                  {warningCount} Warning
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Insights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#131a29] rounded-xl p-4 border border-white/[0.08]">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Calendar className="h-4 w-4" />
            <span className="text-xs">Busiest Day</span>
          </div>
          <p className="text-xl font-bold text-white">
            {trends.volumeByDayOfWeek.sort((a, b) => b.count - a.count)[0]?.day || 'N/A'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {trends.volumeByDayOfWeek.sort((a, b) => b.count - a.count)[0]?.count.toLocaleString()} tickets
          </p>
        </div>

        <div className="bg-[#131a29] rounded-xl p-4 border border-white/[0.08]">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Clock className="h-4 w-4" />
            <span className="text-xs">Peak Hour</span>
          </div>
          <p className="text-xl font-bold text-white">{trends.peakHours[0]?.hour || 'N/A'}</p>
          <p className="text-xs text-gray-500 mt-1">
            {trends.peakHours[0]?.count.toLocaleString()} tickets
          </p>
        </div>

        <div className="bg-[#131a29] rounded-xl p-4 border border-white/[0.08]">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Zap className="h-4 w-4" />
            <span className="text-xs">Projects at Risk</span>
          </div>
          <p className="text-xl font-bold text-white">{trends.projectsAtRisk}</p>
          <p className="text-xs text-gray-500 mt-1">&gt;50% open rate</p>
        </div>

        <div className="bg-[#131a29] rounded-xl p-4 border border-white/[0.08]">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Users className="h-4 w-4" />
            <span className="text-xs">Overloaded</span>
          </div>
          <p className="text-xl font-bold text-white">{trends.overloadedAssignees}</p>
          <p className="text-xs text-gray-500 mt-1">&gt;500 open tickets</p>
        </div>
      </div>

      {/* Collapsible Sections */}
      <div className="space-y-4">
        {/* Issues Section */}
        <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] overflow-hidden">
          <button
            onClick={() => toggleSection('issues')}
            className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-white">Issue Detection</h3>
                <p className="text-sm text-gray-500">Potential problems requiring attention</p>
              </div>
            </div>
            {expandedSection === 'issues' ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </button>
          {expandedSection === 'issues' && (
            <div className="p-4 pt-0">
              <IssueHeatmap data={issues} title="" />
            </div>
          )}
        </div>

        {/* Time Heatmap Section */}
        <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] overflow-hidden">
          <button
            onClick={() => toggleSection('timeHeatmap')}
            className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Calendar className="h-4 w-4 text-blue-400" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-white">Ticket Volume Heatmap</h3>
                <p className="text-sm text-gray-500">When tickets are created (Day × Hour)</p>
              </div>
            </div>
            {expandedSection === 'timeHeatmap' ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </button>
          {expandedSection === 'timeHeatmap' && (
            <div className="p-4 pt-0">
              <Heatmap
                data={heatmaps.dayHour.data}
                xLabels={heatmaps.dayHour.xLabels}
                yLabels={heatmaps.dayHour.yLabels}
                title=""
                subtitle="Shows ticket creation patterns by day of week and hour"
                colorScale="blue"
              />
            </div>
          )}
        </div>

        {/* Project Status Heatmap Section */}
        <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] overflow-hidden">
          <button
            onClick={() => toggleSection('projectHeatmap')}
            className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <TrendingUp className="h-4 w-4 text-purple-400" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-white">Project × Status Matrix</h3>
                <p className="text-sm text-gray-500">Status distribution across projects</p>
              </div>
            </div>
            {expandedSection === 'projectHeatmap' ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </button>
          {expandedSection === 'projectHeatmap' && (
            <div className="p-4 pt-0">
              <Heatmap
                data={heatmaps.projectStatus.data}
                xLabels={heatmaps.projectStatus.xLabels}
                yLabels={heatmaps.projectStatus.yLabels}
                title=""
                subtitle="Shows how tickets are distributed across statuses per project"
                colorScale="purple"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
