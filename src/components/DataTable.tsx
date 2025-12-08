'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  ChevronDown,
  ChevronUp,
  Filter,
  X,
  Layers,
  Table2,
  Loader2,
  ArrowLeft,
  Plus,
  Minus,
  ChevronRight as ChevronRightIcon,
  Download,
} from 'lucide-react';
// import type { DrillDownFilter } from '@/app/page'; // Removed - no longer using drill-down filters

// DrillDownFilter interface defined locally since this component is deprecated
interface DrillDownFilter {
  type: 'category' | 'project' | 'dateRange' | 'search';
  value: string;
  label: string;
  dateStart?: string;
  dateEnd?: string;
}

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
  children?: GroupData[];
}

interface MultiLevelGroupData {
  key: string;
  values: Record<string, string>;
  count: number;
  completed: number;
  avgResolution: number;
  completionRate: number;
  children?: MultiLevelGroupData[];
  expanded?: boolean;
}

type SortField = 'key' | 'title' | 'status' | 'priority' | 'project' | 'assignee' | 'created' | 'resolutionTime';
type ViewMode = 'table' | 'grouped';
type GroupByField = 'project' | 'status' | 'priority' | 'assignee' | 'category';

interface DataTableProps {
  drillDownFilter?: DrillDownFilter | null;
  onClearDrillDown?: () => void;
}

export function DataTable({ drillDownFilter, onClearDrillDown }: DataTableProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 50;

  // Filters - arrays for multi-select
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState(''); // For drill-down from category charts

  // Multi-select dropdown open states
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [groupByLevels, setGroupByLevels] = useState<GroupByField[]>(['project']);
  const [groupedData, setGroupedData] = useState<MultiLevelGroupData[]>([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

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
      setStatusFilter([]);
      setPriorityFilter([]);
      setAssigneeFilter([]);
      setCategoryFilter('');
      setSearch('');
      setProjectFilter([]);

      if (drillDownFilter.type === 'project') {
        setProjectFilter([drillDownFilter.value]);
      } else if (drillDownFilter.type === 'category') {
        // Use category filter - exact match on the category field in tickets
        setCategoryFilter(drillDownFilter.value);
      } else if (drillDownFilter.type === 'search') {
        setSearch(drillDownFilter.value);
      } else if (drillDownFilter.type === 'dateRange') {
        // For date range, we'll use the search field with date info
        setSearch(drillDownFilter.value);
      }

      // Reset to table view and page 1
      setViewMode('table');
      setPage(1);
      setTickets([]);
      setHasMore(true);
    }
  }, [drillDownFilter]);

  // Fetch tickets (initial load or filter change)
  const fetchTickets = useCallback(async (pageNum: number, append: boolean = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: PAGE_SIZE.toString(),
        search: debouncedSearch,
        status: statusFilter.join(','),
        project: projectFilter.join(','),
        priority: priorityFilter.join(','),
        assignee: assigneeFilter.join(','),
        category: categoryFilter,
        sortField,
        sortOrder,
      });

      const response = await fetch(`/api/tickets?${params}`);
      const data = await response.json();

      if (append) {
        setTickets(prev => [...prev, ...data.tickets]);
      } else {
        setTickets(data.tickets);
      }

      setTotal(data.pagination.total);
      setHasMore(pageNum < data.pagination.totalPages);
      setFilterOptions(data.filterOptions);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [debouncedSearch, statusFilter, projectFilter, priorityFilter, assigneeFilter, categoryFilter, sortField, sortOrder]);

  // Initial load when filters change
  useEffect(() => {
    if (viewMode === 'table') {
      setPage(1);
      setTickets([]);
      setHasMore(true);
      fetchTickets(1, false);
    }
  }, [viewMode, debouncedSearch, statusFilter, projectFilter, priorityFilter, assigneeFilter, categoryFilter, sortField, sortOrder]);

  // Load more when page changes (for infinite scroll)
  useEffect(() => {
    if (viewMode === 'table' && page > 1) {
      fetchTickets(page, true);
    }
  }, [page]);

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (!tableContainerRef.current || loadingMore || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current;
    // Load more when scrolled to 80% of content
    if (scrollTop + clientHeight >= scrollHeight * 0.8) {
      setPage(prev => prev + 1);
    }
  }, [loadingMore, hasMore]);

  // Fetch grouped data with multi-level support
  const fetchGroupedData = useCallback(async () => {
    setGroupLoading(true);
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupByLevels }),
      });
      const data = await response.json();
      setGroupedData(data.groups || []);
      setExpandedGroups(new Set()); // Reset expanded state when grouping changes
    } catch (error) {
      console.error('Failed to fetch grouped data:', error);
    } finally {
      setGroupLoading(false);
    }
  }, [groupByLevels]);

  useEffect(() => {
    if (viewMode === 'grouped') {
      fetchGroupedData();
    }
  }, [fetchGroupedData, viewMode]);


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
    setStatusFilter([]);
    setProjectFilter([]);
    setPriorityFilter([]);
    setAssigneeFilter([]);
    setCategoryFilter('');
  };

  // Count total selected items across all multi-select filters
  const activeFilterCount = statusFilter.length + projectFilter.length + priorityFilter.length + assigneeFilter.length + (categoryFilter ? 1 : 0);

  // Toggle item in multi-select array
  const toggleFilter = (
    current: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string
  ) => {
    if (current.includes(value)) {
      setter(current.filter(v => v !== value));
    } else {
      setter([...current, value]);
    }
  };

  // Multi-select dropdown component
  const MultiSelectDropdown = ({
    label,
    options,
    selected,
    onToggle,
    dropdownKey,
  }: {
    label: string;
    options: string[];
    selected: string[];
    onToggle: (value: string) => void;
    dropdownKey: string;
  }) => {
    const isOpen = openDropdown === dropdownKey;

    return (
      <div className="relative">
        <label className="text-xs text-gray-500 mb-1 block">{label}</label>
        <button
          type="button"
          onClick={() => setOpenDropdown(isOpen ? null : dropdownKey)}
          className="w-full px-3 py-2 bg-[#131a29] border border-white/[0.08] rounded-lg text-sm text-left text-white focus:outline-none focus:border-blue-500/50 flex items-center justify-between"
        >
          <span className="truncate">
            {selected.length === 0 ? `All ${label}s` : `${selected.length} selected`}
          </span>
          <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto bg-[#131a29] border border-white/[0.08] rounded-lg shadow-lg">
            <button
              type="button"
              onClick={() => {
                if (selected.length === options.length) {
                  // Clear all
                  selected.forEach(s => onToggle(s));
                } else {
                  // Select all
                  options.forEach(o => {
                    if (!selected.includes(o)) onToggle(o);
                  });
                }
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-white/[0.05] border-b border-white/[0.06]"
            >
              {selected.length === options.length ? 'Clear All' : 'Select All'}
            </button>
            {options.map(option => (
              <button
                key={option}
                type="button"
                onClick={() => onToggle(option)}
                className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/[0.05] flex items-center gap-2"
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                  selected.includes(option)
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-gray-600'
                }`}>
                  {selected.includes(option) && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="truncate">{option}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

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

  // Export to CSV function
  const exportToCSV = async () => {
    setExporting(true);
    try {
      if (viewMode === 'table') {
        // Export table data - fetch all matching records (up to 10k)
        const params = new URLSearchParams({
          page: '1',
          limit: '10000', // Export up to 10k records
          search: debouncedSearch,
          status: statusFilter.join(','),
          project: projectFilter.join(','),
          priority: priorityFilter.join(','),
          assignee: assigneeFilter.join(','),
          category: categoryFilter,
          sortField,
          sortOrder,
        });

        const response = await fetch(`/api/tickets?${params}`);
        const data = await response.json();

        // Build CSV content
        const headers = ['Key', 'Title', 'Status', 'Priority', 'Project', 'Assignee', 'Created', 'Resolution Time (h)', 'Complete'];
        const rows = data.tickets.map((t: Ticket) => [
          t.key,
          `"${(t.title || '').replace(/"/g, '""')}"`, // Escape quotes in title
          t.status,
          t.priority,
          t.project,
          t.assignee,
          t.created ? new Date(t.created).toLocaleDateString() : '',
          t.resolutionTime ? Math.round(t.resolutionTime / 60) : '',
          t.complete ? 'Yes' : 'No',
        ]);

        const csvContent = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
        downloadCSV(csvContent, `tickets-export-${new Date().toISOString().slice(0, 10)}.csv`);
      } else {
        // Export grouped data
        const headers = [...groupByLevels.map(l => l.charAt(0).toUpperCase() + l.slice(1)), 'Tickets', 'Completed', 'Completion %', 'Avg Resolution (h)'];
        const rows: string[][] = [];

        // Flatten hierarchical data for export
        const flattenGroups = (groups: MultiLevelGroupData[], level: number = 0) => {
          groups.forEach(group => {
            const row: string[] = [];
            groupByLevels.forEach((field, i) => {
              row.push(i === level ? (group.values[field] || '') : (i < level ? '' : ''));
            });
            row.push(group.count.toString());
            row.push(group.completed.toString());
            row.push(`${group.completionRate}%`);
            row.push(group.avgResolution > 0 ? group.avgResolution.toString() : '');
            rows.push(row);

            if (group.children && group.children.length > 0) {
              flattenGroups(group.children as MultiLevelGroupData[], level + 1);
            }
          });
        };

        flattenGroups(groupedData);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        downloadCSV(csvContent, `tickets-grouped-${groupByLevels.join('-')}-${new Date().toISOString().slice(0, 10)}.csv`);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  // Helper to trigger CSV download
  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Toggle group expansion
  const toggleGroupExpansion = (key: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Render grouped rows recursively
  const renderGroupRows = (groups: MultiLevelGroupData[], level: number): React.ReactNode => {
    return groups.map((group) => {
      const isExpanded = expandedGroups.has(group.key);
      const hasChildren = group.children && group.children.length > 0;
      const indentPadding = level * 24;

      return (
        <React.Fragment key={group.key}>
          <tr
            className={`hover:bg-white/[0.02] transition-colors ${hasChildren ? 'cursor-pointer' : ''}`}
            onClick={() => {
              if (hasChildren) {
                toggleGroupExpansion(group.key);
              } else {
                // Apply filters and switch to table view for leaf nodes
                const filters = group.values;
                if (filters.project) setProjectFilter([filters.project]);
                if (filters.status) setStatusFilter([filters.status]);
                if (filters.priority) setPriorityFilter([filters.priority]);
                if (filters.assignee) setAssigneeFilter([filters.assignee]);
                if (filters.category) setCategoryFilter(filters.category);
                setViewMode('table');
              }
            }}
          >
            {/* Render cells for each grouping level */}
            {groupByLevels.map((field, colIndex) => {
              const value = group.values[field] || '';
              const isCurrentLevel = colIndex === level;

              return (
                <td key={field} className="px-4 py-3">
                  {isCurrentLevel ? (
                    <div className="flex items-center gap-2" style={{ paddingLeft: `${indentPadding}px` }}>
                      {hasChildren && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleGroupExpansion(group.key);
                          }}
                          className="p-0.5 rounded hover:bg-white/[0.1] transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      )}
                      {!hasChildren && <span className="w-5" />}
                      <span className="text-sm font-medium text-white truncate max-w-[200px]" title={value}>
                        {value || 'Unknown'}
                      </span>
                    </div>
                  ) : colIndex < level ? (
                    <span className="text-sm text-gray-600">—</span>
                  ) : (
                    <span className="text-sm text-gray-500">—</span>
                  )}
                </td>
              );
            })}
            <td className="px-4 py-3 text-right text-sm font-medium text-white">
              {group.count.toLocaleString()}
            </td>
            <td className="px-4 py-3 text-right text-sm text-gray-400">
              {group.completed.toLocaleString()}
            </td>
            <td className="px-4 py-3 text-right">
              <span className={`text-sm font-medium ${
                group.completionRate > 75 ? 'text-green-400' :
                group.completionRate > 50 ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {group.completionRate}%
              </span>
            </td>
            <td className="px-4 py-3 text-right text-sm text-gray-500">
              {group.avgResolution > 0 ? `${group.avgResolution}h` : '—'}
            </td>
          </tr>
          {/* Render children if expanded */}
          {hasChildren && isExpanded && renderGroupRows(group.children!, level + 1)}
        </React.Fragment>
      );
    });
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
                {loading ? 'Loading...' : `${total.toLocaleString()} tickets`}
                {drillDownFilter && ' (filtered)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export Button */}
            <button
              onClick={exportToCSV}
              disabled={exporting || loading}
              className="flex items-center gap-2 px-3 py-2 bg-[#0a0e17] border border-white/[0.08] rounded-lg text-sm text-gray-400 hover:text-white hover:border-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              title="Export to CSV"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export
            </button>

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
              <div className="flex items-center gap-2 flex-wrap">
                {groupByLevels.map((level, index) => (
                  <div key={index} className="flex items-center gap-1">
                    {index > 0 && <ChevronRightIcon className="h-4 w-4 text-gray-500" />}
                    <select
                      value={level}
                      onChange={(e) => {
                        const newLevels = [...groupByLevels];
                        newLevels[index] = e.target.value as GroupByField;
                        setGroupByLevels(newLevels);
                      }}
                      className="px-3 py-2 bg-[#0a0e17] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                    >
                      <option value="project">Project</option>
                      <option value="status">Status</option>
                      <option value="priority">Priority</option>
                      <option value="assignee">Assignee</option>
                      <option value="category">Category</option>
                    </select>
                    {groupByLevels.length > 1 && (
                      <button
                        onClick={() => {
                          const newLevels = groupByLevels.filter((_, i) => i !== index);
                          setGroupByLevels(newLevels);
                        }}
                        className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                        title="Remove level"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                {groupByLevels.length < 3 && (
                  <button
                    onClick={() => {
                      const availableFields: GroupByField[] = ['project', 'status', 'priority', 'assignee', 'category'];
                      const unusedField = availableFields.find(f => !groupByLevels.includes(f)) || 'status';
                      setGroupByLevels([...groupByLevels, unusedField]);
                    }}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-400 hover:bg-blue-500/20 transition-colors"
                    title="Add grouping level"
                  >
                    <Plus className="h-4 w-4" />
                    Add Level
                  </button>
                )}
              </div>
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
                className="flex items-center gap-1.5 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all"
              >
                <X className="h-4 w-4" />
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Filter Panel - Multi-select dropdowns */}
        {viewMode === 'table' && showFilters && filterOptions && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 p-4 bg-[#0a0e17] rounded-xl border border-white/[0.06]">
            <MultiSelectDropdown
              label="Status"
              options={filterOptions.statuses}
              selected={statusFilter}
              onToggle={(v) => toggleFilter(statusFilter, setStatusFilter, v)}
              dropdownKey="status"
            />
            <MultiSelectDropdown
              label="Project"
              options={filterOptions.projects}
              selected={projectFilter}
              onToggle={(v) => toggleFilter(projectFilter, setProjectFilter, v)}
              dropdownKey="project"
            />
            <MultiSelectDropdown
              label="Priority"
              options={filterOptions.priorities}
              selected={priorityFilter}
              onToggle={(v) => toggleFilter(priorityFilter, setPriorityFilter, v)}
              dropdownKey="priority"
            />
            <MultiSelectDropdown
              label="Assignee"
              options={filterOptions.assignees}
              selected={assigneeFilter}
              onToggle={(v) => toggleFilter(assigneeFilter, setAssigneeFilter, v)}
              dropdownKey="assignee"
            />
          </div>
        )}
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <>
          <div
            ref={tableContainerRef}
            onScroll={handleScroll}
            className="overflow-auto max-h-[600px]"
          >
            <table className="w-full">
              <thead className="bg-[#0a0e17]/50 sticky top-0 z-10">
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

            {/* Load More Indicator */}
            {loadingMore && (
              <div className="flex items-center justify-center py-4 border-t border-white/[0.06]">
                <Loader2 className="h-5 w-5 animate-spin text-blue-400 mr-2" />
                <span className="text-sm text-gray-400">Loading more tickets...</span>
              </div>
            )}

            {/* End of Data Indicator */}
            {!loading && !loadingMore && !hasMore && tickets.length > 0 && (
              <div className="flex items-center justify-center py-4 border-t border-white/[0.06]">
                <span className="text-sm text-gray-500">
                  Showing all {tickets.length.toLocaleString()} of {total.toLocaleString()} tickets
                </span>
              </div>
            )}
          </div>

          {/* Scroll Status Bar */}
          {!loading && tickets.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.06] bg-[#0a0e17]/50">
              <span className="text-xs text-gray-500">
                Loaded {tickets.length.toLocaleString()} of {total.toLocaleString()} tickets
              </span>
              {hasMore && !loadingMore && (
                <span className="text-xs text-gray-500">Scroll down to load more</span>
              )}
            </div>
          )}
        </>
      )}

      {/* Grouped View */}
      {viewMode === 'grouped' && (
        <div className="overflow-x-auto">
          {groupLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400 mx-auto" />
              <p className="mt-2 text-sm text-gray-500">Calculating groups...</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-[#0a0e17]/50">
                <tr>
                  {groupByLevels.map((level, index) => (
                    <th key={level} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {index === 0 ? '' : ''}{level.charAt(0).toUpperCase() + level.slice(1)}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Tickets</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Completed</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Completion %</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Avg Resolution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {groupedData.length === 0 ? (
                  <tr>
                    <td colSpan={groupByLevels.length + 4} className="px-4 py-12 text-center text-gray-500">
                      No data to group
                    </td>
                  </tr>
                ) : (
                  renderGroupRows(groupedData, 0)
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
