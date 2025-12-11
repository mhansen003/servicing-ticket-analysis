import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Cron Job: Daily DOMO Delta Sync
 *
 * Runs daily at 6 AM PST (2 PM UTC) to:
 * 1. Query database for most recent transcript date
 * 2. Fetch ONLY NEW transcripts from Domo since that date (delta only)
 * 3. Never goes back before Dec 1, 2025 (baseline cutoff)
 * 4. Import to database
 * 5. Run AI analysis ONLY on newly imported transcripts
 *
 * This is much more efficient than syncing all data every day!
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
    console.log('🕐 [CRON] Starting daily delta sync...');

    // Run the delta-only sync script
    // The script automatically determines the start date by querying the database
    // for the most recent transcript, then syncs only new data since that date
    const scriptPath = 'node scripts/daily-sync-domo.mjs';
    const command = `cd /c/GitHub/servicing-ticket-analysis && ${scriptPath}`;

    const { stdout, stderr } = await execAsync(command, {
      timeout: 600000, // 10 minute timeout
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });

    console.log('✅ [CRON] Daily delta sync completed successfully');
    if (stderr) {
      console.warn('[CRON] Stderr output:', stderr);
    }

    return NextResponse.json({
      success: true,
      message: 'Daily delta sync completed',
      output: stdout,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [CRON] Daily delta sync failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
