'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  Phone,
  Clock,
  User,
  MessageSquare,
  Calendar,
  Download,
} from 'lucide-react';
import { TranscriptModal } from './TranscriptModal';

interface TranscriptRecord {
  id: string;
  vendorCallKey: string;
  callStart: string;
  callEnd: string;
  durationSeconds: number;
  disposition: string;
  numberOfHolds: number;
  holdDuration: number;
  department: string;
  status: string;
  agentName: string;
  agentRole: string;
  messageCount: number;
  customerMessages: number;
  agentMessages: number;
  detectedTopics: string[];
  basicSentiment: string;
  aiAnalysis: {
    sentiment?: string;
    customerEmotion?: string;
    emotionIntensity?: number;
    resolution?: string;
    topics?: string[];
    agentPerformance?: number;
    summary?: string;
    keyIssue?: string;
    escalationRisk?: string;
  } | null;
  // Analysis object from database
  analysis?: {
    agentSentiment?: string;
    agentSentimentScore?: number;
    agentSentimentReason?: string;
    customerSentiment?: string;
    customerSentimentScore?: number;
    customerSentimentReason?: string;
    aiDiscoveredTopic?: string;
    aiDiscoveredSubcategory?: string;
    topicConfidence?: number;
    keyIssues?: string[];
    resolution?: string;
    tags?: string[];
  } | null;
  // Deep analysis fields (direct properties for backward compat)
  aiDiscoveredTopic?: string;
  aiDiscoveredSubcategory?: string;
  agentSentiment?: string;
  customerSentiment?: string;
}

type SortField = 'callStart' | 'durationSeconds' | 'agentName' | 'department' | 'basicSentiment';

export default function TranscriptDataGrid() {
  const [transcripts, setTranscripts] = useState<TranscriptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [selectedTranscript, setSelectedTranscript] = useState<TranscriptRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  // Date filters - default to last 10 days
  const getDefaultFromDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 10);
    return date.toISOString().split('T')[0];
  };

  const getDefaultToDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const getAllTimeFromDate = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 5);
    return date.toISOString().split('T')[0];
  };

  const [fromDate, setFromDate] = useState<string>(getDefaultFromDate());
  const [toDate, setToDate] = useState<string>(getDefaultToDate());
  const [allTime, setAllTime] = useState(false);

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedFromDate = localStorage.getItem('transcripts-from-date');
      const savedToDate = localStorage.getItem('transcripts-to-date');
      const savedAllTime = localStorage.getItem('transcripts-all-time') === 'true';

      if (savedFromDate) setFromDate(savedFromDate);
      if (savedToDate) setToDate(savedToDate);
      if (savedAllTime !== null) setAllTime(savedAllTime);
    }
  }, []);

  // Persist date filters to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('transcripts-from-date', fromDate);
      localStorage.setItem('transcripts-to-date', toDate);
      localStorage.setItem('transcripts-all-time', String(allTime));
    }
  }, [fromDate, toDate, allTime]);

  // Handle All Time checkbox toggle
  const handleAllTimeToggle = (checked: boolean) => {
    setAllTime(checked);
    if (checked) {
      setFromDate(getAllTimeFromDate());
      setToDate(getDefaultToDate());
    } else {
      setFromDate(getDefaultFromDate());
      setToDate(getDefaultToDate());
    }
  };

  // Sorting
  const [sortField, setSortField] = useState<SortField>('callStart');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Load transcripts from database API with filters
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Build query params
        const params = new URLSearchParams({
          type: 'transcripts',
          limit: '10000', // Load more records to show full dataset
        });

        // Add filters to API request
        if (fromDate) params.append('fromDate', fromDate);
        if (toDate) params.append('toDate', toDate);
        if (sentimentFilter && sentimentFilter !== 'all') params.append('sentiment', sentimentFilter);
        if (departmentFilter && departmentFilter !== 'all') params.append('department', departmentFilter);
        if (searchQuery.trim()) params.append('search', searchQuery);

        const response = await fetch(`/api/transcript-analytics?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to load transcript data');
        const result = await response.json();

        if (result.success && result.data) {
          setTranscripts(result.data);
        } else {
          throw new Error(result.message || 'Failed to load data');
        }
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setLoading(false);
      }
    };

    loadData();
  }, [fromDate, toDate, sentimentFilter, departmentFilter, searchQuery]); // Re-fetch when filters change

  // Get unique departments
  const departments = useMemo(() => {
    const depts = new Set(transcripts.map(t => t.department).filter(d => d && d !== 'NULL'));
    return Array.from(depts).sort();
  }, [transcripts]);

  // Sort transcripts (filtering is now done server-side)
  const filteredTranscripts = useMemo(() => {
    const sorted = [...transcripts];

    // Sort
    sorted.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === 'callStart') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return sorted;
  }, [transcripts, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="h-3 w-3 opacity-30" />;
    return sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 60) {
      const hrs = Math.floor(mins / 60);
      const remainMins = mins % 60;
      return `${hrs}h ${remainMins}m`;
    }
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const sentimentColors: Record<string, string> = {
    positive: 'bg-green-500/20 text-green-400 border-green-500/30',
    negative: 'bg-red-500/20 text-red-400 border-red-500/30',
    neutral: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    mixed: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSentimentFilter('all');
    setDepartmentFilter('all');
    setFromDate(getDefaultFromDate());
    setToDate(getDefaultToDate());
    setAllTime(false);
  };

  const isDefaultDateRange = fromDate === getDefaultFromDate() && toDate === getDefaultToDate();
  const activeFilterCount = (sentimentFilter !== 'all' ? 1 : 0) + (departmentFilter !== 'all' ? 1 : 0) + (!isDefaultDateRange ? 1 : 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        <span className="ml-3 text-gray-400">Loading transcript data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Phone className="h-12 w-12 text-amber-400 mx-auto mb-4" />
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
              <Phone className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Raw Transcript Data</h3>
              <p className="text-sm text-gray-500">
                {loading ? 'Loading...' : `${filteredTranscripts.length.toLocaleString()} of ${transcripts.length.toLocaleString()} calls`}
                {!loading && fromDate && toDate && ` • ${new Date(fromDate).toLocaleDateString()} - ${new Date(toDate).toLocaleDateString()}`}
              </p>
            </div>
          </div>
        </div>

        {/* Date Range Filters - Always Visible */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-[#0a0e17] rounded-xl border border-white/[0.06]">
          {/* All Time Checkbox */}
          <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
            <input
              type="checkbox"
              id="transcriptAllTime"
              checked={allTime}
              onChange={(e) => handleAllTimeToggle(e.target.checked)}
              className="w-4 h-4 accent-red-500 cursor-pointer"
            />
            <label htmlFor="transcriptAllTime" className="text-sm text-red-400 font-medium cursor-pointer">
              All Time (5 years)
            </label>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              disabled={allTime}
              className="w-full px-3 py-2 bg-[#131a29] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              disabled={allTime}
              className="w-full px-3 py-2 bg-[#131a29] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Sentiment</label>
            <select
              value={sentimentFilter}
              onChange={(e) => setSentimentFilter(e.target.value)}
              className="w-full px-3 py-2 bg-[#131a29] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
            >
              <option value="all">All Sentiments</option>
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
              <option value="neutral">Neutral</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-3 py-2 bg-[#131a29] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
            >
              <option value="all">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept.replace('SRVC - ', '').replace('SRVC/', '')}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by agent, department, call key, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0a0e17] border border-white/[0.08] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all"
            >
              <X className="h-4 w-4" />
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#0a0e17]/50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                Call Key
              </th>
              <th
                onClick={() => handleSort('callStart')}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 transition-colors"
              >
                <div className="flex items-center gap-1">
                  Date/Time
                  <SortIcon field="callStart" />
                </div>
              </th>
              <th
                onClick={() => handleSort('agentName')}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 transition-colors"
              >
                <div className="flex items-center gap-1">
                  Agent
                  <SortIcon field="agentName" />
                </div>
              </th>
              <th
                onClick={() => handleSort('department')}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 transition-colors"
              >
                <div className="flex items-center gap-1">
                  Department
                  <SortIcon field="department" />
                </div>
              </th>
              <th
                onClick={() => handleSort('durationSeconds')}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 transition-colors w-24"
              >
                <div className="flex items-center gap-1">
                  Duration
                  <SortIcon field="durationSeconds" />
                </div>
              </th>
              <th
                onClick={() => handleSort('basicSentiment')}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 transition-colors w-28"
              >
                <div className="flex items-center gap-1">
                  Sentiment
                  <SortIcon field="basicSentiment" />
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                Messages
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                AI Topic
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                Agent Sentiment
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                Customer Sentiment
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filteredTranscripts.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                  No transcripts found matching your filters
                </td>
              </tr>
            ) : (
              filteredTranscripts.map((transcript) => (
                <tr
                  key={transcript.id}
                  onClick={() => {
                    setSelectedTranscript(transcript);
                    setIsModalOpen(true);
                  }}
                  className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 text-sm font-mono text-blue-400">
                    {transcript.vendorCallKey}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    <div>{formatDate(transcript.callStart)}</div>
                    <div className="text-xs text-gray-500">{formatTime(transcript.callStart)}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {transcript.agentName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {transcript.department ? transcript.department.replace('SRVC - ', '').replace('SRVC/', '') : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDuration(transcript.durationSeconds)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full border ${
                      sentimentColors[transcript.basicSentiment] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    }`}>
                      {transcript.basicSentiment}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-center">
                    {transcript.messageCount}
                  </td>
                  <td className="px-4 py-3">
                    {transcript.aiDiscoveredTopic ? (
                      <div>
                        <div className="text-sm text-purple-400 font-medium">
                          {transcript.aiDiscoveredTopic}
                        </div>
                        {transcript.aiDiscoveredSubcategory && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {transcript.aiDiscoveredSubcategory}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-600">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {transcript.analysis?.agentSentiment ? (
                      <span
                        className={`px-2 py-0.5 text-xs rounded border ${
                          transcript.analysis.agentSentiment === 'positive'
                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                            : transcript.analysis.agentSentiment === 'negative'
                            ? 'bg-red-500/20 text-red-400 border-red-500/30'
                            : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }`}
                      >
                        {transcript.analysis.agentSentiment[0].toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {transcript.analysis?.customerSentiment ? (
                      <span
                        className={`px-2 py-0.5 text-xs rounded border ${
                          transcript.analysis.customerSentiment === 'positive'
                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                            : transcript.analysis.customerSentiment === 'negative'
                            ? 'bg-red-500/20 text-red-400 border-red-500/30'
                            : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }`}
                      >
                        {transcript.analysis.customerSentiment[0].toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {!loading && filteredTranscripts.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.06] bg-[#0a0e17]/50">
          <span className="text-xs text-gray-500">
            Showing {filteredTranscripts.length.toLocaleString()} of {transcripts.length.toLocaleString()} calls
          </span>
        </div>
      )}

      {/* Call Details Modal */}
      {selectedTranscript && (
        <TranscriptModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedTranscript(null);
          }}
          title={`Call Analysis - ${selectedTranscript.vendorCallKey}`}
          filterType="all"
          filterValue={selectedTranscript.vendorCallKey}
        />
      )}
    </div>
  );
}
