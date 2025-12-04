'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  X,
  Phone,
  Clock,
  User,
  Users,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Search,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';

interface ConversationMessage {
  role: 'agent' | 'customer';
  text: string;
  timestamp: number | null;
}

interface TranscriptRecord {
  id: string;
  vendorCallKey: string;
  callStart: string;
  callEnd: string;
  durationSeconds: number;
  disposition: string;
  numberOfHolds: number;
  holdDuration: number;
  department: string;
  status: string;
  agentName: string;
  agentRole: string;
  agentProfile: string;
  agentEmail: string;
  messageCount: number;
  customerMessages: number;
  agentMessages: number;
  detectedTopics: string[];
  basicSentiment: 'positive' | 'negative' | 'neutral';
  conversation: ConversationMessage[];
  aiAnalysis?: {
    sentiment: string;
    customerEmotion: string;
    emotionIntensity: number;
    resolution: string;
    topics: string[];
    agentPerformance: number;
    summary: string;
    keyIssue: string;
    escalationRisk: string;
  };
}

interface TranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  filterType: 'sentiment' | 'topic' | 'department' | 'agent' | 'all' | 'date';
  filterValue: string;
}

const TOPIC_LABELS: Record<string, string> = {
  payment_inquiry: 'Payment Inquiry',
  escrow: 'Escrow',
  loan_assumption: 'Loan Assumption',
  refinance: 'Refinance',
  account_access: 'Account Access',
  statement_request: 'Statement Request',
  payoff_quote: 'Payoff Quote',
  insurance: 'Insurance',
  property_taxes: 'Property Taxes',
  loan_modification: 'Loan Modification',
  complaint: 'Complaint',
  general_inquiry: 'General Inquiry',
  technical_issue: 'Technical Issue',
  transfer: 'Transfer',
  other: 'Other',
};

export function TranscriptModal({
  isOpen,
  onClose,
  title,
  filterType,
  filterValue,
}: TranscriptModalProps) {
  const [transcripts, setTranscripts] = useState<TranscriptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTranscript, setSelectedTranscript] = useState<TranscriptRecord | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const [conversationCache, setConversationCache] = useState<Record<string, ConversationMessage[]>>({});
  const [loadingConversation, setLoadingConversation] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Load transcript metadata
  useEffect(() => {
    if (!isOpen) return;

    async function loadTranscripts() {
      setLoading(true);
      try {
        const response = await fetch('/data/transcript-analysis.json');
        if (response.ok) {
          const data = await response.json();
          setTranscripts(data);
        }
      } catch (error) {
        console.error('Failed to load transcripts:', error);
      } finally {
        setLoading(false);
      }
    }

    loadTranscripts();
  }, [isOpen]);

  // Load conversation on-demand when a transcript is selected
  useEffect(() => {
    if (!selectedTranscript || selectedTranscript.conversation?.length > 0) return;

    // Check if already cached
    if (conversationCache[selectedTranscript.id]) {
      setSelectedTranscript({
        ...selectedTranscript,
        conversation: conversationCache[selectedTranscript.id],
      });
      return;
    }

    async function loadConversation() {
      setLoadingConversation(true);
      try {
        // Load conversation index to find which chunk contains this ID
        const indexRes = await fetch('/data/transcript-conversations-index.json');
        if (!indexRes.ok) return;
        const index = await indexRes.json();

        // Load all chunks and search for the conversation
        for (let i = 0; i < index.numChunks; i++) {
          const chunkRes = await fetch(`/data/transcript-conversations-${i}.json`);
          if (!chunkRes.ok) continue;
          const chunkData = await chunkRes.json();

          const transcriptId = selectedTranscript?.id;
          if (transcriptId && chunkData[transcriptId]) {
            const conversation = chunkData[transcriptId];
            // Cache for future use
            setConversationCache(prev => ({
              ...prev,
              [transcriptId]: conversation,
            }));
            setSelectedTranscript(prev => prev ? {
              ...prev,
              conversation,
            } : null);
            break;
          }
        }
      } catch (error) {
        console.error('Failed to load conversation:', error);
      } finally {
        setLoadingConversation(false);
      }
    }

    loadConversation();
  }, [selectedTranscript, conversationCache]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTranscript(null);
      setSearchTerm('');
      setVisibleCount(50);
    }
  }, [isOpen, filterType, filterValue]);

  // Filter transcripts based on filter type and search
  const filteredTranscripts = useMemo(() => {
    let filtered = transcripts;

    // Apply main filter
    if (filterValue) {
      filtered = filtered.filter((t) => {
        switch (filterType) {
          case 'sentiment':
            return (t.aiAnalysis?.sentiment || t.basicSentiment) === filterValue;
          case 'topic':
            return (
              t.detectedTopics.includes(filterValue) ||
              t.aiAnalysis?.topics?.includes(filterValue)
            );
          case 'department':
            return t.department === filterValue;
          case 'agent':
            return t.agentName === filterValue;
          case 'all':
            // Filter by date when filterValue looks like a date (YYYY-MM-DD)
            if (filterValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
              return t.callStart?.startsWith(filterValue);
            }
            return true;
          default:
            return true;
        }
      });
    }

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.agentName?.toLowerCase().includes(search) ||
          t.department?.toLowerCase().includes(search) ||
          t.disposition?.toLowerCase().includes(search) ||
          t.conversation.some((msg) => msg.text.toLowerCase().includes(search))
      );
    }

    return filtered;
  }, [transcripts, filterType, filterValue, searchTerm]);

  // Visible transcripts for progressive loading
  const visibleTranscripts = useMemo(() => {
    return filteredTranscripts.slice(0, visibleCount);
  }, [filteredTranscripts, visibleCount]);

  // Handle scroll for progressive loading
  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    if (scrollTop + clientHeight >= scrollHeight * 0.8) {
      setVisibleCount((prev) => Math.min(prev + 50, filteredTranscripts.length));
    }
  }, [filteredTranscripts.length]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <ThumbsUp className="h-4 w-4 text-emerald-400" />;
      case 'negative':
        return <ThumbsDown className="h-4 w-4 text-red-400" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'negative':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-6xl max-h-[90vh] mx-4 bg-[#0f1420] rounded-2xl border border-white/[0.08] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Phone className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              <p className="text-sm text-gray-400">
                {loading ? 'Loading...' : `${filteredTranscripts.length} calls`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-white/[0.08]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search transcripts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#1a1f2e] border border-white/[0.08] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Transcript List */}
          <div
            ref={listRef}
            onScroll={handleScroll}
            className={`${selectedTranscript ? 'w-1/3 border-r border-white/[0.08]' : 'w-full'} overflow-y-auto`}
          >
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500/20 border-t-blue-500" />
              </div>
            ) : visibleTranscripts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                <MessageSquare className="h-8 w-8 mb-2" />
                <p>No transcripts found</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {visibleTranscripts.map((transcript) => {
                  const sentiment = transcript.aiAnalysis?.sentiment || transcript.basicSentiment;
                  return (
                    <button
                      key={transcript.id}
                      onClick={() => setSelectedTranscript(transcript)}
                      className={`w-full p-4 text-left hover:bg-white/[0.02] transition-colors ${
                        selectedTranscript?.id === transcript.id ? 'bg-blue-500/10' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          {getSentimentIcon(sentiment)}
                          <span className="text-sm font-medium text-white">
                            {transcript.agentName || 'Unknown Agent'}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatDuration(transcript.durationSeconds)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                        <span>{transcript.department || 'Unknown Dept'}</span>
                        <span>•</span>
                        <span>{formatDate(transcript.callStart)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(transcript.aiAnalysis?.topics || transcript.detectedTopics)
                          .slice(0, 2)
                          .map((topic) => (
                            <span
                              key={topic}
                              className="px-2 py-0.5 bg-white/[0.05] rounded text-xs text-gray-400"
                            >
                              {TOPIC_LABELS[topic] || topic}
                            </span>
                          ))}
                        <span
                          className={`px-2 py-0.5 rounded text-xs border ${getSentimentColor(sentiment)}`}
                        >
                          {sentiment}
                        </span>
                      </div>
                    </button>
                  );
                })}
                {visibleCount < filteredTranscripts.length && (
                  <div className="p-4 text-center text-sm text-gray-500">
                    Showing {visibleCount} of {filteredTranscripts.length} • Scroll for more
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Transcript Detail */}
          {selectedTranscript && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Detail Header */}
              <div className="p-4 border-b border-white/[0.08] bg-[#131a29]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white">Call Transcript</h3>
                  <button
                    onClick={() => setSelectedTranscript(null)}
                    className="p-1 rounded hover:bg-white/[0.05]"
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                </div>

                {/* Call Metadata */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-400">Agent:</span>
                    <span className="text-white">{selectedTranscript.agentName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-400">Dept:</span>
                    <span className="text-white">{selectedTranscript.department}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-400">Duration:</span>
                    <span className="text-white">
                      {formatDuration(selectedTranscript.durationSeconds)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-400">Messages:</span>
                    <span className="text-white">{selectedTranscript.messageCount}</span>
                  </div>
                </div>

                {/* AI Analysis Summary if available */}
                {selectedTranscript.aiAnalysis && (
                  <div className="mt-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <p className="text-sm text-blue-300 font-medium mb-1">AI Summary</p>
                    <p className="text-sm text-gray-300">
                      {selectedTranscript.aiAnalysis.summary}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs text-gray-400">
                        Emotion: {selectedTranscript.aiAnalysis.customerEmotion}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-400">
                        Resolution: {selectedTranscript.aiAnalysis.resolution}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-400">
                        Risk: {selectedTranscript.aiAnalysis.escalationRisk}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Conversation Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingConversation ? (
                  <div className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500/20 border-t-blue-500" />
                    <span className="ml-3 text-gray-400">Loading conversation...</span>
                  </div>
                ) : !selectedTranscript.conversation || selectedTranscript.conversation.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No conversation data available
                  </div>
                ) : (
                  selectedTranscript.conversation.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'agent' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                          msg.role === 'agent'
                            ? 'bg-blue-500/20 text-blue-100 rounded-br-md'
                            : 'bg-[#1a1f2e] text-gray-200 rounded-bl-md'
                        }`}
                      >
                        <p className="text-xs font-medium mb-1 opacity-60">
                          {msg.role === 'agent' ? 'Agent' : 'Customer'}
                        </p>
                        <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
