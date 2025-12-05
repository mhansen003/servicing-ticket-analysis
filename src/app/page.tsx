'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FolderKanban,
  AlertCircle,
  Activity,
  Brain,
  BarChart3,
  Phone,
  Users,
} from 'lucide-react';
import { AIAnalysis } from '@/components/AIAnalysis';
import { InsightsPanel } from '@/components/InsightsPanel';
import { DataTable } from '@/components/DataTable';
import ServicingAnalysis from '@/components/ServicingAnalysis';
import TranscriptsAnalysis from '@/components/TranscriptsAnalysis';
import AgentsAnalysis from '@/components/AgentsAnalysis';

// Drill-down filter interface for navigating from charts to raw data
export interface DrillDownFilter {
  type: 'category' | 'project' | 'dateRange' | 'search';
  value: string;
  label: string; // Human-readable label for display
  dateStart?: string;
  dateEnd?: string;
}

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

interface ServicingAnalysisData {
  totalTickets: number;
  categories: { name: string; count: number; percent: number }[];
}

interface DashboardData {
  servicingAnalysis?: ServicingAnalysisData;
  heatmaps?: {
    dayHour: HeatmapData;
    projectStatus: HeatmapData;
  };
  issues?: Issue[];
  trends?: Trends;
}

type TabType = 'overview' | 'insights' | 'data' | 'transcripts' | 'agents' | 'ai';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [drillDownFilter, setDrillDownFilter] = useState<DrillDownFilter | null>(null);

  // Handle drill-down from charts - switches to data tab with filter applied
  const handleDrillDown = useCallback((filter: DrillDownFilter) => {
    setDrillDownFilter(filter);
    setActiveTab('data');
  }, []);

  // Clear drill-down filter
  const clearDrillDown = useCallback(() => {
    setDrillDownFilter(null);
  }, []);

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

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: BarChart3 },
    { id: 'insights' as TabType, label: 'Insights', icon: Brain },
    { id: 'data' as TabType, label: 'Raw Data', icon: FolderKanban },
    { id: 'transcripts' as TabType, label: 'Transcripts', icon: Phone },
    { id: 'agents' as TabType, label: 'Agents', icon: Users },
    { id: 'ai' as TabType, label: 'Ask AI', icon: Activity },
  ];

  const servicingTotal = data.servicingAnalysis?.totalTickets || 0;
  const categoriesCount = data.servicingAnalysis?.categories?.length || 0;

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
                <h1 className="text-xl font-bold text-white">Servicing Analytics</h1>
                <p className="text-xs text-gray-500">Ticket Performance Dashboard</p>
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
                  {servicingTotal.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">Servicing Tickets</p>
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
        {/* Tab Content */}
        {activeTab === 'overview' && <ServicingAnalysis onDrillDown={handleDrillDown} />}

        {activeTab === 'insights' && data.heatmaps && data.issues && data.trends && (
          <InsightsPanel heatmaps={data.heatmaps} issues={data.issues} trends={data.trends} />
        )}

        {activeTab === 'data' && (
          <DataTable
            drillDownFilter={drillDownFilter}
            onClearDrillDown={clearDrillDown}
          />
        )}

        {activeTab === 'transcripts' && <TranscriptsAnalysis />}

        {activeTab === 'agents' && <AgentsAnalysis />}

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
                  <p className="text-gray-400">Get intelligent insights about your servicing ticket data</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#0a0e17]/50 rounded-xl p-4 border border-white/[0.06]">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Analysis Ready</p>
                  <p className="text-lg font-semibold text-white">{servicingTotal.toLocaleString()} Tickets</p>
                </div>
                <div className="bg-[#0a0e17]/50 rounded-xl p-4 border border-white/[0.06]">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Categories</p>
                  <p className="text-lg font-semibold text-white">{categoriesCount} Identified</p>
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
