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
  BarChart3,
  FileText,
} from 'lucide-react';
import { CallScorecard } from './CallScorecard';

// Call analysis types
interface CallAnalysis {
  overallScores: {
    customerSatisfaction: number;
    resolutionConfidence: number;
    agentProfessionalism: number;
    empathyConnection: number;
    communicationClarity: number;
    overallCallImpact: number;
  };
  executiveSummary: {
    overview: string;
    reasonForContact: string;
    mainActions: string;
    resolutionOutcome: string;
    emotionalTrajectory: string;
  };
  keyInteractionPoints: string[];
  followUpItems: Array<{
    party: 'Agent' | 'Customer' | 'Back Office';
    action: string;
    context: string;
    deadline: string;
  }>;
  sentimentProgression: {
    customer: {
      start: { tone: string; score: number };
      mid: { tone: string; score: number };
      end: { tone: string; score: number };
    };
    agent: {
      start: { tone: string; score: number };
      mid: { tone: string; score: number };
      end: { tone: string; score: number };
    };
  };
  communicationQuality: {
    customer: {
      clarity: number;
      empathy: number;
      activeListening: number;
      respectfulness: number;
      emotionalRegulation: number;
      responsiveness: number;
    };
    agent: {
      clarity: number;
      empathy: number;
      activeListening: number;
      respectfulness: number;
      emotionalRegulation: number;
      responsiveness: number;
    };
  };
  agentSummary: {
    toneProfessionalism: string;
    problemSolving: string;
    empathyConnection: string;
    deEscalation: string;
    closure: string;
  };
  customerSummary: {
    initialDisposition: string;
    engagementCooperation: string;
    toneEvolution: string;
    satisfactionLevel: string;
  };
  insights: {
    relationalFlow: string;
    conflictRecovery: string;
    psychologicalCommentary: string;
  };
}

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
  // New fields from TranscriptAnalysis table
  analysis?: {
    agentSentiment: string;
    agentSentimentScore: number;
    agentSentimentReason: string;
    customerSentiment: string;
    customerSentimentScore: number;
    customerSentimentReason: string;
    aiDiscoveredTopic: string;
    aiDiscoveredSubcategory: string;
    topicConfidence: number;
    keyIssues: string[];
    resolution: string;
    tags: string[];
  };
}

interface TranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  filterType: 'agentSentiment' | 'customerSentiment' | 'topic' | 'topicNoSubcategory' | 'department' | 'agent' | 'all' | 'date' | 'hour' | 'dayOfWeek';
  filterValue: string;
  startDate?: string;
  endDate?: string;
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

// Sentiment data from AI analysis
interface MessageSentiment {
  score: number;  // -1 to 1
  emotion: string;
}

// Get background color based on sentiment score and message role
function getMessageSentimentStyle(sentiment: number, role: 'agent' | 'customer', emotion?: string): string {
  // System/automated messages (IVR, hold music, etc.) - display in yellow
  if (emotion === 'system') {
    return 'bg-yellow-500/15 text-yellow-200 border-l-2 border-yellow-500/40';
  }

  if (role === 'agent') {
    // Agent messages stay blue-tinted but can shift slightly
    if (sentiment > 0.3) {
      return 'bg-gradient-to-r from-blue-500/20 to-emerald-500/20 text-blue-100';
    } else if (sentiment < -0.3) {
      return 'bg-gradient-to-r from-blue-500/20 to-orange-500/15 text-blue-100';
    }
    return 'bg-blue-500/20 text-blue-100';
  }

  // Customer messages show more dramatic sentiment coloring
  if (sentiment > 0.5) {
    return 'bg-gradient-to-r from-emerald-500/25 to-emerald-500/15 text-emerald-100 border-l-2 border-emerald-500';
  } else if (sentiment > 0.2) {
    return 'bg-gradient-to-r from-emerald-500/15 to-[#1a1f2e] text-gray-200 border-l-2 border-emerald-500/50';
  } else if (sentiment < -0.5) {
    return 'bg-gradient-to-r from-red-500/25 to-red-500/15 text-red-100 border-l-2 border-red-500';
  } else if (sentiment < -0.2) {
    return 'bg-gradient-to-r from-orange-500/20 to-[#1a1f2e] text-gray-200 border-l-2 border-orange-500/50';
  }

  return 'bg-[#1a1f2e] text-gray-200';
}

// Get emotion badge color
function getEmotionBadgeStyle(emotion: string): string {
  const emotionLower = emotion.toLowerCase();
  // System/automated messages
  if (emotionLower === 'system') {
    return 'bg-yellow-500/20 text-yellow-300';
  }
  // Positive emotions (customer & agent)
  if (['grateful', 'satisfied', 'relieved', 'happy', 'pleased', 'helpful', 'empathetic', 'supportive', 'friendly', 'professional', 'reassuring', 'polite', 'patient'].includes(emotionLower)) {
    return 'bg-emerald-500/20 text-emerald-300';
  }
  // Negative emotions (customer & agent)
  if (['frustrated', 'angry', 'annoyed', 'upset', 'furious', 'dismissive', 'impatient', 'rude', 'cold', 'curt'].includes(emotionLower)) {
    return 'bg-red-500/20 text-red-300';
  }
  // Uncertain/worried emotions
  if (['confused', 'uncertain', 'worried', 'concerned', 'hesitant'].includes(emotionLower)) {
    return 'bg-amber-500/20 text-amber-300';
  }
  // Informative/procedural (common for agents)
  if (['informative', 'procedural', 'explanatory', 'clarifying'].includes(emotionLower)) {
    return 'bg-blue-500/20 text-blue-300';
  }
  return 'bg-gray-500/20 text-gray-300';
}

export function TranscriptModal({
  isOpen,
  onClose,
  title,
  filterType,
  filterValue,
  startDate,
  endDate,
}: TranscriptModalProps) {
  const [transcripts, setTranscripts] = useState<TranscriptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTranscript, setSelectedTranscript] = useState<TranscriptRecord | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const [messageSentiments, setMessageSentiments] = useState<MessageSentiment[]>([]);
  const [analyzingSentiment, setAnalyzingSentiment] = useState(false);
  const [sentimentCache, setSentimentCache] = useState<Record<string, MessageSentiment[]>>({});
  const [callAnalysis, setCallAnalysis] = useState<CallAnalysis | null>(null);
  const [analyzingCall, setAnalyzingCall] = useState(false);
  const [callAnalysisCache, setCallAnalysisCache] = useState<Record<string, CallAnalysis>>({});
  const [callAnalysisError, setCallAnalysisError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const callAnalysisAbortRef = useRef<AbortController | null>(null);
  const sentimentAbortRef = useRef<AbortController | null>(null);
  const messageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Load transcript metadata
  useEffect(() => {
    if (!isOpen) return;

    async function loadTranscripts() {
      setLoading(true);
      setLoadError(null); // Clear any previous errors
      try {
        // Try to load from new API endpoint first
        // Use reasonable limit to avoid exceeding database response size (67MB limit)
        // Modal shows 50 at a time with progressive loading on scroll
        let apiParams = `limit=1000&offset=0`;

        // Add filter params based on filterType
        // Note: 'hour', 'dayOfWeek' filters are not supported by the API
        // and will be handled by client-side filtering in the filteredTranscripts useMemo
        if (filterValue) {
          switch (filterType) {
            case 'date':
              apiParams += `&date=${filterValue}`;
              break;
            case 'department':
              apiParams += `&department=${encodeURIComponent(filterValue)}`;
              break;
            case 'agent':
              apiParams += `&agent=${encodeURIComponent(filterValue)}`;
              break;
            case 'agentSentiment':
              apiParams += `&agentSentiment=${filterValue}`;
              break;
            case 'customerSentiment':
              apiParams += `&customerSentiment=${filterValue}`;
              break;
            case 'topic':
              apiParams += `&topic=${encodeURIComponent(filterValue)}`;
              break;
            case 'hour':
            case 'dayOfWeek':
              // These filters will be applied client-side after loading all transcripts
              break;
            case 'all':
              // Text search - pass to API
              apiParams += `&search=${encodeURIComponent(filterValue)}`;
              break;
          }
        }

        // Add global date range filter if provided
        if (startDate && endDate) {
          apiParams += `&startDate=${startDate}&endDate=${endDate}`;
        }

        const apiResponse = await fetch(`/api/transcript-analytics?type=transcripts&${apiParams}`);
        if (!apiResponse.ok) {
          const errorText = await apiResponse.text();
          console.error('API returned error:', apiResponse.status, errorText);
          setLoadError(`Failed to load transcripts: ${apiResponse.status} ${apiResponse.statusText}`);
          return;
        }

        const apiData = await apiResponse.json();
        if (apiData.success && apiData.data) {
          setTranscripts(apiData.data);
        } else {
          console.error('API returned unexpected format:', apiData);
          setLoadError('Failed to load transcripts: Invalid response format');
        }
      } catch (error) {
        console.error('Failed to load transcripts:', error);
        setLoadError(`Failed to load transcripts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    }

    loadTranscripts();
  }, [isOpen, filterType, filterValue, startDate, endDate]);

  // Conversations are now loaded directly from the API with the transcript data
  // No need for separate conversation loading

  // Analyze sentiment when conversation is loaded
  useEffect(() => {
    if (!selectedTranscript?.conversation?.length) {
      setMessageSentiments([]);
      return;
    }

    const transcriptId = selectedTranscript.id;

    // Check cache first
    if (sentimentCache[transcriptId]) {
      setMessageSentiments(sentimentCache[transcriptId]);
      return;
    }

    // Cancel any pending sentiment request
    if (sentimentAbortRef.current) {
      sentimentAbortRef.current.abort();
    }
    sentimentAbortRef.current = new AbortController();

    async function analyzeSentiment() {
      setAnalyzingSentiment(true);
      try {
        const response = await fetch('/api/sentiment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: selectedTranscript?.conversation?.map(m => ({
              role: m.role,
              text: m.text,
            })),
          }),
          signal: sentimentAbortRef.current?.signal,
        });

        if (response.ok) {
          const { sentiments } = await response.json();
          setMessageSentiments(sentiments);
          // Cache the results
          setSentimentCache(prev => ({
            ...prev,
            [transcriptId]: sentiments,
          }));
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Failed to analyze sentiment:', error);
        }
      } finally {
        setAnalyzingSentiment(false);
      }
    }

    analyzeSentiment();

    return () => {
      if (sentimentAbortRef.current) {
        sentimentAbortRef.current.abort();
      }
    };
  }, [selectedTranscript?.conversation, selectedTranscript?.id, sentimentCache]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTranscript(null);
      setSearchTerm('');
      setVisibleCount(50);
      setMessageSentiments([]);
      setCallAnalysis(null);
      setCallAnalysisError(null);
    }
  }, [isOpen, filterType, filterValue]);

  // Reset call analysis when transcript changes
  useEffect(() => {
    if (selectedTranscript) {
      // Check if we have cached analysis
      if (callAnalysisCache[selectedTranscript.id]) {
        setCallAnalysis(callAnalysisCache[selectedTranscript.id]);
      } else {
        setCallAnalysis(null);
      }
      setCallAnalysisError(null);
    }
  }, [selectedTranscript?.id, callAnalysisCache]);

  // Function to analyze the call comprehensively
  const analyzeCall = useCallback(async (sentiments?: MessageSentiment[]) => {
    if (!selectedTranscript?.conversation?.length) return;

    const transcriptId = selectedTranscript.id;

    // Check cache first
    if (callAnalysisCache[transcriptId]) {
      setCallAnalysis(callAnalysisCache[transcriptId]);
      return;
    }

    // Cancel any pending call analysis request
    if (callAnalysisAbortRef.current) {
      callAnalysisAbortRef.current.abort();
    }
    callAnalysisAbortRef.current = new AbortController();

    setAnalyzingCall(true);
    setCallAnalysisError(null);

    try {
      // Calculate sentiment summary from message-level analysis
      let sentimentContext = '';
      if (sentiments && sentiments.length > 0) {
        const customerScores = sentiments
          .filter((_, idx) => selectedTranscript.conversation[idx]?.role === 'customer')
          .map(s => s.score);
        const agentScores = sentiments
          .filter((_, idx) => selectedTranscript.conversation[idx]?.role === 'agent')
          .map(s => s.score);

        const avgCustomer = customerScores.length > 0
          ? customerScores.reduce((a, b) => a + b, 0) / customerScores.length
          : 0;
        const avgAgent = agentScores.length > 0
          ? agentScores.reduce((a, b) => a + b, 0) / agentScores.length
          : 0;

        // Include emotions for context
        const customerEmotions = sentiments
          .filter((_, idx) => selectedTranscript.conversation[idx]?.role === 'customer')
          .map(s => s.emotion)
          .filter(e => e && e !== 'neutral');

        sentimentContext = `
IMPORTANT - Sentence-level sentiment already analyzed:
- Customer average sentiment: ${avgCustomer.toFixed(2)} (${avgCustomer > 0.2 ? 'positive' : avgCustomer < -0.2 ? 'negative' : 'neutral'})
- Agent average sentiment: ${avgAgent.toFixed(2)} (${avgAgent > 0.2 ? 'positive' : avgAgent < -0.2 ? 'negative' : 'neutral'})
- Customer emotions detected: ${customerEmotions.length > 0 ? [...new Set(customerEmotions)].join(', ') : 'mostly neutral'}
Your scores MUST be consistent with this analysis. If customer sentiment is negative, CSAT should be 1-2. If positive, CSAT should be 4-5.`;
      }

      const response = await fetch('/api/call-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: selectedTranscript.conversation.map(m => ({
            role: m.role,
            text: m.text,
          })),
          metadata: {
            agentName: selectedTranscript.agentName,
            department: selectedTranscript.department,
            durationSeconds: selectedTranscript.durationSeconds,
            callStart: selectedTranscript.callStart,
          },
          sentimentContext,
        }),
        signal: callAnalysisAbortRef.current?.signal,
      });

      if (response.ok) {
        const { analysis } = await response.json();
        setCallAnalysis(analysis);
        // Cache the results
        setCallAnalysisCache(prev => ({
          ...prev,
          [transcriptId]: analysis,
        }));
      } else {
        const error = await response.json();
        setCallAnalysisError(error.error || 'Failed to analyze call');
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Failed to analyze call:', error);
        setCallAnalysisError('Failed to analyze call');
      }
    } finally {
      setAnalyzingCall(false);
    }
  }, [selectedTranscript, callAnalysisCache]);

  // Auto-load call analysis when sentiment analysis is complete
  useEffect(() => {
    // Wait for sentiment analysis to complete before starting call analysis
    if (
      selectedTranscript?.conversation?.length &&
      !callAnalysis &&
      !analyzingCall &&
      !callAnalysisError &&
      !analyzingSentiment && // Wait for sentiment analysis
      messageSentiments.length > 0 // Ensure we have sentiments
    ) {
      // Pass the sentiments to ensure consistency
      analyzeCall(messageSentiments);
    }
  }, [selectedTranscript?.conversation, callAnalysis, analyzingCall, callAnalysisError, analyzingSentiment, messageSentiments, analyzeCall]);

  // Cleanup abort controllers on unmount
  useEffect(() => {
    return () => {
      if (callAnalysisAbortRef.current) {
        callAnalysisAbortRef.current.abort();
      }
      if (sentimentAbortRef.current) {
        sentimentAbortRef.current.abort();
      }
    };
  }, []);

  // Scroll to top when a new transcript is selected
  useEffect(() => {
    if (selectedTranscript && detailRef.current) {
      detailRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedTranscript?.id]);

  // Filter transcripts based on filter type and search
  const filteredTranscripts = useMemo(() => {
    let filtered = transcripts;

    // Apply main filter
    if (filterValue) {
      filtered = filtered.filter((t) => {
        switch (filterType) {
          case 'agentSentiment':
            return t.analysis?.agentSentiment === filterValue;
          case 'customerSentiment':
            return t.analysis?.customerSentiment === filterValue || t.basicSentiment === filterValue;
          case 'topic':
            // Check both old and new topic fields
            // Old format: detectedTopics array and aiAnalysis.topics array
            // New format: analysis.aiDiscoveredTopic string (e.g., "Insurance", "Payment Processing")
            //             analysis.aiDiscoveredSubcategory string (e.g., "Payment Processing" under "Billing")
            const oldTopicMatch = (
              (t.detectedTopics || []).includes(filterValue) ||
              (t.aiAnalysis?.topics || []).includes(filterValue)
            );
            // New topics are exact matches or case-insensitive partial matches
            // Check both main topic AND subcategory fields
            const newTopicMatch = (
              t.analysis?.aiDiscoveredTopic === filterValue ||
              t.analysis?.aiDiscoveredTopic?.toLowerCase() === filterValue.toLowerCase() ||
              t.analysis?.aiDiscoveredSubcategory === filterValue ||
              t.analysis?.aiDiscoveredSubcategory?.toLowerCase() === filterValue.toLowerCase()
            );
            return oldTopicMatch || newTopicMatch;
          case 'topicNoSubcategory':
            // Filter for calls with this topic but NO subcategory
            return (
              t.analysis?.aiDiscoveredTopic === filterValue &&
              (t.analysis?.aiDiscoveredSubcategory === null || t.analysis?.aiDiscoveredSubcategory === '')
            );
          case 'department':
            return t.department === filterValue;
          case 'agent':
            return t.agentName === filterValue;
          case 'date':
            // Filter by date when filterValue is a date (YYYY-MM-DD)
            return t.callStart?.startsWith(filterValue);
          case 'hour':
            // Filter by hour of day (e.g., "13:00", "14:00")
            if (!t.callStart) return false;
            try {
              const callDate = new Date(t.callStart);
              const hour = callDate.getUTCHours();
              const hourStr = `${hour.toString().padStart(2, '0')}:00`;
              return hourStr === filterValue;
            } catch {
              return false;
            }
          case 'dayOfWeek':
            // Filter by day of week (e.g., "Mon", "Tue", "Wed")
            if (!t.callStart) return false;
            try {
              const callDate = new Date(t.callStart);
              const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
              const dayOfWeek = dayNames[callDate.getUTCDay()];
              return dayOfWeek === filterValue;
            } catch {
              return false;
            }
          case 'all':
            // Global search across all fields
            const query = filterValue.toLowerCase();
            return (
              (t.vendorCallKey || '').toLowerCase().includes(query) ||
              (t.agentName || '').toLowerCase().includes(query) ||
              (t.department || '').toLowerCase().includes(query) ||
              (t.disposition || '').toLowerCase().includes(query) ||
              (t.detectedTopics || []).some(topic => (topic || '').toLowerCase().includes(query)) ||
              (t.aiAnalysis?.summary || '').toLowerCase().includes(query) ||
              (t.conversation || []).some((msg) => (msg?.text || '').toLowerCase().includes(query))
            );
          default:
            return true;
        }
      });
    }

    // Apply search filter (from modal's own search box)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          (t.agentName || '').toLowerCase().includes(search) ||
          (t.department || '').toLowerCase().includes(search) ||
          (t.disposition || '').toLowerCase().includes(search) ||
          (t.conversation || []).some((msg) => (msg?.text || '').toLowerCase().includes(search))
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
      const date = new Date(dateStr);
      // Format in UTC to match server sorting
      const utcStr = date.toLocaleString('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      return `${utcStr} UTC`;
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

  // Scroll to a specific message in the timeline
  const scrollToMessage = useCallback((index: number) => {
    if (messageRefs.current[index] && detailRef.current) {
      messageRefs.current[index]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal - extra wide to fit side-by-side layout */}
      <div className="relative w-full max-w-[95vw] max-h-[95vh] mx-4 bg-[#0f1420] rounded-2xl border border-white/[0.08] shadow-2xl flex flex-col overflow-hidden">
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
            {loadError ? (
              <div className="flex flex-col items-center justify-center h-48 text-red-400">
                <X className="h-8 w-8 mb-2" />
                <p className="font-semibold">Error Loading Transcripts</p>
                <p className="text-sm text-gray-400 mt-1">{loadError}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white transition-colors"
                >
                  Reload Page
                </button>
              </div>
            ) : loading ? (
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
                  const agentSentiment = transcript.analysis?.agentSentiment;
                  const customerSentiment = transcript.analysis?.customerSentiment;
                  const aiTopic = transcript.analysis?.aiDiscoveredTopic;
                  const aiSubcategory = transcript.analysis?.aiDiscoveredSubcategory;

                  return (
                    <button
                      key={transcript.id}
                      onClick={() => {
                        // Use the conversation from API if available, otherwise set empty to trigger loading
                        setSelectedTranscript({
                          ...transcript,
                          // Keep conversation if it already exists in the transcript data from API
                          conversation: transcript.conversation || [],
                        });
                        setMessageSentiments([]);
                        setCallAnalysis(null);
                      }}
                      className={`w-full p-4 text-left hover:bg-white/[0.02] transition-colors ${
                        selectedTranscript?.id === transcript.id ? 'bg-blue-500/10' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
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

                      {/* AI-Discovered Topic and Subcategory */}
                      {aiTopic && (
                        <div className="mb-2 flex flex-wrap gap-1 items-center">
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs font-medium border border-purple-500/30">
                            {aiTopic}
                          </span>
                          {aiSubcategory && (
                            <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-xs border border-purple-500/20">
                              {aiSubcategory}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Agent and Customer Sentiment Badges */}
                      <div className="flex flex-wrap gap-1">
                        {agentSentiment && (
                          <span
                            className={`px-2 py-0.5 rounded text-xs border ${getSentimentColor(agentSentiment)}`}
                          >
                            Agent: {agentSentiment}
                          </span>
                        )}
                        {customerSentiment && (
                          <span
                            className={`px-2 py-0.5 rounded text-xs border ${getSentimentColor(customerSentiment)}`}
                          >
                            Customer: {customerSentiment}
                          </span>
                        )}

                        {/* Fallback to old topics if no AI analysis */}
                        {!aiTopic && (transcript.aiAnalysis?.topics || transcript.detectedTopics)
                          .slice(0, 2)
                          .map((topic) => (
                            <span
                              key={topic}
                              className="px-2 py-0.5 bg-white/[0.05] rounded text-xs text-gray-400"
                            >
                              {TOPIC_LABELS[topic] || topic}
                            </span>
                          ))}

                        {/* Fallback sentiment if no AI sentiment */}
                        {!agentSentiment && !customerSentiment && (
                          <span
                            className={`px-2 py-0.5 rounded text-xs border ${getSentimentColor(sentiment)}`}
                          >
                            {sentiment}
                          </span>
                        )}
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
                  <h3 className="text-lg font-semibold text-white">
                    Call Analysis
                  </h3>
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

                {/* AI Analysis Summary - New TranscriptAnalysis data */}
                {selectedTranscript.analysis && (
                  <div className="mt-3 p-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg border border-purple-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-sm text-purple-300 font-medium">AI-Discovered Topic</p>
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs border border-purple-500/30">
                        {selectedTranscript.analysis.aiDiscoveredTopic}
                      </span>
                      {selectedTranscript.analysis.aiDiscoveredSubcategory && (
                        <>
                          <span className="text-xs text-gray-500">→</span>
                          <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-xs border border-purple-500/20">
                            {selectedTranscript.analysis.aiDiscoveredSubcategory}
                          </span>
                        </>
                      )}
                      <span className="ml-auto text-xs text-gray-400">
                        Confidence: {(selectedTranscript.analysis.topicConfidence * 100).toFixed(0)}%
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {/* Agent Sentiment */}
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-400">Agent Sentiment</span>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs border font-medium ${getSentimentColor(selectedTranscript.analysis.agentSentiment)}`}>
                            {selectedTranscript.analysis.agentSentiment}
                          </span>
                          <span className="text-xs text-gray-400">
                            {(selectedTranscript.analysis.agentSentimentScore * 100).toFixed(0)}%
                          </span>
                        </div>
                        {selectedTranscript.analysis.agentSentimentReason && (
                          <p className="text-xs text-gray-400 mt-1">{selectedTranscript.analysis.agentSentimentReason}</p>
                        )}
                      </div>

                      {/* Customer Sentiment */}
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-400">Customer Sentiment</span>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs border font-medium ${getSentimentColor(selectedTranscript.analysis.customerSentiment)}`}>
                            {selectedTranscript.analysis.customerSentiment}
                          </span>
                          <span className="text-xs text-gray-400">
                            {(selectedTranscript.analysis.customerSentimentScore * 100).toFixed(0)}%
                          </span>
                        </div>
                        {selectedTranscript.analysis.customerSentimentReason && (
                          <p className="text-xs text-gray-400 mt-1">{selectedTranscript.analysis.customerSentimentReason}</p>
                        )}
                      </div>
                    </div>

                    {/* Key Issues and Resolution */}
                    {(selectedTranscript.analysis.keyIssues?.length > 0 || selectedTranscript.analysis.resolution) && (
                      <div className="mt-3 pt-3 border-t border-white/[0.08]">
                        {selectedTranscript.analysis.keyIssues?.length > 0 && (
                          <div className="mb-2">
                            <span className="text-xs text-gray-400">Key Issues: </span>
                            <span className="text-xs text-gray-300">{selectedTranscript.analysis.keyIssues.join(', ')}</span>
                          </div>
                        )}
                        {selectedTranscript.analysis.resolution && (
                          <div>
                            <span className="text-xs text-gray-400">Resolution: </span>
                            <span className="text-xs text-gray-300">{selectedTranscript.analysis.resolution}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tags */}
                    {selectedTranscript.analysis.tags?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {selectedTranscript.analysis.tags.map((tag, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-white/[0.05] text-gray-400 rounded text-[10px]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Fallback to old AI Analysis if new analysis not available */}
                {!selectedTranscript.analysis && selectedTranscript.aiAnalysis && (
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

              {/* Side-by-side Content Area: Transcript + Scorecard */}
              <div className="flex-1 flex overflow-hidden">
                {/* Left Panel: Transcript */}
                <div className="w-1/2 flex flex-col border-r border-white/[0.08]">
                  <div className="px-4 py-2 bg-[#1a1f2e] border-b border-white/[0.08]">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-400" />
                      <span className="text-sm font-medium text-white">Transcript</span>
                      {analyzingSentiment && (
                        <div className="flex items-center gap-1 ml-2">
                          <div className="animate-spin rounded-full h-3 w-3 border border-blue-500/20 border-t-blue-500" />
                          <span className="text-xs text-blue-300">Analyzing...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sentiment Timeline Heat Map - Fixed between header and content */}
                  {selectedTranscript.conversation.length > 0 && (
                    <div className="px-4 py-3 bg-[#131a29] border-b border-white/[0.08]">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="text-xs font-medium text-gray-400">Conversation Heat Map</div>
                        {messageSentiments.length > 0 ? (
                          <div className="flex items-center gap-1 text-[10px] text-gray-500">
                            <div className="w-2 h-2 rounded-full bg-red-500/60" />
                            <span>Negative</span>
                            <div className="w-2 h-2 rounded-full bg-yellow-500/60 ml-2" />
                            <span>Neutral</span>
                            <div className="w-2 h-2 rounded-full bg-emerald-500/60 ml-2" />
                            <span>Positive</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[10px] text-gray-400">
                            <div className="animate-spin rounded-full h-3 w-3 border border-blue-500/20 border-t-blue-500" />
                            <span>Analyzing sentiment...</span>
                          </div>
                        )}
                      </div>
                      {messageSentiments.length > 0 ? (
                      <div className="relative h-16 bg-[#1a1f2e] rounded-lg border border-white/[0.08] overflow-hidden">
                        {/* Timeline bars */}
                        <div className="flex h-full">
                          {messageSentiments.map((sentiment, idx) => {
                            const score = sentiment.score;
                            const emotion = sentiment.emotion;

                            // Skip system messages for visual timeline (keep them invisible but maintain spacing)
                            if (emotion === 'system') {
                              return (
                                <div
                                  key={idx}
                                  className="flex-1 cursor-pointer transition-all hover:opacity-80"
                                  onClick={() => scrollToMessage(idx)}
                                  style={{ minWidth: '2px' }}
                                >
                                  <div className="h-full bg-yellow-500/10" />
                                </div>
                              );
                            }

                            // Calculate height based on intensity (0 = 50% height, ±1 = 100% height)
                            const intensity = Math.abs(score);
                            const heightPercent = 50 + (intensity * 50);

                            // Color based on sentiment
                            let color = 'bg-gray-500/40'; // neutral
                            if (score > 0.3) {
                              color = 'bg-emerald-500/60'; // positive
                            } else if (score > 0.1) {
                              color = 'bg-emerald-500/30'; // mildly positive
                            } else if (score < -0.3) {
                              color = 'bg-red-500/60'; // negative
                            } else if (score < -0.1) {
                              color = 'bg-orange-500/40'; // mildly negative
                            }

                            // Detect hot spots (significant changes from previous message)
                            const isHotSpot = idx > 0 && Math.abs(score - messageSentiments[idx - 1].score) > 0.5;

                            return (
                              <div
                                key={idx}
                                className="flex-1 cursor-pointer transition-all hover:opacity-80 hover:scale-y-110 group relative"
                                onClick={() => scrollToMessage(idx)}
                                style={{ minWidth: '2px' }}
                                title={`${selectedTranscript.conversation[idx].role}: ${selectedTranscript.conversation[idx].text.substring(0, 50)}...`}
                              >
                                <div className="h-full flex items-end">
                                  <div
                                    className={`w-full ${color} transition-all ${isHotSpot ? 'ring-1 ring-white/40' : ''}`}
                                    style={{ height: `${heightPercent}%` }}
                                  />
                                </div>
                                {/* Hot spot indicator */}
                                {isHotSpot && (
                                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-1 h-1 rounded-full bg-white animate-pulse" />
                                )}
                                {/* Hover tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-30">
                                  <div className="bg-[#0f1420] border border-white/[0.15] rounded px-2 py-1 text-[10px] text-white whitespace-nowrap shadow-xl">
                                    <div className="font-medium text-blue-300">{selectedTranscript.conversation[idx].role}</div>
                                    <div className="text-gray-300 max-w-[200px] truncate">{selectedTranscript.conversation[idx].text.substring(0, 60)}</div>
                                    <div className="text-gray-400 mt-0.5">
                                      Sentiment: {score > 0 ? '+' : ''}{score.toFixed(2)} • {emotion}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      ) : (
                        <div className="relative h-16 bg-[#1a1f2e] rounded-lg border border-white/[0.08] flex items-center justify-center">
                          <div className="text-sm text-gray-500">Waiting for sentiment analysis...</div>
                        </div>
                      )}
                    </div>
                  )}

                  <div ref={detailRef} className="flex-1 overflow-y-auto p-4 space-y-3 relative">
                    {/* AI Processing Overlay */}
                    {analyzingSentiment && (
                      <div className="absolute inset-0 z-10 bg-gradient-to-b from-blue-900/30 via-purple-900/20 to-transparent backdrop-blur-sm flex items-start justify-center pt-8">
                        <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30 rounded-lg px-6 py-4 shadow-xl">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500/20 border-t-blue-400" />
                              <div className="absolute inset-0 animate-ping rounded-full h-8 w-8 border border-blue-400/40" />
                            </div>
                            <div className="text-left">
                              <div className="text-white font-semibold text-lg flex items-center gap-2">
                                <span>AI Analyzing Conversation</span>
                                <span className="inline-flex gap-0.5">
                                  <span className="animate-bounce animation-delay-0 text-blue-400">.</span>
                                  <span className="animate-bounce animation-delay-100 text-blue-400">.</span>
                                  <span className="animate-bounce animation-delay-200 text-blue-400">.</span>
                                </span>
                              </div>
                              <div className="text-blue-200 text-sm mt-1">
                                Generating sentiment heat map
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {!selectedTranscript.conversation || selectedTranscript.conversation.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        No conversation data available
                      </div>
                    ) : (
                      (() => {
                        // Extract customer name from conversation (usually in first few messages)
                        let customerName = 'Customer';
                        const agentName = selectedTranscript.agentName?.split(',')[0]?.trim() || 'Agent';

                        // Look for customer name in first 10 messages where they introduce themselves
                        for (let i = 0; i < Math.min(10, selectedTranscript.conversation.length); i++) {
                          const msg = selectedTranscript.conversation[i];
                          if (msg.role === 'customer') {
                            const text = msg.text.toLowerCase();
                            // Common patterns: "this is X", "yes, X", "my name is X"
                            const namePatterns = [
                              /(?:this is|i'm|i am|my name is|speaking)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
                              /^yes,?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
                              /^([A-Z][a-z]+\s+[A-Z][a-z]+)$/,
                            ];

                            for (const pattern of namePatterns) {
                              const match = msg.text.match(pattern);
                              if (match && match[1]) {
                                customerName = match[1].trim();
                                break;
                              }
                            }
                            if (customerName !== 'Customer') break;
                          }
                        }

                        return selectedTranscript.conversation.map((msg, idx) => {
                          const sentiment = messageSentiments[idx];
                          const sentimentScore = sentiment?.score ?? 0;
                          const emotion = sentiment?.emotion ?? '';

                          // Get the style based on sentiment
                          const messageStyle = messageSentiments.length > 0
                            ? getMessageSentimentStyle(sentimentScore, msg.role, emotion)
                            : msg.role === 'agent'
                              ? 'bg-blue-500/20 text-blue-100'
                              : 'bg-[#1a1f2e] text-gray-200';

                          const displayName = msg.role === 'agent' ? agentName : customerName;

                          return (
                            <div
                              key={idx}
                              ref={(el) => { messageRefs.current[idx] = el; }}
                              className={`flex ${msg.role === 'agent' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-2xl px-3 py-2 transition-all ${messageStyle} ${
                                  msg.role === 'agent' ? 'rounded-br-md' : 'rounded-bl-md'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <p className="text-xs font-medium opacity-60">
                                    {displayName}
                                  </p>
                                  {/* Show emotion badge for all messages with sentiment */}
                                  {emotion && messageSentiments.length > 0 && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getEmotionBadgeStyle(emotion)}`}>
                                      {emotion}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                              </div>
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>
                </div>

                {/* Right Panel: Scorecard */}
                <div className="w-1/2 flex flex-col">
                  <div className="px-4 py-2 bg-[#1a1f2e] border-b border-white/[0.08]">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-emerald-400" />
                      <span className="text-sm font-medium text-white">Executive Scorecard</span>
                      {analyzingCall && (
                        <div className="flex items-center gap-1 ml-2">
                          <div className="animate-spin rounded-full h-3 w-3 border border-emerald-500/20 border-t-emerald-500" />
                          <span className="text-xs text-emerald-300">Generating...</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <CallScorecard
                      analysis={callAnalysis}
                      loading={analyzingCall}
                      error={callAnalysisError || undefined}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
