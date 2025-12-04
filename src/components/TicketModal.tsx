'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Search, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

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

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  filterType: 'category' | 'project';
  filterValue: string;
}

export function TicketModal({ isOpen, onClose, title, filterType, filterValue }: TicketModalProps) {
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

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

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
    setSearch('');
  }, [filterValue]);

  // Filter tickets based on filter type and search
  const filteredTickets = useMemo(() => {
    let filtered = allTickets;

    // Apply category or project filter
    if (filterType === 'category') {
      filtered = filtered.filter(t => t.category === filterValue);
    } else if (filterType === 'project') {
      filtered = filtered.filter(t => t.project === filterValue);
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
  }, [allTickets, filterType, filterValue, search]);

  // Paginate
  const totalPages = Math.ceil(filteredTickets.length / pageSize);
  const paginatedTickets = filteredTickets.slice((page - 1) * pageSize, page * pageSize);

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
              placeholder="Search tickets..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0a0e17] border border-white/[0.08] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-400">Loading tickets...</div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-[#0a0e17]/50 sticky top-0">
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
                {paginatedTickets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      No tickets found
                    </td>
                  </tr>
                ) : (
                  paginatedTickets.map((ticket) => (
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
          )}
        </div>

        {/* Pagination */}
        {!loading && filteredTickets.length > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-white/[0.06]">
            <span className="text-sm text-gray-500">
              Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, filteredTickets.length)} of {filteredTickets.length.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-5 w-5 text-gray-400" />
              </button>
              <span className="text-sm text-gray-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
