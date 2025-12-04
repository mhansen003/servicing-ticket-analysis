'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';

// Modern blue-focused color palette
const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ec4899', '#f43f5e', '#84cc16'];

const tooltipStyle = {
  backgroundColor: '#1a2332',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px',
  padding: '12px 16px',
  boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
};

const tooltipLabelStyle = {
  color: '#9ca3af',
  fontSize: '12px',
  marginBottom: '4px',
};

interface ChartContainerProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function ChartContainer({ title, children, className = '' }: ChartContainerProps) {
  return (
    <div className={`bg-[#131a29] rounded-2xl border border-white/[0.08] p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-6">{title}</h3>
      {children}
    </div>
  );
}

interface TimeSeriesChartProps {
  data: { date: string; count: number }[];
  title: string;
}

export function TimeSeriesChart({ data, title }: TimeSeriesChartProps) {
  return (
    <ChartContainer title={title}>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            tickFormatter={(value) => {
              const [year, month] = value.split('-');
              return `${month}/${year.slice(2)}`;
            }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => value.toLocaleString()}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            formatter={(value: number) => [
              <span key="value" className="text-white font-semibold">{value.toLocaleString()}</span>,
              'Tickets'
            ]}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#3b82f6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorCount)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

interface ProjectChartProps {
  data: {
    project: string;
    total: number;
    completed: number;
    open: number;
  }[];
  title: string;
}

export function ProjectStackedBarChart({ data, title }: ProjectChartProps) {
  const chartData = data.map((d) => ({
    name: d.project.length > 18 ? d.project.substring(0, 18) + '...' : d.project,
    Completed: d.completed,
    Open: d.open,
  }));

  return (
    <ChartContainer title={title}>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={true} vertical={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            width={130}
          />
          <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => <span className="text-gray-400 text-sm">{value}</span>}
          />
          <Bar dataKey="Completed" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Open" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

interface PieChartProps {
  data: { name: string; value: number }[];
  title: string;
}

export function DonutChart({ data, title }: PieChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <ChartContainer title={title}>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={110}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number) => [
              <span key="value" className="text-white font-semibold">
                {value.toLocaleString()} ({((value / total) * 100).toFixed(1)}%)
              </span>,
              '',
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {data.slice(0, 5).map((item, index) => (
          <div key={item.name} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="text-xs text-gray-400">
              {item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name}
            </span>
          </div>
        ))}
      </div>
    </ChartContainer>
  );
}

interface AssigneeChartProps {
  data: {
    name: string;
    total: number;
    completed: number;
    avgResolutionHours: number;
  }[];
  title: string;
}

export function AssigneeBarChart({ data, title }: AssigneeChartProps) {
  const chartData = data.slice(0, 10).map((d) => ({
    name: d.name.split(',')[0] || d.name.split('@')[0] || d.name,
    Total: d.total,
    Completed: d.completed,
  }));

  return (
    <ChartContainer title={title}>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={true} vertical={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            width={80}
          />
          <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => <span className="text-gray-400 text-sm">{value}</span>}
          />
          <Bar dataKey="Total" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={16} />
          <Bar dataKey="Completed" fill="#22c55e" radius={[0, 4, 4, 0]} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

interface BarChartProps {
  data: { name: string; value: number; [key: string]: string | number }[];
  title: string;
  dataKey?: string;
}

export function HorizontalBarChart({ data, title, dataKey = 'value' }: BarChartProps) {
  return (
    <ChartContainer title={title}>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            width={90}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [value.toLocaleString(), 'Tickets']} />
          <Bar dataKey={dataKey} fill="#3b82f6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
