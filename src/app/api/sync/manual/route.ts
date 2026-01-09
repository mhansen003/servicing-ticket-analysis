import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Manual Sync Trigger
 *
 * This endpoint allows you to manually trigger a sync.
 * For testing purposes - in production, use the cron job.
 *
 * Usage: POST /api/sync/manual
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [MANUAL SYNC] Starting...');

    // Simple approach: Call the deployed cron endpoint
    // This way we don't need to replicate all the sync logic
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const cronSecret = process.env.CRON_SECRET;

    const response = await fetch(`${baseUrl}/api/cron/sync-transcripts`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`
      }
    });

    const data = await response.json();

    return NextResponse.json({
      success: response.ok,
      message: 'Manual sync triggered',
      result: data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [MANUAL SYNC] Failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Get sync status
 */
export async function GET(request: NextRequest) {
  try {
    // Return basic info about the sync configuration
    return NextResponse.json({
      configured: !!(
        process.env.DOMO_CLIENT_ID &&
        process.env.DOMO_CLIENT_SECRET &&
        process.env.DOMO_DATASET_ID &&
        process.env.DATABASE_URL &&
        process.env.OPENROUTER_API_KEY
      ),
      cronSchedule: '0 14 * * * (Daily at 6 AM PST)',
      lastCheck: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
