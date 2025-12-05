'use client';

import { useState, useEffect } from 'react';
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { TrendingUp, TrendingDown, Calendar, BarChart3, PieChartIcon, Layers, MousePointer, Sparkles } from 'lucide-react';
import type { DrillDownFilter } from '@/app/page';
import { TicketModal } from './TicketModal';
import { AdvancedCharts } from './AdvancedCharts';

interface ServicingCategory {
  name: string;
  count: number;
  percent: number;
  [key: string]: string | number;
}

interface TimeSeriesData {
  date: string;
  count: number;
}

interface ServicingData {
  totalTickets: number;
  projects: { name: string; count: number }[];
  categories: ServicingCategory[];
  topCategories: ServicingCategory[];
  categoryTrends: { month: string; [key: string]: string | number }[];
  timeSeries: {
    monthly: TimeSeriesData[];
    weekly: TimeSeriesData[];
    daily: TimeSeriesData[];
  };
}

type TimeView = 'daily' | 'weekly' | 'monthly';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// Valid category names (must match prebuild.js categorization)
const VALID_CATEGORIES = [
  'Automated System Messages',
  'Payment Issues',
  'Escrow',
  'Documentation',
  'Transfer/Boarding',
  'Voice/Alert Requests',
  'Account Access',
  'Loan Info Request',
  'Insurance/Coverage',
  'Loan Changes',
  'Complaints/Escalations',
  'General Inquiry',
  'Communication/Forwarded',
  'Loan-Specific Inquiry',
  'Other',
];

interface ServicingAnalysisProps {
  onDrillDown?: (filter: DrillDownFilter) => void;
}

interface Ticket {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  project: string;
  assignee: string;
  responseTime: number;
  resolutionTime: number;
  category: string;
}

export default function ServicingAnalysis({ onDrillDown }: ServicingAnalysisProps) {
  const [data, setData] = useState<ServicingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeView, setTimeView] = useState<TimeView>('weekly');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);

  // Modal state for drill-down
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalFilterType, setModalFilterType] = useState<'category' | 'project' | 'status'>('category');
  const [modalFilterValue, setModalFilterValue] = useState('');

  useEffect(() => {
    // Load stats
    fetch('/api/stats')
      .then((res) => res.json())
      .then((result) => {
        if (result.servicingAnalysis) {
          setData(result.servicingAnalysis);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Load all tickets for advanced charts
    fetch('/data/all-tickets.json')
      .then((res) => res.json())
      .then((tickets) => setAllTickets(tickets))
      .catch((err) => console.error('Failed to load tickets:', err));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading servicing analysis...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">No servicing data available</div>
      </div>
    );
  }

  const getTimeSeriesData = () => {
    switch (timeView) {
      case 'daily':
        return data.timeSeries.daily;
      case 'weekly':
        return data.timeSeries.weekly;
      case 'monthly':
        return data.timeSeries.monthly;
    }
  };

  const formatDate = (date: string) => {
    if (timeView === 'monthly') {
      const [year, month] = date.split('-');
      return `${month}/${year.slice(2)}`;
    }
    if (timeView === 'weekly') {
      const d = new Date(date);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    }
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const timeSeriesData = getTimeSeriesData();

  // Handle category click - open modal with category filter
  const handleCategoryClick = (categoryName: string) => {
    setModalTitle(`Category: ${categoryName}`);
    setModalFilterType('category');
    setModalFilterValue(categoryName);
    setModalOpen(true);
  };

  // Handle advanced chart drill-down
  const handleAdvancedDrillDown = (filterType: 'category' | 'project' | 'status', filterValue: string, title: string) => {
    setModalTitle(title);
    setModalFilterType(filterType);
    setModalFilterValue(filterValue);
    setModalOpen(true);
  };

  // Handle project click - open modal with project filter
  const handleProjectClick = (projectName: string) => {
    setModalTitle(`Project: ${projectName}`);
    setModalFilterType('project');
    setModalFilterValue(projectName);
    setModalOpen(true);
  };

  // Close modal
  const handleCloseModal = () => {
    setModalOpen(false);
  };

  // Calculate trend
  const trend = timeSeriesData.length >= 2
    ? ((timeSeriesData[timeSeriesData.length - 1].count - timeSeriesData[timeSeriesData.length - 2].count) /
        timeSeriesData[timeSeriesData.length - 2].count) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Servicing Tickets</div>
          <div className="text-2xl font-bold text-white mt-1">{data.totalTickets.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">Filtered from 50,714 total</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Top Category</div>
          <div className="text-lg font-bold text-blue-400 mt-1">{data.topCategories[0]?.name}</div>
          <div className="text-xs text-gray-500 mt-1">{data.topCategories[0]?.count.toLocaleString()} tickets ({data.topCategories[0]?.percent}%)</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Categories</div>
          <div className="text-2xl font-bold text-white mt-1">{data.categories.length}</div>
          <div className="text-xs text-gray-500 mt-1">Issue types identified</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-gray-400 text-sm flex items-center gap-1">
            Trend
            {trend >= 0 ? (
              <TrendingUp className="w-4 h-4 text-red-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-green-400" />
            )}
          </div>
          <div className={`text-2xl font-bold mt-1 ${trend >= 0 ? 'text-red-400' : 'text-green-400'}`}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">vs previous {timeView.slice(0, -2)}</div>
        </div>
      </div>

      {/* Time View Selector */}
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-gray-400" />
        <span className="text-gray-400 text-sm">View by:</span>
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {(['daily', 'weekly', 'monthly'] as TimeView[]).map((view) => (
            <button
              key={view}
              onClick={() => setTimeView(view)}
              className={`px-3 py-1 text-sm rounded-md transition ${
                timeView === view
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Volume Over Time */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <h3 className="text-white font-medium mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            Servicing Volume ({timeView})
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={timeSeriesData}>
              <defs>
                <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
                labelFormatter={formatDate}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                fill="url(#colorVolume)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category Distribution */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <h3 className="text-white font-medium mb-4 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-blue-400" />
            Category Distribution
            <span className="ml-auto text-xs text-gray-500 flex items-center gap-1">
              <MousePointer className="w-3 h-3" /> Click to view tickets
            </span>
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data.topCategories}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="count"
                nameKey="name"
                label={({ name, percent }) => `${(name as string)?.split(' ')[0] || ''} ${percent}%`}
                labelLine={false}
                onClick={(entry) => handleCategoryClick(entry.name)}
                style={{ cursor: 'pointer' }}
              >
                {data.topCategories.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
                formatter={(value: number) => [value.toLocaleString(), 'Tickets']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Trends Over Time */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <h3 className="text-white font-medium mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-400" />
          Top 6 Categories - Month Over Month Trends
          <span className="ml-auto text-xs text-gray-500 flex items-center gap-1">
            <MousePointer className="w-3 h-3" /> Click legend to view tickets
          </span>
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.categoryTrends}>
            <XAxis
              dataKey="month"
              tickFormatter={(m) => {
                const [year, month] = m.split('-');
                return `${month}/${year.slice(2)}`;
              }}
              stroke="#6b7280"
              fontSize={12}
            />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#e5e7eb' }}
              itemStyle={{ color: '#e5e7eb' }}
            />
            <Legend
              onClick={(e) => handleCategoryClick(e.value as string)}
              wrapperStyle={{ cursor: 'pointer' }}
            />
            {data.topCategories.map((cat, index) => (
              <Line
                key={cat.name}
                type="monotone"
                dataKey={cat.name}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6, onClick: () => handleCategoryClick(cat.name) }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Category Breakdown Table */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <h3 className="text-white font-medium mb-4 flex items-center gap-2">
          All Categories
          <span className="ml-auto text-xs text-gray-500 flex items-center gap-1">
            <MousePointer className="w-3 h-3" /> Click row to view tickets
          </span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-gray-400 text-sm border-b border-gray-700">
                <th className="text-left py-2 px-4">Category</th>
                <th className="text-right py-2 px-4">Tickets</th>
                <th className="text-right py-2 px-4">%</th>
                <th className="text-left py-2 px-4 w-1/3">Distribution</th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map((cat, index) => (
                <tr
                  key={cat.name}
                  className="border-b border-gray-700/50 hover:bg-gray-700/30 cursor-pointer group"
                  onClick={() => handleCategoryClick(cat.name)}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-white group-hover:text-blue-400 transition-colors">{cat.name}</span>
                    </div>
                  </td>
                  <td className="text-right py-3 px-4 text-white font-medium">
                    {cat.count.toLocaleString()}
                  </td>
                  <td className="text-right py-3 px-4 text-gray-400">{cat.percent}%</td>
                  <td className="py-3 px-4">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${cat.percent}%`,
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Advanced Analytics Section */}
      {allTickets.length > 0 && (
        <div className="space-y-6">
          {/* Section Header */}
          <div className="flex items-center gap-3 pt-4">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Advanced Analytics</h2>
              <p className="text-sm text-gray-400">Deep-dive visualizations for actionable insights</p>
            </div>
          </div>

          {/* Advanced Charts */}
          <AdvancedCharts tickets={allTickets} onDrillDown={handleAdvancedDrillDown} />
        </div>
      )}

      {/* Projects included */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 mt-6">
        <h3 className="text-white font-medium mb-4 flex items-center gap-2">
          Servicing Projects Included
          <span className="ml-auto text-xs text-gray-500 flex items-center gap-1">
            <MousePointer className="w-3 h-3" /> Click to view tickets
          </span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {data.projects.map((project) => (
            <div
              key={project.name}
              className="bg-gray-700/50 rounded-lg p-3 cursor-pointer hover:bg-gray-600/50 hover:border-blue-500/30 border border-transparent transition-all group"
              onClick={() => handleProjectClick(project.name)}
            >
              <div className="text-gray-400 text-sm truncate group-hover:text-blue-400 transition-colors">{project.name}</div>
              <div className="text-white font-medium">{project.count.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Ticket Modal for drill-down */}
      <TicketModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={modalTitle}
        filterType={modalFilterType}
        filterValue={modalFilterValue}
      />
    </div>
  );
}
