import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

/**
 * Transcript Analytics API
 *
 * Fetches transcripts with AI analysis data joined from TranscriptAnalysis table
 *
 * GET /api/transcript-analytics
 *
 * Returns:
 * - Summary stats (total, analyzed, sentiment breakdowns)
 * - AI-discovered topics with counts
 * - Daily trends
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'summary';

    if (type === 'summary') {
      // Get summary statistics
      const [
        totalTranscripts,
        analyzedCount,
        agentSentiment,
        customerSentiment,
        topicsData,
        subcategoriesData,
        dailyTrendsRaw,
      ] = await Promise.all([
        // Total transcripts
        prisma.transcripts.count(),

        // Count of analyzed transcripts
        prisma.transcriptAnalysis.count(),

        // Agent sentiment distribution
        prisma.transcriptAnalysis.groupBy({
          by: ['agentSentiment'],
          _count: true,
        }),

        // Customer sentiment distribution
        prisma.transcriptAnalysis.groupBy({
          by: ['customerSentiment'],
          _count: true,
        }),

        // Top topics
        prisma.transcriptAnalysis.groupBy({
          by: ['aiDiscoveredTopic'],
          _count: true,
          _avg: {
            topicConfidence: true,
            agentSentimentScore: true,
            customerSentimentScore: true,
          },
          orderBy: {
            _count: {
              aiDiscoveredTopic: 'desc',
            },
          },
          take: 50,
          where: {
            aiDiscoveredTopic: {
              not: null,
            },
          },
        }),

        // Subcategories
        prisma.transcriptAnalysis.groupBy({
          by: ['aiDiscoveredSubcategory', 'aiDiscoveredTopic'],
          _count: true,
          orderBy: {
            _count: {
              aiDiscoveredSubcategory: 'desc',
            },
          },
          take: 50,
          where: {
            aiDiscoveredSubcategory: {
              not: null,
            },
          },
        }),

        // Daily trends with agent and customer sentiment breakdown
        prisma.$queryRaw`
          SELECT
            DATE(t.call_start) as date,
            COUNT(*) as total,
            SUM(CASE WHEN ta."agentSentiment" = 'positive' THEN 1 ELSE 0 END) as agent_positive,
            SUM(CASE WHEN ta."agentSentiment" = 'neutral' THEN 1 ELSE 0 END) as agent_neutral,
            SUM(CASE WHEN ta."agentSentiment" = 'negative' THEN 1 ELSE 0 END) as agent_negative,
            SUM(CASE WHEN ta."customerSentiment" = 'positive' THEN 1 ELSE 0 END) as customer_positive,
            SUM(CASE WHEN ta."customerSentiment" = 'neutral' THEN 1 ELSE 0 END) as customer_neutral,
            SUM(CASE WHEN ta."customerSentiment" = 'negative' THEN 1 ELSE 0 END) as customer_negative
          FROM transcripts t
          INNER JOIN "TranscriptAnalysis" ta ON t.vendor_call_key = ta."vendorCallKey"
          WHERE t.call_start IS NOT NULL
          GROUP BY DATE(t.call_start)
          ORDER BY DATE(t.call_start) DESC
          LIMIT 90
        ` as any[],
      ]);

      // Calculate averages
      const avgAgentScore = await prisma.transcriptAnalysis.aggregate({
        _avg: {
          agentSentimentScore: true,
          customerSentimentScore: true,
        },
      });

      // Format daily trends
      const dailyTrends = dailyTrendsRaw.map((row: any) => ({
        date: row.date.toISOString().split('T')[0], // Format as YYYY-MM-DD
        total: Number(row.total),
        agentPositive: Number(row.agent_positive),
        agentNeutral: Number(row.agent_neutral),
        agentNegative: Number(row.agent_negative),
        customerPositive: Number(row.customer_positive),
        customerNeutral: Number(row.customer_neutral),
        customerNegative: Number(row.customer_negative),
      }));

      return NextResponse.json({
        success: true,
        metadata: {
          totalTranscripts,
          analyzedTranscripts: analyzedCount,
          analysisProgress: totalTranscripts > 0 ? (analyzedCount / totalTranscripts) * 100 : 0,
        },
        summary: {
          agentSentiment: {
            positive: agentSentiment.find(s => s.agentSentiment === 'positive')?._count || 0,
            neutral: agentSentiment.find(s => s.agentSentiment === 'neutral')?._count || 0,
            negative: agentSentiment.find(s => s.agentSentiment === 'negative')?._count || 0,
          },
          customerSentiment: {
            positive: customerSentiment.find(s => s.customerSentiment === 'positive')?._count || 0,
            neutral: customerSentiment.find(s => s.customerSentiment === 'neutral')?._count || 0,
            negative: customerSentiment.find(s => s.customerSentiment === 'negative')?._count || 0,
          },
          avgAgentScore: avgAgentScore._avg.agentSentimentScore || 0,
          avgCustomerScore: avgAgentScore._avg.customerSentimentScore || 0,
        },
        topics: {
          mainTopics: topicsData.map(t => ({
            name: t.aiDiscoveredTopic || 'Unknown',
            count: t._count,
            avgConfidence: t._avg.topicConfidence || 0,
            avgAgentScore: t._avg.agentSentimentScore || 0,
            avgCustomerScore: t._avg.customerSentimentScore || 0,
          })),
          subcategories: subcategoriesData.map(s => ({
            name: s.aiDiscoveredSubcategory || 'Unknown',
            count: s._count,
            parentTopic: s.aiDiscoveredTopic || 'Unknown',
          })),
        },
        dailyTrends,
      });
    }

    if (type === 'transcripts') {
      // Get paginated transcripts with analysis
      const limit = parseInt(searchParams.get('limit') || '100');
      const offset = parseInt(searchParams.get('offset') || '0');
      const date = searchParams.get('date');
      const sentiment = searchParams.get('sentiment');
      const topic = searchParams.get('topic');
      const department = searchParams.get('department');
      const agent = searchParams.get('agent');

      // Build where clauses
      const transcriptWhere: any = {};
      const analysisWhere: any = {};

      if (date) {
        const startDate = new Date(date);
        const endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 1);

        transcriptWhere.call_start = {
          gte: startDate,
          lt: endDate,
        };
      }

      if (department) {
        transcriptWhere.department = {
          contains: department,
          mode: 'insensitive',
        };
      }

      if (agent) {
        transcriptWhere.agent_name = {
          contains: agent,
          mode: 'insensitive',
        };
      }

      if (sentiment) {
        analysisWhere.OR = [
          { agentSentiment: sentiment },
          { customerSentiment: sentiment },
        ];
      }

      if (topic) {
        analysisWhere.aiDiscoveredTopic = {
          contains: topic,
          mode: 'insensitive',
        };
      }

      // Fetch transcripts with analysis
      const transcripts = await prisma.transcripts.findMany({
        where: transcriptWhere,
        take: limit,
        skip: offset,
        orderBy: {
          call_start: 'desc',
        },
        include: {
          TranscriptAnalysis: {
            where: analysisWhere,
          },
        },
      });

      // Filter out transcripts that don't match analysis criteria
      const filtered = analysisWhere.OR || analysisWhere.aiDiscoveredTopic
        ? transcripts.filter(t => t.TranscriptAnalysis.length > 0)
        : transcripts;

      return NextResponse.json({
        success: true,
        data: filtered.map(t => ({
          id: t.id,
          vendorCallKey: t.vendor_call_key,
          callStart: t.call_start,
          durationSeconds: t.duration_seconds,
          disposition: t.disposition,
          department: t.department,
          agentName: t.agent_name,
          messages: t.messages,
          analysis: t.TranscriptAnalysis[0] || null,
        })),
        pagination: {
          total: filtered.length,
          limit,
          offset,
          hasMore: filtered.length === limit,
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Invalid type parameter. Use "summary" or "transcripts"',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error fetching transcript analytics:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error fetching analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
