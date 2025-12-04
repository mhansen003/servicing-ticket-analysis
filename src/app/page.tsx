'use client';

import { useEffect, useState } from 'react';
import {
  Ticket,
  CheckCircle,
  Clock,
  FolderKanban,
  AlertCircle,
  Activity,
  TrendingUp,
  Brain,
  BarChart3,
} from 'lucide-react';
import { StatsCard } from '@/components/StatsCard';
import {
  TimeSeriesChart,
  ProjectStackedBarChart,
  DonutChart,
  AssigneeBarChart,
} from '@/components/Charts';
import { AIAnalysis } from '@/components/AIAnalysis';
import { InsightsPanel } from '@/components/InsightsPanel';
import { DataTable } from '@/components/DataTable';

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

interface DashboardData {
  stats: {
    totalTickets: number;
    completedTickets: number;
    openTickets: number;
    avgResponseTimeMinutes: number;
    avgResolutionTimeMinutes: number;
    completionRate: number;
  };
  ticketsByMonth: { date: string; count: number }[];
  projectBreakdown: {
    project: string;
    total: number;
    completed: number;
    open: number;
    avgResolutionHours: number;
  }[];
  assigneeBreakdown: {
    name: string;
    email: string;
    total: number;
    completed: number;
    avgResolutionHours: number;
  }[];
  statusBreakdown: { name: string; value: number }[];
  priorityBreakdown: { name: string; value: number }[];
  heatmaps?: {
    dayHour: HeatmapData;
    projectStatus: HeatmapData;
  };
  issues?: Issue[];
  trends?: Trends;
}

type TabType = 'overview' | 'insights' | 'data' | 'ai';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/stats');
        if (!response.ok) throw new Error('Failed to fetch data');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError('Failed to load dashboard data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl animate-pulse" />
            <div className="relative animate-spin rounded-full h-12 w-12 border-2 border-blue-500/20 border-t-blue-500"></div>
          </div>
          <p className="mt-6 text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-400">{error || 'Something went wrong'}</p>
        </div>
      </div>
    );
  }

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    return `${Math.round(minutes / 1440)}d`;
  };

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: BarChart3 },
    { id: 'insights' as TabType, label: 'Insights', icon: Brain },
    { id: 'data' as TabType, label: 'Raw Data', icon: FolderKanban },
    { id: 'ai' as TabType, label: 'Ask AI', icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0e17]/80 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Ticket Analytics</h1>
                <p className="text-xs text-gray-500">Servicing Performance Dashboard</p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="hidden md:flex items-center gap-1 bg-[#131a29] rounded-xl p-1 border border-white/[0.08]">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-gray-400">Live</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-white">
                  {data.stats.totalTickets.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">Total Tickets</p>
              </div>
            </div>
          </div>

          {/* Mobile Tab Navigation */}
          <div className="flex md:hidden items-center gap-1 mt-4 bg-[#131a29] rounded-xl p-1 border border-white/[0.08]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards - Always visible */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatsCard
            title="Total Tickets"
            value={data.stats.totalTickets.toLocaleString()}
            icon={Ticket}
            subtitle="All time"
            accentColor="blue"
          />
          <StatsCard
            title="Completed"
            value={data.stats.completedTickets.toLocaleString()}
            icon={CheckCircle}
            trend="up"
            trendValue={`${data.stats.completionRate}% rate`}
            accentColor="green"
          />
          <StatsCard
            title="Open"
            value={data.stats.openTickets.toLocaleString()}
            icon={FolderKanban}
            subtitle="Awaiting resolution"
            accentColor="yellow"
          />
          <StatsCard
            title="Avg Resolution"
            value={formatTime(data.stats.avgResolutionTimeMinutes)}
            icon={Clock}
            subtitle={`Response: ${formatTime(data.stats.avgResponseTimeMinutes)}`}
            accentColor="purple"
          />
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <>
            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <TimeSeriesChart data={data.ticketsByMonth} title="Ticket Volume Over Time" />
              <DonutChart data={data.statusBreakdown} title="Status Distribution" />
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <ProjectStackedBarChart data={data.projectBreakdown} title="Projects Breakdown" />
              <AssigneeBarChart data={data.assigneeBreakdown} title="Top Assignees" />
            </div>

            {/* Bottom Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <DonutChart data={data.priorityBreakdown} title="Priority Levels" />

              {/* Project Performance Table */}
              <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">Project Performance</h3>
                  <TrendingUp className="h-5 w-5 text-gray-500" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Project
                        </th>
                        <th className="text-right py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tickets
                        </th>
                        <th className="text-right py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Avg Time
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.projectBreakdown.slice(0, 8).map((project) => (
                        <tr
                          key={project.project}
                          className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-4 text-sm text-gray-300">
                            {project.project.length > 22
                              ? project.project.substring(0, 22) + '...'
                              : project.project}
                          </td>
                          <td className="py-4 text-right">
                            <span className="text-sm font-medium text-white">
                              {project.total.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-4 text-right">
                            <span className="text-sm text-gray-400">{project.avgResolutionHours}h</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'insights' && data.heatmaps && data.issues && data.trends && (
          <InsightsPanel heatmaps={data.heatmaps} issues={data.issues} trends={data.trends} />
        )}

        {activeTab === 'data' && <DataTable />}

        {activeTab === 'ai' && (
          <div className="space-y-6">
            {/* Prominent AI Header */}
            <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 rounded-2xl p-6 border border-blue-500/20">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">AI-Powered Analysis</h2>
                  <p className="text-gray-400">Get intelligent insights about your ticket data</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#0a0e17]/50 rounded-xl p-4 border border-white/[0.06]">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Analysis Ready</p>
                  <p className="text-lg font-semibold text-white">{data.stats.totalTickets.toLocaleString()} Tickets</p>
                </div>
                <div className="bg-[#0a0e17]/50 rounded-xl p-4 border border-white/[0.06]">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Projects</p>
                  <p className="text-lg font-semibold text-white">{data.projectBreakdown.length} Active</p>
                </div>
                <div className="bg-[#0a0e17]/50 rounded-xl p-4 border border-white/[0.06]">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Insights Found</p>
                  <p className="text-lg font-semibold text-white">{data.issues?.length || 0} Issues</p>
                </div>
              </div>
            </div>
            <AIAnalysis />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-600">Servicing Ticket Analysis Dashboard</p>
            <p className="text-xs text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
