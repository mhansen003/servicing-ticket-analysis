'use client';

import { useState } from 'react';
import { Filter, X, Calendar, Users, Tag, TrendingUp, ChevronDown, Check } from 'lucide-react';

/**
 * PHASE 5: Enhanced Filtering UI
 * Multi-select filters with date ranges, categories, agents, and sentiments
 */

export interface FilterOptions {
  categories?: string[];
  subcategories?: string[];
  agents?: string[];
  sentiments?: Array<'positive' | 'negative' | 'neutral'>;
  dateRange?: {
    start: string;
    end: string;
  };
  callDurationRange?: {
    min: number;
    max: number;
  };
}

interface FilterPanelProps {
  availableFilters: {
    categories?: string[];
    subcategories?: string[];
    agents?: string[];
  };
  selectedFilters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  onReset?: () => void;
}

export default function FilterPanel({
  availableFilters,
  selectedFilters,
  onFiltersChange,
  onReset,
}: FilterPanelProps) {
  const [expandedSections, setExpandedSections] = useState<{
    categories: boolean;
    subcategories: boolean;
    agents: boolean;
    sentiment: boolean;
    dateRange: boolean;
    duration: boolean;
  }>({
    categories: true,
    subcategories: false,
    agents: false,
    sentiment: false,
    dateRange: false,
    duration: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleCategory = (category: string) => {
    const current = selectedFilters.categories || [];
    const updated = current.includes(category)
      ? current.filter(c => c !== category)
      : [...current, category];
    onFiltersChange({ ...selectedFilters, categories: updated });
  };

  const toggleSubcategory = (subcategory: string) => {
    const current = selectedFilters.subcategories || [];
    const updated = current.includes(subcategory)
      ? current.filter(s => s !== subcategory)
      : [...current, subcategory];
    onFiltersChange({ ...selectedFilters, subcategories: updated });
  };

  const toggleAgent = (agent: string) => {
    const current = selectedFilters.agents || [];
    const updated = current.includes(agent)
      ? current.filter(a => a !== agent)
      : [...current, agent];
    onFiltersChange({ ...selectedFilters, agents: updated });
  };

  const toggleSentiment = (sentiment: 'positive' | 'negative' | 'neutral') => {
    const current = selectedFilters.sentiments || [];
    const updated = current.includes(sentiment)
      ? current.filter(s => s !== sentiment)
      : [...current, sentiment];
    onFiltersChange({ ...selectedFilters, sentiments: updated });
  };

  const updateDateRange = (field: 'start' | 'end', value: string) => {
    onFiltersChange({
      ...selectedFilters,
      dateRange: {
        ...(selectedFilters.dateRange || { start: '', end: '' }),
        [field]: value,
      },
    });
  };

  const updateDurationRange = (field: 'min' | 'max', value: number) => {
    onFiltersChange({
      ...selectedFilters,
      callDurationRange: {
        ...(selectedFilters.callDurationRange || { min: 0, max: 3600 }),
        [field]: value,
      },
    });
  };

  const getActiveFilterCount = (): number => {
    let count = 0;
    if (selectedFilters.categories?.length) count += selectedFilters.categories.length;
    if (selectedFilters.subcategories?.length) count += selectedFilters.subcategories.length;
    if (selectedFilters.agents?.length) count += selectedFilters.agents.length;
    if (selectedFilters.sentiments?.length) count += selectedFilters.sentiments.length;
    if (selectedFilters.dateRange?.start || selectedFilters.dateRange?.end) count += 1;
    if (selectedFilters.callDurationRange) count += 1;
    return count;
  };

  const activeCount = getActiveFilterCount();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-blue-400" />
          <h3 className="font-semibold text-white">Filters</h3>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
              {activeCount} active
            </span>
          )}
        </div>
        {activeCount > 0 && onReset && (
          <button
            onClick={onReset}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Reset All
          </button>
        )}
      </div>

      {/* Filter Sections */}
      <div className="space-y-2">
        {/* Categories */}
        {availableFilters.categories && availableFilters.categories.length > 0 && (
          <div className="bg-[#131a29] rounded-xl border border-white/[0.08] overflow-hidden">
            <button
              onClick={() => toggleSection('categories')}
              className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-white">Categories</span>
                {(selectedFilters.categories?.length || 0) > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 text-xs">
                    {selectedFilters.categories?.length}
                  </span>
                )}
              </div>
              <ChevronDown
                className={`h-4 w-4 text-gray-400 transition-transform ${
                  expandedSections.categories ? 'rotate-180' : ''
                }`}
              />
            </button>
            {expandedSections.categories && (
              <div className="p-3 pt-0 space-y-1 max-h-64 overflow-y-auto">
                {availableFilters.categories.map(category => (
                  <label
                    key={category}
                    className="flex items-center gap-2 p-2 rounded hover:bg-white/[0.02] cursor-pointer group"
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedFilters.categories?.includes(category)
                          ? 'bg-purple-500 border-purple-500'
                          : 'border-gray-600 group-hover:border-gray-500'
                      }`}
                    >
                      {selectedFilters.categories?.includes(category) && (
                        <Check className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={selectedFilters.categories?.includes(category) || false}
                      onChange={() => toggleCategory(category)}
                    />
                    <span className="text-sm text-gray-300">{category}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Subcategories */}
        {availableFilters.subcategories && availableFilters.subcategories.length > 0 && (
          <div className="bg-[#131a29] rounded-xl border border-white/[0.08] overflow-hidden">
            <button
              onClick={() => toggleSection('subcategories')}
              className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium text-white">Subcategories</span>
                {(selectedFilters.subcategories?.length || 0) > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs">
                    {selectedFilters.subcategories?.length}
                  </span>
                )}
              </div>
              <ChevronDown
                className={`h-4 w-4 text-gray-400 transition-transform ${
                  expandedSections.subcategories ? 'rotate-180' : ''
                }`}
              />
            </button>
            {expandedSections.subcategories && (
              <div className="p-3 pt-0 space-y-1 max-h-64 overflow-y-auto">
                {availableFilters.subcategories.map(subcategory => (
                  <label
                    key={subcategory}
                    className="flex items-center gap-2 p-2 rounded hover:bg-white/[0.02] cursor-pointer group"
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedFilters.subcategories?.includes(subcategory)
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-gray-600 group-hover:border-gray-500'
                      }`}
                    >
                      {selectedFilters.subcategories?.includes(subcategory) && (
                        <Check className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={selectedFilters.subcategories?.includes(subcategory) || false}
                      onChange={() => toggleSubcategory(subcategory)}
                    />
                    <span className="text-sm text-gray-300">{subcategory}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Agents */}
        {availableFilters.agents && availableFilters.agents.length > 0 && (
          <div className="bg-[#131a29] rounded-xl border border-white/[0.08] overflow-hidden">
            <button
              onClick={() => toggleSection('agents')}
              className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-green-400" />
                <span className="text-sm font-medium text-white">Agents</span>
                {(selectedFilters.agents?.length || 0) > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-xs">
                    {selectedFilters.agents?.length}
                  </span>
                )}
              </div>
              <ChevronDown
                className={`h-4 w-4 text-gray-400 transition-transform ${
                  expandedSections.agents ? 'rotate-180' : ''
                }`}
              />
            </button>
            {expandedSections.agents && (
              <div className="p-3 pt-0 space-y-1 max-h-64 overflow-y-auto">
                {availableFilters.agents.map(agent => (
                  <label
                    key={agent}
                    className="flex items-center gap-2 p-2 rounded hover:bg-white/[0.02] cursor-pointer group"
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedFilters.agents?.includes(agent)
                          ? 'bg-green-500 border-green-500'
                          : 'border-gray-600 group-hover:border-gray-500'
                      }`}
                    >
                      {selectedFilters.agents?.includes(agent) && (
                        <Check className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={selectedFilters.agents?.includes(agent) || false}
                      onChange={() => toggleAgent(agent)}
                    />
                    <span className="text-sm text-gray-300">{agent}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sentiment */}
        <div className="bg-[#131a29] rounded-xl border border-white/[0.08] overflow-hidden">
          <button
            onClick={() => toggleSection('sentiment')}
            className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-medium text-white">Sentiment</span>
              {(selectedFilters.sentiments?.length || 0) > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-xs">
                  {selectedFilters.sentiments?.length}
                </span>
              )}
            </div>
            <ChevronDown
              className={`h-4 w-4 text-gray-400 transition-transform ${
                expandedSections.sentiment ? 'rotate-180' : ''
              }`}
            />
          </button>
          {expandedSections.sentiment && (
            <div className="p-3 pt-0 space-y-1">
              {(['positive', 'neutral', 'negative'] as const).map(sentiment => (
                <label
                  key={sentiment}
                  className="flex items-center gap-2 p-2 rounded hover:bg-white/[0.02] cursor-pointer group"
                >
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedFilters.sentiments?.includes(sentiment)
                        ? 'bg-amber-500 border-amber-500'
                        : 'border-gray-600 group-hover:border-gray-500'
                    }`}
                  >
                    {selectedFilters.sentiments?.includes(sentiment) && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={selectedFilters.sentiments?.includes(sentiment) || false}
                    onChange={() => toggleSentiment(sentiment)}
                  />
                  <span className="text-sm text-gray-300 capitalize">{sentiment}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Date Range */}
        <div className="bg-[#131a29] rounded-xl border border-white/[0.08] overflow-hidden">
          <button
            onClick={() => toggleSection('dateRange')}
            className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-pink-400" />
              <span className="text-sm font-medium text-white">Date Range</span>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-gray-400 transition-transform ${
                expandedSections.dateRange ? 'rotate-180' : ''
              }`}
            />
          </button>
          {expandedSections.dateRange && (
            <div className="p-3 pt-0 space-y-2">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Start Date</label>
                <input
                  type="date"
                  value={selectedFilters.dateRange?.start || ''}
                  onChange={(e) => updateDateRange('start', e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0e17] border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-pink-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">End Date</label>
                <input
                  type="date"
                  value={selectedFilters.dateRange?.end || ''}
                  onChange={(e) => updateDateRange('end', e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0e17] border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-pink-500/50"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
