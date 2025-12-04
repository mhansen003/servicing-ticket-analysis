'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Search, Loader2 } from 'lucide-react';

interface Ticket {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  project: string;
  assignee: string;
  created: string;
  category: string;
}

// Extended filter for heatmap drill-down
export interface HeatmapFilter {
  type: 'dayHour' | 'projectStatus';
  x: string;  // For dayHour: hour (e.g., "18:00"), for projectStatus: status
  y: string;  // For dayHour: day (e.g., "Mon"), for projectStatus: project
}

// Filter for issue card drill-down
export interface IssueCardFilter {
  type: 'project' | 'assignee' | 'noResponse';
  value: string;
  category: string;
  metric: string;
}

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  filterType: 'category' | 'project' | 'status' | 'heatmap' | 'issue';
  filterValue: string;
  heatmapFilter?: HeatmapFilter;
  issueFilter?: IssueCardFilter;
}

// Map short day names to day numbers for filtering
const dayNameMap: Record<string, number> = {
  'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
};

// Map truncated project names back to full names
const projectNameMap: Record<string, string> = {
  'Servicing Help': 'Servicing Help',
  'ServApp Support': 'ServApp Support',
  'CMG Servicing O..': 'CMG Servicing Oversight',
  'CMG Servicing Oversight': 'CMG Servicing Oversight',
  'Servicing Escal..': 'Servicing Escalations WG',
  'Servicing Escalations WG': 'Servicing Escalations WG',
};

// Map truncated status names back to full names
const statusNameMap: Record<string, string> = {
  'Request Comp..': 'Request Complete',
  'Request Complete': 'Request Complete',
  'Closed - Mis..': 'Closed - Miscategorized',
  'Closed - Miscategorized': 'Closed - Miscategorized',
  'New': 'New',
  'Assigned': 'Assigned',
  'In Progress': 'In Progress',
  'Reopened': 'Reopened',
  'Closed': 'Closed',
};

export function TicketModal({ isOpen, onClose, title, filterType, filterValue, heatmapFilter, issueFilter }: TicketModalProps) {
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(50);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const BATCH_SIZE = 50;

  // Load tickets from all-tickets.json
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/data/all-tickets.json')
        .then(res => res.json())
        .then(data => {
          setAllTickets(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isOpen]);

  // Reset visible count when filter changes
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
    setSearch('');
  }, [filterValue, heatmapFilter, issueFilter]);

  // Filter tickets based on filter type and search
  const filteredTickets = useMemo(() => {
    let filtered = allTickets;

    // Apply filter based on type
    if (filterType === 'category') {
      filtered = filtered.filter(t => t.category === filterValue);
    } else if (filterType === 'project') {
      filtered = filtered.filter(t => t.project === filterValue);
    } else if (filterType === 'status') {
      filtered = filtered.filter(t => t.status === filterValue);
    } else if (filterType === 'heatmap' && heatmapFilter) {
      if (heatmapFilter.type === 'projectStatus') {
        // Filter by project and status
        const fullProject = projectNameMap[heatmapFilter.y] || heatmapFilter.y;
        const fullStatus = statusNameMap[heatmapFilter.x] || heatmapFilter.x;
        filtered = filtered.filter(t => {
          // Handle truncated project names by checking if either matches or starts with
          const projectMatch = t.project === fullProject ||
            t.project?.toLowerCase().startsWith(fullProject.toLowerCase().replace('..', '').substring(0, 10));
          // Handle truncated status names
          const statusMatch = t.status === fullStatus ||
            t.status?.toLowerCase().startsWith(fullStatus.toLowerCase().replace('..', '').substring(0, 10));
          return projectMatch && statusMatch;
        });
      } else if (heatmapFilter.type === 'dayHour') {
        // Filter by day of week and hour
        const targetDay = dayNameMap[heatmapFilter.y];
        const targetHour = parseInt(heatmapFilter.x.split(':')[0], 10);

        filtered = filtered.filter(t => {
          if (!t.created) return false;
          const createdDate = new Date(t.created);
          const ticketDay = createdDate.getDay();
          const ticketHour = createdDate.getHours();
          return ticketDay === targetDay && ticketHour === targetHour;
        });
      }
    }

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(t =>
        t.title?.toLowerCase().includes(searchLower) ||
        t.key?.toLowerCase().includes(searchLower) ||
        t.assignee?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [allTickets, filterType, filterValue, search, heatmapFilter]);

  // Get visible tickets (progressive loading)
  const visibleTickets = useMemo(() => {
    return filteredTickets.slice(0, visibleCount);
  }, [filteredTickets, visibleCount]);

  const hasMore = visibleCount < filteredTickets.length;

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (!tableContainerRef.current || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current;
    // Load more when scrolled to 80% of content
    if (scrollTop + clientHeight >= scrollHeight * 0.8) {
      setVisibleCount(prev => Math.min(prev + BATCH_SIZE, filteredTickets.length));
    }
  }, [hasMore, filteredTickets.length]);

  // Reset visible count when search changes
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [search]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  const priorityColors: Record<string, string> = {
    Critical: 'bg-red-500/20 text-red-400',
    High: 'bg-orange-500/20 text-orange-400',
    Medium: 'bg-yellow-500/20 text-yellow-400',
    Low: 'bg-green-500/20 text-green-400',
  };

  if (!isOpen) return null;

  // Build a descriptive subtitle based on filter type
  const getFilterDescription = () => {
    if (filterType === 'heatmap' && heatmapFilter) {
      if (heatmapFilter.type === 'projectStatus') {
        const project = projectNameMap[heatmapFilter.y] || heatmapFilter.y;
        const status = statusNameMap[heatmapFilter.x] || heatmapFilter.x;
        return `Project: ${project} • Status: ${status}`;
      } else if (heatmapFilter.type === 'dayHour') {
        return `Created on ${heatmapFilter.y} at ${heatmapFilter.x}`;
      }
    }
    return null;
  };

  const filterDescription = getFilterDescription();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-6xl max-h-[90vh] mx-4 bg-[#131a29] rounded-2xl border border-white/[0.08] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            {filterDescription && (
              <p className="text-sm text-blue-400 mt-0.5">{filterDescription}</p>
            )}
            <p className="text-sm text-gray-400 mt-1">
              {loading ? 'Loading...' : `${filteredTickets.length.toLocaleString()} tickets`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/[0.05] text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-3 border-b border-white/[0.06]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search tickets by title, key, or assignee..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleCount(BATCH_SIZE);
              }}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0a0e17] border border-white/[0.08] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        </div>

        {/* Table */}
        <div
          ref={tableContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto"
        >
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400 mx-auto" />
              <p className="mt-2 text-sm text-gray-400">Loading tickets...</p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-[#0a0e17]/50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Key</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[250px]">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Priority</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Project</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Assignee</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {visibleTickets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                        No tickets found
                      </td>
                    </tr>
                  ) : (
                    visibleTickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-sm font-mono text-blue-400">
                          {ticket.key}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300 max-w-[350px] truncate" title={ticket.title}>
                          {ticket.title}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 text-xs rounded-full bg-white/[0.06] text-gray-300">
                            {ticket.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            priorityColors[ticket.priority] || 'bg-gray-500/20 text-gray-400'
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Load More Indicator at bottom of scroll area */}
              {hasMore && (
                <div className="flex items-center justify-center py-4 border-t border-white/[0.06]">
                  <span className="text-sm text-gray-500">Scroll down to load more...</span>
                </div>
              )}

              {/* End of Data Indicator */}
              {!hasMore && visibleTickets.length > 0 && (
                <div className="flex items-center justify-center py-4 border-t border-white/[0.06]">
                  <span className="text-sm text-gray-500">
                    Showing all {filteredTickets.length.toLocaleString()} tickets
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Scroll Status Bar */}
        {!loading && filteredTickets.length > 0 && (
          <div className="flex items-center justify-between px-6 py-2 border-t border-white/[0.06] bg-[#0a0e17]/50">
            <span className="text-xs text-gray-500">
              Showing {visibleTickets.length.toLocaleString()} of {filteredTickets.length.toLocaleString()} tickets
            </span>
            {hasMore && (
              <span className="text-xs text-gray-500">Scroll down to load more</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
