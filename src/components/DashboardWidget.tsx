'use client';

import { useState } from 'react';
import { GripVertical, X, Maximize2, Minimize2 } from 'lucide-react';

/**
 * PHASE 5: Custom Dashboard Framework
 * Reusable widget container with drag handles, expand/collapse, and remove
 */

interface DashboardWidgetProps {
  id: string;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  onRemove?: (id: string) => void;
  draggable?: boolean;
  className?: string;
}

export default function DashboardWidget({
  id,
  title,
  icon,
  children,
  defaultExpanded = true,
  onRemove,
  draggable = false,
  className = '',
}: DashboardWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      className={`bg-[#131a29] rounded-xl border border-white/[0.08] overflow-hidden transition-all ${className}`}
    >
      {/* Widget Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/[0.08] bg-gradient-to-r from-transparent to-white/[0.02]">
        <div className="flex items-center gap-3">
          {draggable && (
            <button className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-400 transition-colors">
              <GripVertical className="h-5 w-5" />
            </button>
          )}
          {icon && <div className="text-blue-400">{icon}</div>}
          <h3 className="font-semibold text-white">{title}</h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors text-gray-400 hover:text-white"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>

          {onRemove && (
            <button
              onClick={() => onRemove(id)}
              className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-gray-400 hover:text-red-400"
              title="Remove widget"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Widget Content */}
      {isExpanded && (
        <div className="p-4">
          {children}
        </div>
      )}
    </div>
  );
}
