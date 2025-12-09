'use client';

import { useState, useEffect } from 'react';
import { LayoutDashboard, Plus, Settings, Save } from 'lucide-react';
import DashboardWidget from './DashboardWidget';
import CallVolumeHeatmap from './CallVolumeHeatmap';
import CategoryHeatmap from './CategoryHeatmap';

/**
 * PHASE 5: Custom Dashboard Framework
 * Customizable dashboard with add/remove widgets and layout persistence
 */

type WidgetType = 'call-volume-heatmap' | 'category-heatmap' | 'stats-summary' | 'recent-tickets';

interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  position: number;
}

const AVAILABLE_WIDGETS: { type: WidgetType; title: string; description: string }[] = [
  {
    type: 'call-volume-heatmap',
    title: 'Call Volume Heatmap',
    description: 'Ticket volume by day and hour',
  },
  {
    type: 'category-heatmap',
    title: 'Category Heatmap',
    description: 'Category trends over time',
  },
  {
    type: 'stats-summary',
    title: 'Statistics Summary',
    description: 'Key metrics at a glance',
  },
  {
    type: 'recent-tickets',
    title: 'Recent Tickets',
    description: 'Latest ticket activity',
  },
];

export default function CustomDashboard() {
  const [widgets, setWidgets] = useState<Widget[]>([
    { id: 'widget-1', type: 'call-volume-heatmap', title: 'Call Volume Heatmap', position: 0 },
    { id: 'widget-2', type: 'category-heatmap', title: 'Category Heatmap', position: 1 },
  ]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // Load dashboard layout from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dashboard-layout');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setWidgets(parsed);
      } catch (error) {
        console.error('Failed to load dashboard layout:', error);
      }
    }
  }, []);

  // Load stats for summary widgets
  useEffect(() => {
    async function loadStats() {
      try {
        const response = await fetch('/data/processed-stats.json');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to load stats:', error);
      }
    }
    loadStats();
  }, []);

  const saveLayout = () => {
    localStorage.setItem('dashboard-layout', JSON.stringify(widgets));
    // Show a brief success message
    const btn = document.querySelector('[data-save-btn]') as HTMLButtonElement;
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = 'Saved!';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 1500);
    }
  };

  const addWidget = (type: WidgetType) => {
    const widgetInfo = AVAILABLE_WIDGETS.find(w => w.type === type);
    if (!widgetInfo) return;

    const newWidget: Widget = {
      id: `widget-${Date.now()}`,
      type,
      title: widgetInfo.title,
      position: widgets.length,
    };

    setWidgets([...widgets, newWidget]);
    setShowAddMenu(false);
  };

  const removeWidget = (id: string) => {
    setWidgets(widgets.filter(w => w.id !== id));
  };

  const renderWidgetContent = (widget: Widget) => {
    switch (widget.type) {
      case 'call-volume-heatmap':
        return <CallVolumeHeatmap />;

      case 'category-heatmap':
        return <CategoryHeatmap />;

      case 'stats-summary':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <div className="text-3xl font-bold text-blue-400">
                {stats?.stats?.totalTickets?.toLocaleString() || '0'}
              </div>
              <div className="text-sm text-gray-400 mt-1">Total Tickets</div>
            </div>
            <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <div className="text-3xl font-bold text-green-400">
                {stats?.stats?.completedTickets?.toLocaleString() || '0'}
              </div>
              <div className="text-sm text-gray-400 mt-1">Completed</div>
            </div>
            <div className="text-center p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <div className="text-3xl font-bold text-amber-400">
                {stats?.stats?.openTickets?.toLocaleString() || '0'}
              </div>
              <div className="text-sm text-gray-400 mt-1">Open</div>
            </div>
            <div className="text-center p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <div className="text-3xl font-bold text-purple-400">
                {stats?.categorizedAnalytics?.summary?.totalCategories || '0'}
              </div>
              <div className="text-sm text-gray-400 mt-1">Categories</div>
            </div>
          </div>
        );

      case 'recent-tickets':
        return (
          <div className="space-y-2">
            {stats?.ticketSample?.slice(0, 5).map((ticket: any, idx: number) => (
              <div
                key={idx}
                className="p-3 bg-white/[0.02] rounded-lg border border-white/[0.05] hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white truncate">
                      {ticket.ticket_title || 'No title'}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {ticket.project_name} • {ticket.ticket_status}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(ticket.ticket_created_at_utc).toLocaleDateString()}
                  </div>
                </div>
              </div>
            )) || (
              <p className="text-gray-400 text-sm text-center py-4">No recent tickets</p>
            )}
          </div>
        );

      default:
        return <div className="text-gray-400">Widget content not available</div>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 rounded-2xl p-6 border border-blue-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
              <LayoutDashboard className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Custom Dashboard</h2>
              <p className="text-gray-400">Customize your view with drag-and-drop widgets</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={saveLayout}
              data-save-btn
              className="flex items-center gap-2 px-4 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-xl text-green-400 hover:text-green-300 transition-all text-sm"
            >
              <Save className="h-4 w-4" />
              Save Layout
            </button>

            <div className="relative">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-400 hover:text-blue-300 transition-all text-sm"
              >
                <Plus className="h-4 w-4" />
                Add Widget
              </button>

              {showAddMenu && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-[#1a1f2e] rounded-xl border border-white/[0.08] shadow-2xl z-50">
                  <div className="p-2 space-y-1">
                    {AVAILABLE_WIDGETS.map(widget => {
                      const alreadyAdded = widgets.some(w => w.type === widget.type);
                      return (
                        <button
                          key={widget.type}
                          onClick={() => !alreadyAdded && addWidget(widget.type)}
                          disabled={alreadyAdded}
                          className={`w-full text-left p-3 rounded-lg transition-colors ${
                            alreadyAdded
                              ? 'bg-white/[0.02] text-gray-600 cursor-not-allowed'
                              : 'hover:bg-white/[0.05] text-white'
                          }`}
                        >
                          <div className="font-medium text-sm">{widget.title}</div>
                          <div className="text-xs text-gray-400 mt-1">{widget.description}</div>
                          {alreadyAdded && (
                            <div className="text-xs text-gray-500 mt-1">Already added</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Widgets Grid */}
      {widgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-[#131a29] rounded-xl border border-white/[0.08]">
          <LayoutDashboard className="h-12 w-12 text-gray-600 mb-4" />
          <p className="text-gray-400 text-sm">No widgets added yet</p>
          <p className="text-gray-500 text-xs mt-1">Click "Add Widget" to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {widgets
            .sort((a, b) => a.position - b.position)
            .map(widget => (
              <DashboardWidget
                key={widget.id}
                id={widget.id}
                title={widget.title}
                onRemove={removeWidget}
                draggable
                defaultExpanded
              >
                {renderWidgetContent(widget)}
              </DashboardWidget>
            ))}
        </div>
      )}
    </div>
  );
}
