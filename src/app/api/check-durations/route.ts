import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

/**
 * Check Duration Values API
 * Query sample records to see their actual duration_seconds values
 */

export async function GET() {
  try {
    // Get sample of records with various vendor call keys
    const sampleKeys = [
      'ce40174a-c79e-4071-b8e3-189f6c5e3b33', // Has duration 9 in TSV
      'ccea536a-7055-4431-9d59-c7c1a81b6666', // Has duration 154 in TSV
      '06b55a20-b66e-4b64-a3d7-52ddacfdcebe', // Has duration 346 in TSV
    ];

    const samples = await prisma.transcripts.findMany({
      where: {
        vendor_call_key: {
          in: sampleKeys,
        },
      },
      select: {
        vendor_call_key: true,
        duration_seconds: true,
        call_start: true,
        call_end: true,
      },
    });

    // Get overall stats
    const stats = await prisma.$queryRaw<Array<{
      total: bigint;
      null_count: bigint;
      zero_count: bigint;
      positive_count: bigint;
    }>>`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN duration_seconds IS NULL THEN 1 END) as null_count,
        COUNT(CASE WHEN duration_seconds = 0 THEN 1 END) as zero_count,
        COUNT(CASE WHEN duration_seconds > 0 THEN 1 END) as positive_count
      FROM transcripts
    `;

    return NextResponse.json({
      success: true,
      samples,
      stats: {
        total: Number(stats[0].total),
        null_count: Number(stats[0].null_count),
        zero_count: Number(stats[0].zero_count),
        positive_count: Number(stats[0].positive_count),
      },
    });
  } catch (error: any) {
    console.error('Check durations error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Failed: ${error.message}`,
      },
      { status: 500 }
    );
  }
}
