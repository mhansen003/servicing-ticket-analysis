import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Cron Job: Sync Transcripts from Domo
 *
 * Runs daily at 6 AM to:
 * 1. Fetch new transcripts from Domo (last 2 days)
 * 2. Import to database
 * 3. Run AI analysis on new transcripts
 *
 * Secured with Vercel Cron Secret
 */
export async function GET(request: NextRequest) {
  // Verify this is a legitimate cron request from Vercel
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('🕐 [CRON] Starting transcript sync...');

    // Calculate 2-day lookback (since Domo loads data overnight)
    const now = new Date();
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const startDate = twoDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD
    const endDate = now.toISOString().split('T')[0];

    console.log(`📅 [CRON] Syncing from ${startDate} to ${endDate} (2-day lookback)`);

    // Run the sync script
    const scriptPath = 'node scripts/sync-domo-transcripts.mjs';
    const command = `cd /c/GitHub/servicing-ticket-analysis && ${scriptPath} --start-date ${startDate} --end-date ${endDate}`;

    const { stdout, stderr } = await execAsync(command, {
      timeout: 600000, // 10 minute timeout
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });

    console.log('✅ [CRON] Sync completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Transcript sync completed',
      dateRange: { startDate, endDate },
      output: stdout,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [CRON] Sync failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
