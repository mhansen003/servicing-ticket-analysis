'use client';

import { useState } from 'react';
import { Sparkles, Send, Loader2, Bot } from 'lucide-react';

const SUGGESTED_PROMPTS = [
  'What are the main bottlenecks?',
  'Which projects need attention?',
  'Analyze workload distribution',
  'Response time patterns',
  'Overall ticket health',
  'Most efficient assignees',
];

export function AIAnalysis() {
  const [prompt, setPrompt] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runAnalysis = async (analysisPrompt: string) => {
    if (!analysisPrompt.trim()) return;

    setLoading(true);
    setError('');
    setAnalysis('');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: analysisPrompt }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (err) {
      setError('Failed to run AI analysis. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runAnalysis(prompt);
  };

  const handleSuggestedPrompt = (suggestedPrompt: string) => {
    setPrompt(suggestedPrompt);
    runAnalysis(suggestedPrompt);
  };

  return (
    <div className="bg-[#131a29] rounded-2xl border border-white/[0.08] p-6 overflow-hidden relative">
      {/* Gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500" />

      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
          <Sparkles className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">AI-Powered Analysis</h3>
          <p className="text-sm text-gray-500">Ask questions about your ticket data</p>
        </div>
      </div>

      {/* Suggested prompts */}
      <div className="mb-5">
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((suggestedPrompt, index) => (
            <button
              key={index}
              onClick={() => handleSuggestedPrompt(suggestedPrompt)}
              disabled={loading}
              className="text-xs px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 rounded-full border border-white/[0.08] transition-all hover:border-blue-500/30 disabled:opacity-50"
            >
              {suggestedPrompt}
            </button>
          ))}
        </div>
      </div>

      {/* Custom prompt input */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask a question about your ticket data..."
            className="flex-1 px-4 py-3 bg-[#0a0e17] border border-white/[0.08] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all hover:shadow-lg hover:shadow-blue-500/20"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Analyze
          </button>
        </div>
      </form>

      {/* Error display */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 mb-4">
          {error}
        </div>
      )}

      {/* Analysis results */}
      {analysis && (
        <div className="p-5 bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-500/10 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">AI Analysis</span>
          </div>
          <div className="prose prose-sm max-w-none prose-invert">
            <div className="whitespace-pre-wrap text-gray-300 leading-relaxed">{analysis}</div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="p-8 flex flex-col items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse" />
            <Loader2 className="h-8 w-8 animate-spin text-blue-400 relative" />
          </div>
          <p className="mt-4 text-gray-400 text-sm">Analyzing your ticket data...</p>
        </div>
      )}
    </div>
  );
}
