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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

interface ChartContainerProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function ChartContainer({ title, children, className = '' }: ChartContainerProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
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
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickFormatter={(value) => {
              const [year, month] = value.split('-');
              return `${month}/${year.slice(2)}`;
            }}
          />
          <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
            formatter={(value: number) => [value.toLocaleString(), 'Tickets']}
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

interface BarChartProps {
  data: { name: string; value: number; [key: string]: string | number }[];
  title: string;
  dataKey?: string;
  layout?: 'horizontal' | 'vertical';
}

export function HorizontalBarChart({ data, title, dataKey = 'value' }: BarChartProps) {
  return (
    <ChartContainer title={title}>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            width={90}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
            formatter={(value: number) => [value.toLocaleString(), 'Tickets']}
          />
          <Bar dataKey={dataKey} fill="#3b82f6" radius={[0, 4, 4, 0]} />
        </BarChart>
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
    name: d.project.length > 20 ? d.project.substring(0, 20) + '...' : d.project,
    Completed: d.completed,
    Open: d.open,
  }));

  return (
    <ChartContainer title={title}>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 120 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} width={110} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
          <Legend />
          <Bar dataKey="Completed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
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
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
            labelLine={false}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
            formatter={(value: number) => [
              `${value.toLocaleString()} (${((value / total) * 100).toFixed(1)}%)`,
              'Tickets',
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
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
        <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} width={70} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
          <Legend />
          <Bar dataKey="Total" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          <Bar dataKey="Completed" fill="#10b981" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
