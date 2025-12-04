'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Layers,
  Table2,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import type { DrillDownFilter } from '@/app/page';

interface Ticket {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  project: string;
  assignee: string;
  created: string;
  responseTime: number | null;
  resolutionTime: number | null;
  complete: boolean;
}

interface FilterOptions {
  statuses: string[];
  projects: string[];
  priorities: string[];
  assignees: string[];
}

interface GroupData {
  name: string;
  count: number;
  completed: number;
  avgResolution: number;
  completionRate: number;
}

type SortField = 'key' | 'title' | 'status' | 'priority' | 'project' | 'assignee' | 'created' | 'resolutionTime';
type ViewMode = 'table' | 'grouped';

interface DataTableProps {
  drillDownFilter?: DrillDownFilter | null;
  onClearDrillDown?: () => void;
}

export function DataTable({ drillDownFilter, onClearDrillDown }: DataTableProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [groupBy, setGroupBy] = useState<string>('project');
  const [groupedData, setGroupedData] = useState<GroupData[]>([]);
  const [groupLoading, setGroupLoading] = useState(false);

  // Filter panel
  const [showFilters, setShowFilters] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Apply drill-down filter when it changes
  useEffect(() => {
    if (drillDownFilter) {
      // Clear existing filters first
      setStatusFilter('');
      setPriorityFilter('');
      setAssigneeFilter('');

      if (drillDownFilter.type === 'project') {
        setProjectFilter(drillDownFilter.value);
        setSearch('');
      } else if (drillDownFilter.type === 'category') {
        // Categories are matched via search on ticket title
        setSearch(drillDownFilter.value);
        setProjectFilter('');
      } else if (drillDownFilter.type === 'search') {
        setSearch(drillDownFilter.value);
        setProjectFilter('');
      } else if (drillDownFilter.type === 'dateRange') {
        // For date range, we'll use the search field with date info
        // The API will need to handle date filtering
        setSearch(drillDownFilter.value);
        setProjectFilter('');
      }

      // Reset to table view and page 1
      setViewMode('table');
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  }, [drillDownFilter]);

  // Fetch tickets
  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search: debouncedSearch,
        status: statusFilter,
        project: projectFilter,
        priority: priorityFilter,
        assignee: assigneeFilter,
        sortField,
        sortOrder,
      });

      const response = await fetch(`/api/tickets?${params}`);
      const data = await response.json();

      setTickets(data.tickets);
      setPagination(prev => ({
        ...prev,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
      }));
      setFilterOptions(data.filterOptions);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, statusFilter, projectFilter, priorityFilter, assigneeFilter, sortField, sortOrder]);

  useEffect(() => {
    if (viewMode === 'table') {
      fetchTickets();
    }
  }, [fetchTickets, viewMode]);

  // Fetch grouped data
  const fetchGroupedData = useCallback(async () => {
    setGroupLoading(true);
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupBy }),
      });
      const data = await response.json();
      setGroupedData(data.groups);
    } catch (error) {
      console.error('Failed to fetch grouped data:', error);
    } finally {
      setGroupLoading(false);
    }
  }, [groupBy]);

  useEffect(() => {
    if (viewMode === 'grouped') {
      fetchGroupedData();
    }
  }, [fetchGroupedData, viewMode]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [debouncedSearch, statusFilter, projectFilter, priorityFilter, assigneeFilter]);

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

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setProjectFilter('');
    setPriorityFilter('');
    setAssigneeFilter('');
  };

  const activeFilterCount = [statusFilter, projectFilter, priorityFilter, assigneeFilter].filter(Boolean).length;

  const formatTime = (minutes: number | null) => {
    if (!minutes) return '-';
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    return `${Math.round(minutes / 1440)}d`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  const priorityColors: Record<string, string> = {
    Critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    High: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    Medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    Low: 'bg-green-500/20 text-green-400 border-green-500/30',
  };

  return (
    <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] overflow-hidden">
      {/* Drill-down banner */}
      {drillDownFilter && (
        <div className="px-4 py-3 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 border-b border-blue-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-blue-500/20">
              <Filter className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <span className="text-sm text-gray-400">Filtered by: </span>
              <span className="text-sm font-medium text-white">{drillDownFilter.label}</span>
            </div>
          </div>
          <button
            onClick={onClearDrillDown}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Overview
          </button>
        </div>
      )}

      {/* Header */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
              <Table2 className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Raw Ticket Data</h3>
              <p className="text-sm text-gray-500">
                {loading ? 'Loading...' : `${pagination.total.toLocaleString()} tickets`}
                {drillDownFilter && ' (filtered)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#0a0e17] rounded-lg p-1 border border-white/[0.08]">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'table'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Table2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'grouped'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Layers className="h-4 w-4" />
              </button>
            </div>

            {viewMode === 'grouped' && (
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="px-3 py-2 bg-[#0a0e17] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
              >
                <option value="project">Group by Project</option>
                <option value="status">Group by Status</option>
                <option value="priority">Group by Priority</option>
                <option value="assignee">Group by Assignee</option>
              </select>
            )}
          </div>
        </div>

        {/* Search and Filter Bar - Only in table mode */}
        {viewMode === 'table' && (
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search tickets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#0a0e17] border border-white/[0.08] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
                showFilters || activeFilterCount > 0
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                  : 'bg-[#0a0e17] border-white/[0.08] text-gray-400 hover:text-white'
              }`}
            >
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2.5 text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>
        )}

        {/* Filter Panel */}
        {viewMode === 'table' && showFilters && filterOptions && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 p-4 bg-[#0a0e17] rounded-xl border border-white/[0.06]">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-[#131a29] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
              >
                <option value="">All Statuses</option>
                {filterOptions.statuses.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Project</label>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full px-3 py-2 bg-[#131a29] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
              >
                <option value="">All Projects</option>
                {filterOptions.projects.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Priority</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-3 py-2 bg-[#131a29] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
              >
                <option value="">All Priorities</option>
                {filterOptions.priorities.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Assignee</label>
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="w-full px-3 py-2 bg-[#131a29] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
              >
                <option value="">All Assignees</option>
                {filterOptions.assignees.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0a0e17]/50">
                <tr>
                  {[
                    { field: 'key' as SortField, label: 'Key', width: 'w-24' },
                    { field: 'title' as SortField, label: 'Title', width: 'min-w-[200px]' },
                    { field: 'status' as SortField, label: 'Status', width: 'w-32' },
                    { field: 'priority' as SortField, label: 'Priority', width: 'w-24' },
                    { field: 'project' as SortField, label: 'Project', width: 'w-40' },
                    { field: 'assignee' as SortField, label: 'Assignee', width: 'w-36' },
                    { field: 'created' as SortField, label: 'Created', width: 'w-28' },
                    { field: 'resolutionTime' as SortField, label: 'Resolution', width: 'w-24' },
                  ].map(col => (
                    <th
                      key={col.field}
                      onClick={() => handleSort(col.field)}
                      className={`${col.width} px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 transition-colors`}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        <SortIcon field={col.field} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-400 mx-auto" />
                      <p className="mt-2 text-sm text-gray-500">Loading tickets...</p>
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      No tickets found matching your filters
                    </td>
                  </tr>
                ) : (
                  tickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-mono text-blue-400">
                        {ticket.key}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300 max-w-[300px] truncate">
                        {ticket.title}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs rounded-full bg-white/[0.06] text-gray-300">
                          {ticket.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full border ${
                          priorityColors[ticket.priority] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400 max-w-[160px] truncate">
                        {ticket.project}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400 max-w-[140px] truncate">
                        {ticket.assignee}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(ticket.created)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatTime(ticket.resolutionTime)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Rows per page:</span>
              <select
                value={pagination.limit}
                onChange={(e) => setPagination(prev => ({ ...prev, limit: parseInt(e.target.value), page: 1 }))}
                className="px-2 py-1 bg-[#0a0e17] border border-white/[0.08] rounded text-sm text-white focus:outline-none"
              >
                {[25, 50, 100, 200].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()}
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="p-1.5 rounded-lg hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-400" />
                </button>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="p-1.5 rounded-lg hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Grouped View */}
      {viewMode === 'grouped' && (
        <div className="p-4">
          {groupLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400 mx-auto" />
              <p className="mt-2 text-sm text-gray-500">Calculating groups...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {groupedData.slice(0, 30).map((group) => (
                <div
                  key={group.name}
                  className="p-4 bg-[#0a0e17] rounded-xl border border-white/[0.06] hover:border-blue-500/30 transition-all cursor-pointer"
                  onClick={() => {
                    if (groupBy === 'project') setProjectFilter(group.name);
                    else if (groupBy === 'status') setStatusFilter(group.name);
                    else if (groupBy === 'priority') setPriorityFilter(group.name);
                    else if (groupBy === 'assignee') setAssigneeFilter(group.name);
                    setViewMode('table');
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{group.name}</p>
                      <p className="text-2xl font-bold text-white mt-1">{group.count.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Completion</p>
                      <p className={`text-sm font-medium ${
                        group.completionRate > 75 ? 'text-green-400' :
                        group.completionRate > 50 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {group.completionRate}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                    <span>{group.completed.toLocaleString()} completed</span>
                    {group.avgResolution > 0 && (
                      <span>~{group.avgResolution}h avg</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
