// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import fs from 'fs';
import path from 'path';

/**
 * PHASE 2: Advanced Analytics API (Hybrid: Database + Static JSON Fallback)
 *
 * GET /api/analytics?type=[baseline|monthly|agent|categories|all]
 *
 * Provides comprehensive analytics including:
 * - Baseline vs Recent comparison
 * - Monthly breakdowns
 * - Agent performance metrics
 * - Category distribution
 * - Trend analysis
 *
 * Falls back to pre-processed JSON when database is empty
 */

interface BaselineComparison {
  category: string;
  subcategory: string;
  baselineCount: number;
  recentCount: number;
  change: number;
  percentChange: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

interface MonthlyBreakdown {
  month: string;
  year: number;
  category: string;
  subcategory: string;
  count: number;
  percentage: number;
}

interface AgentPerformance {
  agentName: string;
  totalCalls: number;
  avgDuration: number;
  resolutionRate: number;
  escalationRate: number;
  avgCallQuality: number;
  positiveSentimentRate: number;
  categoryDistribution: { [category: string]: number };
}

interface CategoryStats {
  category: string;
  subcategory: string;
  count: number;
  percentage: number;
  avgConfidence: number;
}

/**
 * Load pre-processed JSON data
 */
function loadProcessedData() {
  const dataPath = path.join(process.cwd(), 'data', 'processed-stats.json');

  if (!fs.existsSync(dataPath)) {
    return null;
  }

  const content = fs.readFileSync(dataPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Get baseline vs recent comparison from JSON
 */
function getBaselineFromJSON(daysRecent: number = 21) {
  const data = loadProcessedData();
  if (!data?.baselineAnalytics) {
    return null;
  }

  // Find closest time window
  const availableWindows = Object.keys(data.baselineAnalytics).map(Number);
  const closestWindow = availableWindows.reduce((prev, curr) =>
    Math.abs(curr - daysRecent) < Math.abs(prev - daysRecent) ? curr : prev
  );

  const baseline = data.baselineAnalytics[closestWindow];
  if (!baseline?.trends) {
    return null;
  }

  // Convert to API format
  return baseline.trends.map((t: any) => ({
    category: t.category,
    subcategory: t.subcategory,
    baselineCount: t.baseline,
    recentCount: t.recent,
    change: t.change,
    percentChange: t.percentChange,
    trend: t.trend,
  }));
}

/**
 * Get category stats from JSON
 */
function getCategoryStatsFromJSON() {
  const data = loadProcessedData();
  if (!data?.categorizedAnalytics) {
    return null;
  }

  const analytics = data.categorizedAnalytics;

  // Return all subcategories with their stats
  return analytics.subcategories.map((sub: any) => ({
    category: sub.category,
    subcategory: sub.subcategory,
    count: sub.count,
    percentage: sub.percentage,
    avgConfidence: sub.avgConfidence,
  }));
}

/**
 * Get baseline vs recent comparison from database
 */
async function getBaselineComparison(daysRecent: number = 21): Promise<BaselineComparison[]> {
  const now = new Date();
  const recentStart = new Date(now.getTime() - daysRecent * 24 * 60 * 60 * 1000);

  // NOTE: Database schema changed - this API now falls back to JSON files
  // Return empty array to trigger JSON fallback in frontend
  return [];

  // Get all tickets/transcripts (disabled - tables don't exist in current schema)
  // const [allTickets, allTranscripts] = await Promise.all([
  //   prisma.transcripts.findMany({
  //     select: {
  //       call_start: true,
  //     },
  //   }),
  // ]);

  // If both are empty, return null to trigger JSON fallback
  // if (allTickets.length === 0 && allTranscripts.length === 0) {
  //   return [];
  // }

  // Combine tickets and transcripts (disabled - unreachable code after early return)
  /*
  const allRecords = [
    ...allTickets.map(t => ({
      date: t.ticketCreatedAtUtc,
      category: t.category || 'Other',
      subcategory: t.subcategory || 'Uncategorized',
    })),
    ...allTranscripts.map(t => ({
      date: t.callDate,
      category: t.category || 'Other',
      subcategory: t.subcategory || 'Uncategorized',
    })),
  ].filter(r => r.date !== null);

  // Split into baseline and recent
  const baseline = allRecords.filter(r => r.date! < recentStart);
  const recent = allRecords.filter(r => r.date! >= recentStart);

  // Count by category/subcategory
  const baselineCounts = new Map<string, number>();
  const recentCounts = new Map<string, number>();

  for (const record of baseline) {
    const key = `${record.category}|${record.subcategory}`;
    baselineCounts.set(key, (baselineCounts.get(key) || 0) + 1);
  }

  for (const record of recent) {
    const key = `${record.category}|${record.subcategory}`;
    recentCounts.set(key, (recentCounts.get(key) || 0) + 1);
  }

  // Build comparison
  const allKeys = new Set([...baselineCounts.keys(), ...recentCounts.keys()]);
  const comparison: BaselineComparison[] = [];

  for (const key of allKeys) {
    const [category, subcategory] = key.split('|');
    const baselineCount = baselineCounts.get(key) || 0;
    const recentCount = recentCounts.get(key) || 0;
    const change = recentCount - baselineCount;
    const percentChange = baselineCount > 0 ? (change / baselineCount) * 100 : 0;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (percentChange > 10) trend = 'increasing';
    else if (percentChange < -10) trend = 'decreasing';

    comparison.push({
      category,
      subcategory,
      baselineCount,
      recentCount,
      change,
      percentChange,
      trend,
    });
  }

  // Sort by change (largest changes first)
  return comparison.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  */
}

/**
 * Get monthly breakdown from database
 */
async function getMonthlyBreakdown(): Promise<MonthlyBreakdown[]> {
  // NOTE: Database schema changed - this API now falls back to JSON files
  return [];

  /*
  const [tickets, transcripts] = await Promise.all([
    prisma.transcripts.findMany({
      select: {
        call_start: true,
        category: true,
        subcategory: true,
      },
    }),
  ]);

  // Combine and group by month
  const monthlyData = new Map<string, { [key: string]: number }>();

  for (const ticket of tickets) {
    const date = ticket.ticketCreatedAtUtc;
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const catKey = `${ticket.category}|${ticket.subcategory}`;

    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, {});
    }

    const monthCats = monthlyData.get(monthKey)!;
    monthCats[catKey] = (monthCats[catKey] || 0) + 1;
  }

  for (const transcript of transcripts) {
    if (!transcript.callDate) continue;
    const date = transcript.callDate;
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const catKey = `${transcript.category}|${transcript.subcategory}`;

    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, {});
    }

    const monthCats = monthlyData.get(monthKey)!;
    monthCats[catKey] = (monthCats[catKey] || 0) + 1;
  }

  // Convert to array
  const breakdown: MonthlyBreakdown[] = [];

  for (const [monthKey, categories] of monthlyData.entries()) {
    const [year, month] = monthKey.split('-');
    const total = Object.values(categories).reduce((sum, count) => sum + count, 0);

    for (const [catKey, count] of Object.entries(categories)) {
      const [category, subcategory] = catKey.split('|');

      breakdown.push({
        month: new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleString('default', { month: 'long' }),
        year: parseInt(year),
        category,
        subcategory,
        count,
        percentage: (count / total) * 100,
      });
    }
  }

  return breakdown;
  */
}

/**
 * Get agent performance metrics from database
 */
async function getAgentPerformance(): Promise<AgentPerformance[]> {
  // NOTE: Database schema changed - this API now falls back to JSON files
  return [];

  /*
  const transcripts = await prisma.transcripts.findMany({
    select: {
      agentName: true,
      durationSeconds: true,
      wasResolved: true,
      wasEscalated: true,
      callQualityScore: true,
      sentiment: true,
      category: true,
    },
  });

  // Group by agent
  const agentMap = new Map<string, any[]>();

  for (const transcript of transcripts) {
    const agent = transcript.agentName || 'Unknown';
    if (!agentMap.has(agent)) {
      agentMap.set(agent, []);
    }
    agentMap.get(agent)!.push(transcript);
  }

  // Calculate metrics
  const performance: AgentPerformance[] = [];

  for (const [agentName, calls] of agentMap.entries()) {
    const totalCalls = calls.length;
    const avgDuration = calls.reduce((sum, c) => sum + (c.durationSeconds || 0), 0) / totalCalls;
    const resolvedCount = calls.filter(c => c.wasResolved).length;
    const escalatedCount = calls.filter(c => c.wasEscalated).length;
    const positiveCount = calls.filter(c => c.sentiment === 'positive').length;
    const avgCallQuality = calls.reduce((sum, c) => sum + (c.callQualityScore || 0), 0) / totalCalls;

    // Category distribution
    const categoryDist: { [category: string]: number } = {};
    for (const call of calls) {
      const cat = call.category || 'Other';
      categoryDist[cat] = (categoryDist[cat] || 0) + 1;
    }

    performance.push({
      agentName,
      totalCalls,
      avgDuration,
      resolutionRate: (resolvedCount / totalCalls) * 100,
      escalationRate: (escalatedCount / totalCalls) * 100,
      avgCallQuality,
      positiveSentimentRate: (positiveCount / totalCalls) * 100,
      categoryDistribution: categoryDist,
    });
  }

  // Sort by total calls
  return performance.sort((a, b) => b.totalCalls - a.totalCalls);
  */
}

/**
 * Get category statistics from database
 */
async function getCategoryStats(): Promise<CategoryStats[]> {
  // NOTE: Database schema changed - this API now falls back to JSON files
  return [];

  /*
  const [tickets, transcripts] = await Promise.all([
    prisma.transcripts.findMany({
      select: {
        category: true,
        subcategory: true,
        categorizationConfidence: true,
      },
    }),
    prisma.transcript.findMany({
      select: {
        category: true,
        subcategory: true,
        categorizationConfidence: true,
      },
    }),
  ]);

  const combined = [...tickets, ...transcripts];

  // If empty, return empty array to trigger JSON fallback
  if (combined.length === 0) {
    return [];
  }

  const categoryMap = new Map<string, { count: number; confidenceSum: number }>();

  for (const record of combined) {
    const key = `${record.category || 'Other'}|${record.subcategory || 'Uncategorized'}`;
    const existing = categoryMap.get(key) || { count: 0, confidenceSum: 0 };
    existing.count++;
    existing.confidenceSum += record.categorizationConfidence || 0;
    categoryMap.set(key, existing);
  }

  const total = combined.length;
  const stats: CategoryStats[] = [];

  for (const [key, data] of categoryMap.entries()) {
    const [category, subcategory] = key.split('|');
    stats.push({
      category,
      subcategory,
      count: data.count,
      percentage: (data.count / total) * 100,
      avgConfidence: data.confidenceSum / data.count,
    });
  }

  return stats.sort((a, b) => b.count - a.count);
  */
}

/**
 * GET handler - Hybrid approach: Try database first, fall back to JSON
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'baseline';
    const daysRecent = parseInt(searchParams.get('daysRecent') || '21');

    let data: any;
    let source = 'database';

    switch (type) {
      case 'baseline':
        data = await getBaselineComparison(daysRecent);
        if (!data || data.length === 0) {
          data = getBaselineFromJSON(daysRecent);
          source = 'json';
        }
        break;

      case 'monthly':
        data = await getMonthlyBreakdown();
        if (!data || data.length === 0) {
          source = 'json';
          data = []; // No JSON fallback for monthly yet
        }
        break;

      case 'agent':
        data = await getAgentPerformance();
        if (!data || data.length === 0) {
          source = 'json';
          data = []; // No JSON fallback for agent yet
        }
        break;

      case 'categories':
        data = await getCategoryStats();
        if (!data || data.length === 0) {
          data = getCategoryStatsFromJSON();
          source = 'json';
        }
        break;

      case 'all':
        const baseline = await getBaselineComparison(daysRecent);
        const monthly = await getMonthlyBreakdown();
        const agent = await getAgentPerformance();
        const categories = await getCategoryStats();

        data = {
          baseline: baseline.length > 0 ? baseline : (getBaselineFromJSON(daysRecent) || []),
          monthly: monthly.length > 0 ? monthly : [],
          agent: agent.length > 0 ? agent : [],
          categories: categories.length > 0 ? categories : (getCategoryStatsFromJSON() || []),
        };
        source = 'hybrid';
        break;

      default:
        return NextResponse.json(
          { success: false, message: 'Invalid type parameter' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      type,
      source, // Indicates where data came from (database, json, or hybrid)
      data,
    });
  } catch (error) {
    console.error('Error in analytics API:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error generating analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
