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

    // Build where clause
    const where: any = {};

    if (category) {
      where.category = category;
    }

    if (sentiment) {
      where.sentiment = sentiment;
    }

    if (agent) {
      where.agentName = {
        contains: agent,
        mode: 'insensitive',
      };
    }

    if (dateFrom || dateTo) {
      where.callDate = {};
      if (dateFrom) {
        where.callDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.callDate.lte = new Date(dateTo);
      }
    }

    if (escalated === 'true') {
      where.wasEscalated = true;
    } else if (escalated === 'false') {
      where.wasEscalated = false;
    }

    // Fetch transcripts
    const [transcripts, total] = await Promise.all([
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
