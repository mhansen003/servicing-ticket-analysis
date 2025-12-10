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
    const startDate = searchParams.get('startDate'); // Optional date range filter (YYYY-MM-DD)
    const endDate = searchParams.get('endDate');

    if (type === 'summary') {
      // Build date filter for transcript queries
      const dateFilter = startDate && endDate ? {
        call_start: {
          gte: new Date(startDate),
          lt: new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000), // Add 1 day to include end date
        }
      } : {};

      // Build where clause for TranscriptAnalysis queries (joins with transcripts)
      const analysisDateFilter = startDate && endDate ? {
        transcript: {
          call_start: {
            gte: new Date(startDate),
            lt: new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000),
          }
        }
      } : {};

      // Get summary statistics
      const [
        totalTranscripts,
        analyzedCount,
        recentImportsCount,
        agentSentiment,
        customerSentiment,
        topicsData,
        subcategoriesData,
        uncategorizedData,
        dailyTrendsRaw,
        hourlyDataRaw,
        dayOfWeekDataRaw,
        departmentDataRaw,
      ] = await Promise.all([
        // Total transcripts (filtered by date)
        prisma.transcripts.count({
          where: dateFilter,
        }),

        // Count of analyzed transcripts (filtered by date via join)
        prisma.transcriptAnalysis.count({
          where: analysisDateFilter,
        }),

        // Count of transcripts from Dec 1, 2025 forward (our data baseline)
        prisma.transcripts.count({
          where: {
            call_start: {
              gte: new Date('2025-12-01'), // Dec 1, 2025 - our sync starting point
            },
          },
        }),

        // Agent sentiment distribution (filtered by date)
        prisma.transcriptAnalysis.groupBy({
          by: ['agentSentiment'],
          _count: true,
          where: analysisDateFilter,
        }),

        // Customer sentiment distribution (filtered by date)
        prisma.transcriptAnalysis.groupBy({
          by: ['customerSentiment'],
          _count: true,
          where: analysisDateFilter,
        }),

        // Top topics (filtered by date)
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
            ...analysisDateFilter,
          },
        }),

        // Subcategories (filtered by date)
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
            ...analysisDateFilter,
          },
        }),

        // Uncategorized calls (calls with topic but no subcategory) (filtered by date)
        prisma.transcriptAnalysis.groupBy({
          by: ['aiDiscoveredTopic'],
          _count: true,
          where: {
            AND: [
              {
                aiDiscoveredTopic: {
                  not: null,
                },
              },
              {
                aiDiscoveredTopic: {
                  not: '',
                },
              },
            ],
            OR: [
              { aiDiscoveredSubcategory: null },
              { aiDiscoveredSubcategory: '' },
            ],
            ...analysisDateFilter,
          },
        }),

        // Daily trends with agent and customer sentiment breakdown (filtered by date)
        (startDate && endDate
          ? prisma.$queryRaw`
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
                AND t.call_start >= ${startDate}::timestamp
                AND t.call_start < (${endDate}::timestamp + INTERVAL '1 day')
              GROUP BY DATE(t.call_start)
              ORDER BY DATE(t.call_start) DESC
              LIMIT 90
            `
          : prisma.$queryRaw`
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
            `) as Promise<any[]>,

        // Hourly distribution (in UTC to match client-side filtering)
        (startDate && endDate
          ? prisma.$queryRaw`
              SELECT
                EXTRACT(HOUR FROM t.call_start AT TIME ZONE 'UTC') as hour,
                COUNT(*) as count
              FROM transcripts t
              WHERE t.call_start IS NOT NULL
                AND t.call_start >= ${startDate}::timestamp
                AND t.call_start < (${endDate}::timestamp + INTERVAL '1 day')
              GROUP BY EXTRACT(HOUR FROM t.call_start AT TIME ZONE 'UTC')
              ORDER BY hour
            `
          : prisma.$queryRaw`
              SELECT
                EXTRACT(HOUR FROM t.call_start AT TIME ZONE 'UTC') as hour,
                COUNT(*) as count
              FROM transcripts t
              WHERE t.call_start IS NOT NULL
              GROUP BY EXTRACT(HOUR FROM t.call_start AT TIME ZONE 'UTC')
              ORDER BY hour
            `) as Promise<any[]>,

        // Day of week distribution (in UTC to match client-side filtering)
        (startDate && endDate
          ? prisma.$queryRaw`
              SELECT
                TO_CHAR(t.call_start AT TIME ZONE 'UTC', 'Day') as day,
                EXTRACT(DOW FROM t.call_start AT TIME ZONE 'UTC') as day_num,
                COUNT(*) as count
              FROM transcripts t
              WHERE t.call_start IS NOT NULL
                AND t.call_start >= ${startDate}::timestamp
                AND t.call_start < (${endDate}::timestamp + INTERVAL '1 day')
              GROUP BY TO_CHAR(t.call_start AT TIME ZONE 'UTC', 'Day'), EXTRACT(DOW FROM t.call_start AT TIME ZONE 'UTC')
              ORDER BY day_num
            `
          : prisma.$queryRaw`
              SELECT
                TO_CHAR(t.call_start AT TIME ZONE 'UTC', 'Day') as day,
                EXTRACT(DOW FROM t.call_start AT TIME ZONE 'UTC') as day_num,
                COUNT(*) as count
              FROM transcripts t
              WHERE t.call_start IS NOT NULL
              GROUP BY TO_CHAR(t.call_start AT TIME ZONE 'UTC', 'Day'), EXTRACT(DOW FROM t.call_start AT TIME ZONE 'UTC')
              ORDER BY day_num
            `) as Promise<any[]>,

        // Department distribution with sentiment (filtered by date)
        (startDate && endDate
          ? prisma.$queryRaw`
              SELECT
                t.department,
                COUNT(*) as count,
                SUM(CASE WHEN ta."customerSentiment" = 'positive' THEN 1 ELSE 0 END) as positive,
                SUM(CASE WHEN ta."customerSentiment" = 'negative' THEN 1 ELSE 0 END) as negative
              FROM transcripts t
              INNER JOIN "TranscriptAnalysis" ta ON t.vendor_call_key = ta."vendorCallKey"
              WHERE t.department IS NOT NULL AND t.department != ''
                AND t.call_start >= ${startDate}::timestamp
                AND t.call_start < (${endDate}::timestamp + INTERVAL '1 day')
              GROUP BY t.department
              ORDER BY count DESC
            `
          : prisma.$queryRaw`
              SELECT
                t.department,
                COUNT(*) as count,
                SUM(CASE WHEN ta."customerSentiment" = 'positive' THEN 1 ELSE 0 END) as positive,
                SUM(CASE WHEN ta."customerSentiment" = 'negative' THEN 1 ELSE 0 END) as negative
              FROM transcripts t
              INNER JOIN "TranscriptAnalysis" ta ON t.vendor_call_key = ta."vendorCallKey"
              WHERE t.department IS NOT NULL AND t.department != ''
              GROUP BY t.department
              ORDER BY count DESC
            `) as Promise<any[]>,
      ]);

      // Calculate averages (filtered by date)
      const avgAgentScore = await prisma.transcriptAnalysis.aggregate({
        _avg: {
          agentSentimentScore: true,
          customerSentimentScore: true,
        },
        where: analysisDateFilter,
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

      // Format hourly data
      const byHour: Record<string, number> = {};
      hourlyDataRaw.forEach((row: any) => {
        const hour = Number(row.hour);
        const hourStr = hour.toString().padStart(2, '0') + ':00';
        byHour[hourStr] = Number(row.count);
      });

      // Format day of week data
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const byDayOfWeek: Record<string, number> = {};
      dayOfWeekDataRaw.forEach((row: any) => {
        const dayNum = Number(row.day_num);
        const dayName = dayNames[dayNum];
        byDayOfWeek[dayName] = Number(row.count);
      });

      // Format department data
      const byDepartment: Record<string, { count: number; negative: number; positive: number }> = {};
      departmentDataRaw.forEach((row: any) => {
        const dept = row.department?.trim();
        if (dept) {
          byDepartment[dept] = {
            count: Number(row.count),
            negative: Number(row.negative),
            positive: Number(row.positive),
          };
        }
      });

      return NextResponse.json({
        success: true,
        metadata: {
          totalTranscripts,
          analyzedTranscripts: analyzedCount,
          analysisProgress: totalTranscripts > 0 ? (analyzedCount / totalTranscripts) * 100 : 0,
          recentImports: recentImportsCount, // Last 8 hours
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
          uncategorized: uncategorizedData.map(u => ({
            parentTopic: u.aiDiscoveredTopic || 'Unknown',
            count: u._count,
          })),
        },
        dailyTrends,
        byHour,
        byDayOfWeek,
        byDepartment,
      });
    }

    if (type === 'transcripts') {
      // Get paginated transcripts with analysis
      const limit = parseInt(searchParams.get('limit') || '100');
      const offset = parseInt(searchParams.get('offset') || '0');
      const date = searchParams.get('date');
      const fromDate = searchParams.get('fromDate');
      const toDate = searchParams.get('toDate');
      const sentiment = searchParams.get('sentiment');
      const agentSentiment = searchParams.get('agentSentiment');
      const customerSentiment = searchParams.get('customerSentiment');
      const topic = searchParams.get('topic');
      const department = searchParams.get('department');
      const agent = searchParams.get('agent');
      const search = searchParams.get('search');

      // Build where clauses
      const transcriptWhere: any = {};
      const analysisWhere: any = {};

      // Handle date filtering - support both single date and date range
      if (date) {
        const startDate = new Date(date);
        const endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 1);

        transcriptWhere.call_start = {
          gte: startDate,
          lt: endDate,
        };
      } else if (fromDate || toDate) {
        transcriptWhere.call_start = {};
        if (fromDate) {
          transcriptWhere.call_start.gte = new Date(fromDate);
        }
        if (toDate) {
          // Use lt with next day to ensure we catch all records up to midnight
          const endDate = new Date(toDate);
          endDate.setDate(endDate.getDate() + 1);
          transcriptWhere.call_start.lt = endDate;
        }
      }

      if (department) {
        // Exact match - prevents "Service" from matching "Customer Service", etc.
        transcriptWhere.department = department;
      }

      if (agent) {
        // Exact match - prevents "John" from matching "John Smith", "Johnny", etc.
        transcriptWhere.agent_name = agent;
      }

      if (sentiment) {
        analysisWhere.OR = [
          { agentSentiment: sentiment },
          { customerSentiment: sentiment },
        ];
      }

      if (agentSentiment) {
        analysisWhere.agentSentiment = agentSentiment;
      }

      if (customerSentiment) {
        analysisWhere.customerSentiment = customerSentiment;
      }

      if (topic) {
        // Exact match on either aiDiscoveredTopic OR aiDiscoveredSubcategory
        // This prevents "Payment" from matching "Payment Processing", "Payment Inquiry", etc.
        analysisWhere.OR = [
          { aiDiscoveredTopic: topic },
          { aiDiscoveredSubcategory: topic }
        ];
      }

      // If we have analysis filters, we need to ensure we only get transcripts that have matching analysis
      if (Object.keys(analysisWhere).length > 0) {
        transcriptWhere.TranscriptAnalysis = {
          some: analysisWhere,
        };
      }

      // Handle text search separately with raw SQL
      let transcripts;
      if (search && search.trim()) {
        const searchTerm = search.trim().toLowerCase();

        // Build date filter for search query
        let rawTranscripts;
        if (date) {
          const startDate = new Date(date);
          const endDate = new Date(date);
          endDate.setDate(endDate.getDate() + 1);
          rawTranscripts = await prisma.$queryRaw<any[]>`
            SELECT t.*
            FROM transcripts t
            WHERE (
              LOWER(t.agent_name) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.department) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.vendor_call_key) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.disposition) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.messages::text) LIKE ${'%' + searchTerm + '%'}
            )
            AND t.call_start >= ${startDate}::timestamp
            AND t.call_start < ${endDate}::timestamp
            ORDER BY t.call_start DESC NULLS LAST
            LIMIT ${limit}
            OFFSET ${offset}
          `;
        } else if (fromDate && toDate) {
          const startDate = new Date(fromDate);
          const endDate = new Date(toDate);
          endDate.setDate(endDate.getDate() + 1);
          rawTranscripts = await prisma.$queryRaw<any[]>`
            SELECT t.*
            FROM transcripts t
            WHERE (
              LOWER(t.agent_name) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.department) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.vendor_call_key) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.disposition) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.messages::text) LIKE ${'%' + searchTerm + '%'}
            )
            AND t.call_start >= ${startDate}::timestamp
            AND t.call_start < ${endDate}::timestamp
            ORDER BY t.call_start DESC NULLS LAST
            LIMIT ${limit}
            OFFSET ${offset}
          `;
        } else if (fromDate) {
          const startDate = new Date(fromDate);
          rawTranscripts = await prisma.$queryRaw<any[]>`
            SELECT t.*
            FROM transcripts t
            WHERE (
              LOWER(t.agent_name) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.department) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.vendor_call_key) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.disposition) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.messages::text) LIKE ${'%' + searchTerm + '%'}
            )
            AND t.call_start >= ${startDate}::timestamp
            ORDER BY t.call_start DESC NULLS LAST
            LIMIT ${limit}
            OFFSET ${offset}
          `;
        } else if (toDate) {
          const endDate = new Date(toDate);
          endDate.setDate(endDate.getDate() + 1);
          rawTranscripts = await prisma.$queryRaw<any[]>`
            SELECT t.*
            FROM transcripts t
            WHERE (
              LOWER(t.agent_name) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.department) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.vendor_call_key) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.disposition) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.messages::text) LIKE ${'%' + searchTerm + '%'}
            )
            AND t.call_start < ${endDate}::timestamp
            ORDER BY t.call_start DESC NULLS LAST
            LIMIT ${limit}
            OFFSET ${offset}
          `;
        } else {
          rawTranscripts = await prisma.$queryRaw<any[]>`
            SELECT t.*
            FROM transcripts t
            WHERE (
              LOWER(t.agent_name) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.department) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.vendor_call_key) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.disposition) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.messages::text) LIKE ${'%' + searchTerm + '%'}
            )
            ORDER BY t.call_start DESC NULLS LAST
            LIMIT ${limit}
            OFFSET ${offset}
          `;
        }

        // Fetch TranscriptAnalysis for these transcripts
        const vendorCallKeys = rawTranscripts.map(t => t.vendor_call_key);
        const analyses = await prisma.transcriptAnalysis.findMany({
          where: {
            vendorCallKey: {
              in: vendorCallKeys,
            },
          },
        });

        // Attach TranscriptAnalysis to transcripts
        transcripts = rawTranscripts.map(t => ({
          ...t,
          TranscriptAnalysis: analyses.filter(a => a.vendorCallKey === t.vendor_call_key),
        }));
      } else {
        // Use standard Prisma query for non-search requests
        transcripts = await prisma.transcripts.findMany({
          where: transcriptWhere,
          take: limit,
          skip: offset,
          orderBy: {
            call_start: 'desc',
          },
          include: {
            TranscriptAnalysis: true,
          },
        });
      }

      // Get total count for pagination (using same filters)
      let totalCount: number;
      if (search && search.trim()) {
        // For search queries, we need to count matching records
        const searchTerm = search.trim().toLowerCase();
        if (date) {
          const startDate = new Date(date);
          const endDate = new Date(date);
          endDate.setDate(endDate.getDate() + 1);
          const result = await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count
            FROM transcripts t
            WHERE (
              LOWER(t.agent_name) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.department) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.vendor_call_key) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.disposition) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.messages::text) LIKE ${'%' + searchTerm + '%'}
            )
            AND t.call_start >= ${startDate}::timestamp
            AND t.call_start < ${endDate}::timestamp
          `;
          totalCount = Number(result[0].count);
        } else if (fromDate && toDate) {
          const startDate = new Date(fromDate);
          const endDate = new Date(toDate);
          endDate.setDate(endDate.getDate() + 1);
          const result = await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count
            FROM transcripts t
            WHERE (
              LOWER(t.agent_name) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.department) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.vendor_call_key) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.disposition) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.messages::text) LIKE ${'%' + searchTerm + '%'}
            )
            AND t.call_start >= ${startDate}::timestamp
            AND t.call_start < ${endDate}::timestamp
          `;
          totalCount = Number(result[0].count);
        } else if (fromDate) {
          const startDate = new Date(fromDate);
          const result = await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count
            FROM transcripts t
            WHERE (
              LOWER(t.agent_name) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.department) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.vendor_call_key) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.disposition) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.messages::text) LIKE ${'%' + searchTerm + '%'}
            )
            AND t.call_start >= ${startDate}::timestamp
          `;
          totalCount = Number(result[0].count);
        } else if (toDate) {
          const endDate = new Date(toDate);
          endDate.setDate(endDate.getDate() + 1);
          const result = await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count
            FROM transcripts t
            WHERE (
              LOWER(t.agent_name) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.department) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.vendor_call_key) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.disposition) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.messages::text) LIKE ${'%' + searchTerm + '%'}
            )
            AND t.call_start < ${endDate}::timestamp
          `;
          totalCount = Number(result[0].count);
        } else {
          const result = await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count
            FROM transcripts t
            WHERE (
              LOWER(t.agent_name) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.department) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.vendor_call_key) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.disposition) LIKE ${'%' + searchTerm + '%'}
              OR LOWER(t.messages::text) LIKE ${'%' + searchTerm + '%'}
            )
          `;
          totalCount = Number(result[0].count);
        }
      } else {
        // For regular queries, use Prisma count with same filters
        totalCount = await prisma.transcripts.count({
          where: transcriptWhere,
        });
      }

      // All transcripts should have analysis if we filtered correctly
      const filtered = transcripts;

      return NextResponse.json({
        success: true,
        data: filtered.map(t => {
          const analysis = t.TranscriptAnalysis[0] || null;
          const messages = t.messages as any;
          const rawConversation = Array.isArray(messages) ? messages : [];

          // Transform conversation messages: map 'speaker' field to 'role' and normalize values
          const conversation = rawConversation
            .map((m: any) => ({
              role: m.speaker ? m.speaker.toLowerCase() : m.role?.toLowerCase() || 'unknown',
              text: m.text || '',
              timestamp: m.timestamp || null,
            }))
            .sort((a: any, b: any) => {
              // Sort by timestamp if available, otherwise maintain original order
              if (a.timestamp && b.timestamp) {
                return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
              }
              return 0;
            });

          // Calculate message counts using the 'speaker' field from raw data
          const messageCount = rawConversation.length;
          const customerMessages = rawConversation.filter((m: any) =>
            (m.speaker && m.speaker.toLowerCase() === 'customer') ||
            (m.role && m.role.toLowerCase() === 'customer')
          ).length;
          const agentMessages = rawConversation.filter((m: any) =>
            (m.speaker && m.speaker.toLowerCase() === 'agent') ||
            (m.role && m.role.toLowerCase() === 'agent')
          ).length;

          return {
            id: t.id,
            vendorCallKey: t.vendor_call_key,
            callStart: t.call_start?.toISOString() || '',
            callEnd: t.call_end?.toISOString() || '', // NOW AVAILABLE!
            durationSeconds: t.duration_seconds || 0,
            disposition: t.disposition || '',
            numberOfHolds: t.number_of_holds || 0, // NOW AVAILABLE!
            holdDuration: t.hold_duration || 0, // NOW AVAILABLE!
            department: t.department || '',
            status: t.status || '', // NOW AVAILABLE!
            agentName: analysis?.agentName || t.agent_name || '',
            agentRole: t.agent_role || '', // NOW AVAILABLE!
            agentProfile: t.agent_profile || '', // NOW AVAILABLE!
            agentEmail: t.agent_email || '', // NOW AVAILABLE!
            messageCount,
            customerMessages,
            agentMessages,
            detectedTopics: [], // Not available in database
            basicSentiment: analysis ?
              (analysis.customerSentiment || 'neutral') as 'positive' | 'negative' | 'neutral'
              : 'neutral',
            conversation,
            analysis: analysis ? {
              agentSentiment: analysis.agentSentiment || '',
              agentSentimentScore: analysis.agentSentimentScore || 0,
              agentSentimentReason: analysis.agentSentimentReason || '',
              customerSentiment: analysis.customerSentiment || '',
              customerSentimentScore: analysis.customerSentimentScore || 0,
              customerSentimentReason: analysis.customerSentimentReason || '',
              aiDiscoveredTopic: analysis.aiDiscoveredTopic || '',
              aiDiscoveredSubcategory: analysis.aiDiscoveredSubcategory || '',
              topicConfidence: analysis.topicConfidence || 0,
              keyIssues: analysis.keyIssues || [],
              resolution: analysis.resolution || '',
              tags: analysis.tags || [],
            } : null,
          };
        }),
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + filtered.length < totalCount,
        },
      });
    }

    if (type === 'agents') {
      // Get agent rankings based on AI analysis data
      // Group by agent name and calculate stats from BOTH agent and customer sentiment
      const agentData = await (startDate && endDate
        ? prisma.$queryRaw<any[]>`
            SELECT
              ta."agentName" as agent_name,
              COUNT(*) as call_count,
              AVG(t.duration_seconds) as avg_duration,

              -- Agent Performance Metrics (used for scoring/ranking)
              AVG(ta."agentSentimentScore") as avg_agent_score,
              SUM(CASE WHEN ta."agentSentiment" = 'positive' THEN 1 ELSE 0 END) as agent_positive_count,
              SUM(CASE WHEN ta."agentSentiment" = 'neutral' THEN 1 ELSE 0 END) as agent_neutral_count,
              SUM(CASE WHEN ta."agentSentiment" = 'negative' THEN 1 ELSE 0 END) as agent_negative_count,

              -- Customer Sentiment Metrics (for comparison)
              AVG(ta."customerSentimentScore") as avg_customer_score,
              SUM(CASE WHEN ta."customerSentiment" = 'positive' THEN 1 ELSE 0 END) as customer_positive_count,
              SUM(CASE WHEN ta."customerSentiment" = 'neutral' THEN 1 ELSE 0 END) as customer_neutral_count,
              SUM(CASE WHEN ta."customerSentiment" = 'negative' THEN 1 ELSE 0 END) as customer_negative_count,

              MAX(t.department) as department
            FROM "TranscriptAnalysis" ta
            INNER JOIN transcripts t ON t.vendor_call_key = ta."vendorCallKey"
            WHERE ta."agentName" IS NOT NULL AND ta."agentName" != 'Unknown'
              AND t.call_start >= ${startDate}::timestamp
              AND t.call_start < (${endDate}::timestamp + INTERVAL '1 day')
              AND t.duration_seconds > 60
            GROUP BY ta."agentName"
            HAVING COUNT(*) >= 1
            ORDER BY avg_agent_score DESC NULLS LAST
          `
        : prisma.$queryRaw<any[]>`
            SELECT
              ta."agentName" as agent_name,
              COUNT(*) as call_count,
              AVG(t.duration_seconds) as avg_duration,

              -- Agent Performance Metrics (used for scoring/ranking)
              AVG(ta."agentSentimentScore") as avg_agent_score,
              SUM(CASE WHEN ta."agentSentiment" = 'positive' THEN 1 ELSE 0 END) as agent_positive_count,
              SUM(CASE WHEN ta."agentSentiment" = 'neutral' THEN 1 ELSE 0 END) as agent_neutral_count,
              SUM(CASE WHEN ta."agentSentiment" = 'negative' THEN 1 ELSE 0 END) as agent_negative_count,

              -- Customer Sentiment Metrics (for comparison)
              AVG(ta."customerSentimentScore") as avg_customer_score,
              SUM(CASE WHEN ta."customerSentiment" = 'positive' THEN 1 ELSE 0 END) as customer_positive_count,
              SUM(CASE WHEN ta."customerSentiment" = 'neutral' THEN 1 ELSE 0 END) as customer_neutral_count,
              SUM(CASE WHEN ta."customerSentiment" = 'negative' THEN 1 ELSE 0 END) as customer_negative_count,

              MAX(t.department) as department
            FROM "TranscriptAnalysis" ta
            INNER JOIN transcripts t ON t.vendor_call_key = ta."vendorCallKey"
            WHERE ta."agentName" IS NOT NULL AND ta."agentName" != 'Unknown'
              AND t.duration_seconds > 60
            GROUP BY ta."agentName"
            HAVING COUNT(*) >= 1
            ORDER BY avg_agent_score DESC NULLS LAST
          `);

      // Calculate performance tiers based on agent sentiment score
      // Adjusted thresholds to create more top/higher performers
      const calculatePerformanceTier = (score: number): string => {
        if (score >= 0.70) return 'top';        // 70%+ = Top (was 80%)
        if (score >= 0.55) return 'good';       // 55%+ = Good (was 60%)
        if (score >= 0.35) return 'average';    // 35%+ = Average (was 40%)
        if (score >= 0.20) return 'needs-improvement';  // 20%+ = Needs Improvement
        return 'critical';                      // <20% = Critical
      };

      // Transform data into agent stats with BOTH agent and customer sentiment
      const allAgents = agentData.map((row: any) => {
        const callCount = Number(row.call_count);

        // Agent Performance Metrics (used for scoring)
        const agentPositiveCount = Number(row.agent_positive_count);
        const agentNeutralCount = Number(row.agent_neutral_count);
        const agentNegativeCount = Number(row.agent_negative_count);
        const avgAgentScore = Number(row.avg_agent_score) || 0;

        // Customer Sentiment Metrics (for comparison)
        const customerPositiveCount = Number(row.customer_positive_count);
        const customerNeutralCount = Number(row.customer_neutral_count);
        const customerNegativeCount = Number(row.customer_negative_count);
        const avgCustomerScore = Number(row.avg_customer_score) || 0;

        return {
          name: row.agent_name,
          department: row.department || 'Unknown',
          callCount,
          avgDuration: Number(row.avg_duration) || 0,

          // Agent Performance (PRIMARY - used for ranking)
          agentPositiveRate: (agentPositiveCount / callCount) * 100,
          agentNegativeRate: (agentNegativeCount / callCount) * 100,
          agentNeutralRate: (agentNeutralCount / callCount) * 100,
          agentSentimentScore: avgAgentScore,

          // Customer Sentiment (SECONDARY - for comparison)
          customerPositiveRate: (customerPositiveCount / callCount) * 100,
          customerNegativeRate: (customerNegativeCount / callCount) * 100,
          customerNeutralRate: (customerNeutralCount / callCount) * 100,
          customerSentimentScore: avgCustomerScore,

          // Overall Performance Tier (based on agent score ONLY)
          performanceTier: calculatePerformanceTier(avgAgentScore),
          recentCalls: [], // Would need additional query for recent calls

          // DEPRECATED: Keep for backwards compatibility
          positiveRate: (agentPositiveCount / callCount) * 100,
          negativeRate: (agentNegativeCount / callCount) * 100,
          neutralRate: (agentNeutralCount / callCount) * 100,
          sentimentScore: avgAgentScore,
        };
      });

      // Calculate distribution
      const distribution = allAgents.reduce(
        (acc, agent) => {
          acc[agent.performanceTier]++;
          return acc;
        },
        { top: 0, good: 0, average: 0, needsImprovement: 0, critical: 0 } as Record<string, number>
      );

      const totalCalls = allAgents.reduce((sum, agent) => sum + agent.callCount, 0);

      return NextResponse.json({
        success: true,
        data: {
          totalAgents: allAgents.length,
          totalCalls,
          topPerformers: allAgents.filter(a => a.performanceTier === 'top').slice(0, 10),
          needsImprovement: allAgents.filter(a => a.performanceTier === 'needs-improvement' || a.performanceTier === 'critical').slice(0, 10),
          highestVolume: [...allAgents].sort((a, b) => b.callCount - a.callCount).slice(0, 10),
          allAgents,
          distribution,
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Invalid type parameter. Use "summary", "transcripts", or "agents"',
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
