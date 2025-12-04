'use client';

import { useState } from 'react';
import { Heatmap, IssueHeatmap } from './Heatmap';
import { TicketModal, HeatmapFilter } from './TicketModal';
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
  MousePointerClick,
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

  // Modal state for drill-down
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [heatmapFilter, setHeatmapFilter] = useState<HeatmapFilter | undefined>();

  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Handle click on day/hour heatmap cell
  const handleDayHourClick = (x: string, y: string, value: number) => {
    if (value === 0) return; // Don't open modal for empty cells
    setModalTitle(`Tickets Created: ${y} at ${x}`);
    setHeatmapFilter({ type: 'dayHour', x, y });
    setModalOpen(true);
  };

  // Handle click on project/status heatmap cell
  const handleProjectStatusClick = (x: string, y: string, value: number) => {
    if (value === 0) return; // Don't open modal for empty cells
    setModalTitle(`${y} - ${x}`);
    setHeatmapFilter({ type: 'projectStatus', x, y });
    setModalOpen(true);
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
                <h3 className="text-lg font-semibold text-white">Ticket Creation Patterns</h3>
                <p className="text-sm text-gray-500">When are tickets being submitted? (Day of Week × Hour)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-400 flex items-center gap-1">
                <MousePointerClick className="h-3 w-3" />
                Click to drill down
              </span>
              {expandedSection === 'timeHeatmap' ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </button>
          {expandedSection === 'timeHeatmap' && (
            <div className="p-4 pt-0">
              <Heatmap
                data={heatmaps.dayHour.data}
                xLabels={heatmaps.dayHour.xLabels}
                yLabels={heatmaps.dayHour.yLabels}
                title=""
                subtitle="Identify peak times for ticket submissions. Darker cells = more tickets created during that time slot."
                colorScale="blue"
                legendLowLabel="Quiet period"
                legendHighLabel="High volume"
                legendDescription="Number of tickets created during each day/hour combination"
                onCellClick={handleDayHourClick}
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
                <h3 className="text-lg font-semibold text-white">Workload Distribution</h3>
                <p className="text-sm text-gray-500">How are tickets distributed across projects and statuses?</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-purple-400 flex items-center gap-1">
                <MousePointerClick className="h-3 w-3" />
                Click to drill down
              </span>
              {expandedSection === 'projectHeatmap' ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </button>
          {expandedSection === 'projectHeatmap' && (
            <div className="p-4 pt-0">
              <Heatmap
                data={heatmaps.projectStatus.data}
                xLabels={heatmaps.projectStatus.xLabels}
                yLabels={heatmaps.projectStatus.yLabels}
                title=""
                subtitle="Compare ticket volumes by project and current status. Darker cells = more tickets in that project/status combination."
                colorScale="purple"
                legendLowLabel="Few tickets"
                legendHighLabel="Many tickets"
                legendDescription="Number of tickets in each project/status combination"
                onCellClick={handleProjectStatusClick}
              />
            </div>
          )}
        </div>
      </div>

      {/* Drill-down Modal */}
      <TicketModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        filterType="heatmap"
        filterValue=""
        heatmapFilter={heatmapFilter}
      />
    </div>
  );
}
