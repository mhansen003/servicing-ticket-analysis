'use client';

import { useEffect, useState } from 'react';
import {
  Ticket,
  CheckCircle,
  Clock,
  TrendingUp,
  Users,
  FolderKanban,
  AlertCircle,
} from 'lucide-react';
import { StatsCard } from '@/components/StatsCard';
import {
  TimeSeriesChart,
  ProjectStackedBarChart,
  DonutChart,
  AssigneeBarChart,
  HorizontalBarChart,
} from '@/components/Charts';
import { AIAnalysis } from '@/components/AIAnalysis';

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
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{error || 'Something went wrong'}</p>
        </div>
      </div>
    );
  }

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    return `${Math.round(minutes / 1440)}d`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Servicing Ticket Analysis</h1>
              <p className="text-sm text-gray-500">Helpdesk performance dashboard</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {data.stats.totalTickets.toLocaleString()} tickets
              </p>
              <p className="text-xs text-gray-500">Last updated: {new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Tickets"
            value={data.stats.totalTickets.toLocaleString()}
            icon={Ticket}
            subtitle="All time"
          />
          <StatsCard
            title="Completed"
            value={data.stats.completedTickets.toLocaleString()}
            icon={CheckCircle}
            trend="up"
            trendValue={`${data.stats.completionRate}% completion rate`}
          />
          <StatsCard
            title="Open Tickets"
            value={data.stats.openTickets.toLocaleString()}
            icon={FolderKanban}
            subtitle="Awaiting resolution"
          />
          <StatsCard
            title="Avg Resolution"
            value={formatTime(data.stats.avgResolutionTimeMinutes)}
            icon={Clock}
            subtitle={`Response: ${formatTime(data.stats.avgResponseTimeMinutes)}`}
          />
        </div>

        {/* AI Analysis Section */}
        <div className="mb-8">
          <AIAnalysis />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <TimeSeriesChart data={data.ticketsByMonth} title="Tickets Over Time" />
          <DonutChart data={data.statusBreakdown} title="Ticket Status Distribution" />
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ProjectStackedBarChart data={data.projectBreakdown} title="Tickets by Project" />
          <AssigneeBarChart data={data.assigneeBreakdown} title="Top Assignees" />
        </div>

        {/* Priority Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <DonutChart data={data.priorityBreakdown} title="Priority Distribution" />

          {/* Quick Stats Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Performance</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 font-medium text-gray-500">Project</th>
                    <th className="text-right py-2 font-medium text-gray-500">Total</th>
                    <th className="text-right py-2 font-medium text-gray-500">Avg Res.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.projectBreakdown.slice(0, 8).map((project) => (
                    <tr key={project.project} className="border-b border-gray-100">
                      <td className="py-2 text-gray-900">
                        {project.project.length > 25
                          ? project.project.substring(0, 25) + '...'
                          : project.project}
                      </td>
                      <td className="py-2 text-right text-gray-600">
                        {project.total.toLocaleString()}
                      </td>
                      <td className="py-2 text-right text-gray-600">{project.avgResolutionHours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            Servicing Ticket Analysis Dashboard | Data from Capacity Helpdesk
          </p>
        </div>
      </footer>
    </div>
  );
}
