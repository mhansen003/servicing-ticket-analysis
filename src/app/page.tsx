'use client';

import { useState } from 'react';
import {
  FolderKanban,
  AlertCircle,
  Activity,
  Brain,
  Phone,
  Users,
  Tag,
  TrendingUp,
} from 'lucide-react';
import { AIAnalysis } from '@/components/AIAnalysis';
import TranscriptsAnalysis from '@/components/TranscriptsAnalysis';
import TranscriptDataGrid from '@/components/TranscriptDataGrid';
import AgentsAnalysis from '@/components/AgentsAnalysis';
import CategoriesAnalysis from '@/components/CategoriesAnalysis';
import TrendsAnalysis from '@/components/TrendsAnalysis';

type TabType = 'data' | 'transcripts' | 'agents' | 'categories' | 'trends' | 'ai';

export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('transcripts');

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

  if (error) {
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
    { id: 'transcripts' as TabType, label: 'Transcripts', icon: Phone },
    { id: 'categories' as TabType, label: 'Categories', icon: Tag },
    { id: 'trends' as TabType, label: 'Trends', icon: TrendingUp },
    { id: 'agents' as TabType, label: 'Agents', icon: Users },
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
                <h1 className="text-xl font-bold text-white">Transcript Analytics</h1>
                <p className="text-xs text-gray-500">Call Analysis Dashboard</p>
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

            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-gray-400">Live</span>
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
        {activeTab === 'transcripts' && <TranscriptsAnalysis />}

        {activeTab === 'categories' && <CategoriesAnalysis />}

        {activeTab === 'trends' && <TrendsAnalysis />}

        {activeTab === 'data' && <TranscriptDataGrid />}

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
                  <p className="text-gray-400">Get intelligent insights about your transcript data</p>
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
            <p className="text-xs text-gray-600">Transcript Analysis Dashboard</p>
            <p className="text-xs text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
