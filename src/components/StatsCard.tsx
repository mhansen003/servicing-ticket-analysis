'use client';

import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  accentColor?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  accentColor = 'blue',
}: StatsCardProps) {
  const accentColors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-emerald-500 to-emerald-600',
    yellow: 'from-amber-500 to-amber-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600',
  };

  const iconBgColors = {
    blue: 'bg-blue-500/10',
    green: 'bg-emerald-500/10',
    yellow: 'bg-amber-500/10',
    red: 'bg-red-500/10',
    purple: 'bg-purple-500/10',
  };

  const iconColors = {
    blue: 'text-blue-400',
    green: 'text-emerald-400',
    yellow: 'text-amber-400',
    red: 'text-red-400',
    purple: 'text-purple-400',
  };

  const trendColors = {
    up: 'text-emerald-400 bg-emerald-400/10',
    down: 'text-red-400 bg-red-400/10',
    neutral: 'text-gray-400 bg-gray-400/10',
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#131a29] border border-white/[0.08] p-6 card-hover group">
      {/* Subtle gradient glow on hover */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${accentColors[accentColor]} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300`}
      />

      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-400 tracking-wide">{title}</p>
          <p className="mt-3 text-4xl font-bold text-white tracking-tight animate-count">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          )}
          {trend && trendValue && (
            <span
              className={`mt-3 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${trendColors[trend]}`}
            >
              {trend === 'up' && '↑'}
              {trend === 'down' && '↓'}
              {trendValue}
            </span>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconBgColors[accentColor]}`}>
          <Icon className={`h-6 w-6 ${iconColors[accentColor]}`} />
        </div>
      </div>

      {/* Bottom accent line */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r ${accentColors[accentColor]} opacity-50`}
      />
    </div>
  );
}
