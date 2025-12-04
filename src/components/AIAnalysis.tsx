'use client';

import { useState } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';

const SUGGESTED_PROMPTS = [
  'What are the main bottlenecks in our ticket resolution process?',
  'Which projects need the most attention right now?',
  'Analyze the workload distribution across team members',
  'What patterns do you see in ticket response times?',
  'Give me a summary of the overall ticket health',
  'Which assignees are most efficient at resolving tickets?',
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-900">AI-Powered Analysis</h3>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Ask questions about your ticket data and get AI-powered insights.
      </p>

      {/* Suggested prompts */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-400 uppercase mb-2">Suggested Questions</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((suggestedPrompt, index) => (
            <button
              key={index}
              onClick={() => handleSuggestedPrompt(suggestedPrompt)}
              disabled={loading}
              className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors disabled:opacity-50"
            >
              {suggestedPrompt.length > 40 ? suggestedPrompt.substring(0, 40) + '...' : suggestedPrompt}
            </button>
          ))}
        </div>
      </div>

      {/* Custom prompt input */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask a question about your ticket data..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Analyze
          </button>
        </div>
      </form>

      {/* Error display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-4">
          {error}
        </div>
      )}

      {/* Analysis results */}
      {analysis && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="prose prose-sm max-w-none">
            <div className="whitespace-pre-wrap text-gray-800">{analysis}</div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="p-8 flex flex-col items-center justify-center text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin mb-2" />
          <p>Analyzing your ticket data...</p>
        </div>
      )}
    </div>
  );
}
