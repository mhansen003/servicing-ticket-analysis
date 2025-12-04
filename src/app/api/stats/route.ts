import { NextResponse } from 'next/server';
import {
  getTicketStats,
  getTicketsByMonth,
  getProjectBreakdown,
  getAssigneeBreakdown,
  getStatusBreakdown,
  getPriorityBreakdown,
  getHeatmaps,
  getIssues,
  getTrends,
  getServicingAnalysis,
} from '@/lib/data-loader';

export async function GET() {
  try {
    const [
      stats,
      ticketsByMonth,
      projectBreakdown,
      assigneeBreakdown,
      statusBreakdown,
      priorityBreakdown,
      heatmaps,
      issues,
      trends,
      servicingAnalysis,
    ] = await Promise.all([
      getTicketStats(),
      getTicketsByMonth(),
      getProjectBreakdown(),
      getAssigneeBreakdown(),
      getStatusBreakdown(),
      getPriorityBreakdown(),
      getHeatmaps(),
      getIssues(),
      getTrends(),
      getServicingAnalysis(),
    ]);

    return NextResponse.json({
      stats,
      ticketsByMonth,
      projectBreakdown,
      assigneeBreakdown,
      statusBreakdown,
      priorityBreakdown,
      heatmaps,
      issues,
      trends,
      servicingAnalysis,
    });
  } catch (error) {
    console.error('Error loading stats:', error);
    return NextResponse.json({ error: 'Failed to load statistics' }, { status: 500 });
  }
}
