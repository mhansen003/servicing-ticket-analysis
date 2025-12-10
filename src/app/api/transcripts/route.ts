import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

/**
 * PHASE 1: Transcript Data API
 *
 * GET /api/transcripts
 *
 * Query parameters:
 * - limit: Number of records to return (default: 100)
 * - offset: Number of records to skip (default: 0)
 * - category: Filter by category
 * - sentiment: Filter by sentiment
 * - agent: Filter by agent name
 * - dateFrom: Filter by date range start
 * - dateTo: Filter by date range end
 * - escalated: Filter escalated calls (true/false)
 * - search: Search text in messages, agent name, department, vendor call key
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const category = searchParams.get('category');
    const sentiment = searchParams.get('sentiment');
    const agent = searchParams.get('agent');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const escalated = searchParams.get('escalated');
    const search = searchParams.get('search');

    // Build where clause
    const where: any = {};

    // Handle search across multiple fields including JSON messages
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        // Search in agent_name
        {
          agent_name: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
        // Search in department
        {
          department: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
        // Search in vendor_call_key
        {
          vendor_call_key: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
        // Search in disposition
        {
          disposition: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (sentiment) {
      where.sentiment = sentiment;
    }

    if (agent) {
      where.agent_name = {
        contains: agent,
        mode: 'insensitive',
      };
    }

    if (dateFrom || dateTo) {
      where.call_start = {};
      if (dateFrom) {
        where.call_start.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.call_start.lte = new Date(dateTo);
      }
    }

    if (escalated === 'true') {
      where.wasEscalated = true;
    } else if (escalated === 'false') {
      where.wasEscalated = false;
    }

    // For text search within messages JSON, we need to use raw SQL
    let transcripts;
    let total;

    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();

      // Use raw SQL to search within JSON messages
      const rawResults = await prisma.$queryRaw<any[]>`
        SELECT *
        FROM transcripts
        WHERE (
          LOWER(agent_name) LIKE ${'%' + searchTerm + '%'}
          OR LOWER(department) LIKE ${'%' + searchTerm + '%'}
          OR LOWER(vendor_call_key) LIKE ${'%' + searchTerm + '%'}
          OR LOWER(disposition) LIKE ${'%' + searchTerm + '%'}
          OR LOWER(messages::text) LIKE ${'%' + searchTerm + '%'}
        )
        ORDER BY call_start DESC NULLS LAST
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      const countResult = await prisma.$queryRaw<any[]>`
        SELECT COUNT(*)::int as count
        FROM transcripts
        WHERE (
          LOWER(agent_name) LIKE ${'%' + searchTerm + '%'}
          OR LOWER(department) LIKE ${'%' + searchTerm + '%'}
          OR LOWER(vendor_call_key) LIKE ${'%' + searchTerm + '%'}
          OR LOWER(disposition) LIKE ${'%' + searchTerm + '%'}
          OR LOWER(messages::text) LIKE ${'%' + searchTerm + '%'}
        )
      `;

      transcripts = rawResults;
      total = countResult[0]?.count || 0;
    } else {
      // Use standard Prisma query for non-search requests
      [transcripts, total] = await Promise.all([
        prisma.transcripts.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: {
            call_start: 'desc',
          },
        }),
        prisma.transcripts.count({ where }),
      ]);
    }

    return NextResponse.json({
      success: true,
      data: transcripts,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching transcripts:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error fetching transcripts: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
