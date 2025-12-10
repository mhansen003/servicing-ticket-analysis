# Domo Live Data Integration Setup

This guide will help you set up automatic hourly syncs of transcript data from Domo.

## 📋 Prerequisites

- ✅ Domo API credentials (Client ID & Secret)
- ✅ Access to Domo IVR transcript dataset
- ✅ PostgreSQL database (Neon)
- ✅ OpenRouter API key
- ✅ Node.js 18+ installed

## 🚀 Quick Start

### 1. Environment Configuration

The Domo credentials have already been added to `.env.local`:

```bash
DOMO_CLIENT_ID=6a0ba34b-24eb-44dc-bca4-e7a51c13fd15
DOMO_CLIENT_SECRET=ca89501e606ac2cc000b01810cf9f32e147563d2734be1ac3a0881680fd52182
DOMO_ENVIRONMENT=cmgfi
DOMO_DATASET_ID=f76ad4b9-079c-4aba-8c34-4a226b3e332e
```

### 2. Install Dependencies

```bash
npm install node-fetch
```

### 3. Backfill Historical Data (Dec 3rd onwards)

Run this ONCE to import all historical transcripts:

```bash
# Dry run first to see what would be imported
node scripts/backfill-domo-transcripts.mjs --start-date 2024-12-03 --dry-run

# If it looks good, run the actual backfill
node scripts/backfill-domo-transcripts.mjs --start-date 2024-12-03
```

This will:
- ✅ Fetch all transcripts from Dec 3, 2024 to today
- ✅ Import them to the `transcripts` table
- ✅ Run AI analysis on each transcript
- ✅ Save analysis to `TranscriptAnalysis` table

**Note**: This may take several hours depending on the volume of data.

### 4. Test Hourly Sync

Test the hourly sync script to make sure it works:

```bash
# Fetch only transcripts from the last 2 hours
node scripts/sync-domo-transcripts.mjs --start-date $(date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%S)
```

### 5. Set Up Automated Hourly Sync

#### Option A: Windows Task Scheduler

1. Open Task Scheduler
2. Create a new task:
   - **Name**: Domo Transcript Sync
   - **Trigger**: Daily, repeat every 1 hour for 24 hours
   - **Action**: Start a program
   - **Program**: `node`
   - **Arguments**: `C:\GitHub\servicing-ticket-analysis\scripts\sync-domo-transcripts.mjs --start-date $(date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%S)`
   - **Start in**: `C:\GitHub\servicing-ticket-analysis`

#### Option B: Vercel Cron Jobs

Add to your `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/sync-domo",
      "schedule": "0 * * * *"
    }
  ]
}
```

Then create `/api/sync-domo/route.ts`:

```typescript
import { syncTranscripts } from '@/scripts/sync-domo-transcripts.mjs';

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Fetch transcripts from last 2 hours to catch any delayed data
    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
    const startDate = twoHoursAgo.toISOString().split('T')[0];

    const stats = await syncTranscripts({ startDate });

    return Response.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Sync failed:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
```

#### Option C: Node-cron (if running on a server)

Create `scripts/cron-scheduler.mjs`:

```javascript
import cron from 'node-cron';
import { syncTranscripts } from './sync-domo-transcripts.mjs';

// Run every hour at minute 0
cron.schedule('0 * * * *', async () => {
  console.log('🕐 Starting hourly Domo sync...');

  const twoHoursAgo = new Date();
  twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
  const startDate = twoHoursAgo.toISOString().split('T')[0];

  try {
    await syncTranscripts({ startDate });
    console.log('✅ Hourly sync complete');
  } catch (error) {
    console.error('❌ Hourly sync failed:', error);
  }
});

console.log('⏰ Cron scheduler started - will sync every hour');
```

Run with: `node scripts/cron-scheduler.mjs`

## 📊 Monitoring

### Check Sync Status

```bash
# View recent syncs in database
psql $DATABASE_URL -c "SELECT COUNT(*), DATE(call_start) FROM transcripts GROUP BY DATE(call_start) ORDER BY DATE(call_start) DESC LIMIT 30;"
```

### View Analysis Progress

```bash
# Count analyzed vs total transcripts
psql $DATABASE_URL -c "SELECT
  (SELECT COUNT(*) FROM transcripts) as total_transcripts,
  (SELECT COUNT(*) FROM \"TranscriptAnalysis\") as analyzed_transcripts;"
```

## 🔧 Troubleshooting

### Domo Authentication Errors

If you see `401 Unauthorized`:
- Verify `DOMO_CLIENT_ID` and `DOMO_CLIENT_SECRET` are correct
- Check that the API client has `data` scope enabled in Domo

### Missing Fields

If transcripts are missing data:
- Check the Domo dataset schema matches our expected fields
- Update the `transformDomoRecord()` function in `sync-domo-transcripts.mjs`

### Analysis Errors

If AI analysis fails:
- Verify `OPENROUTER_API_KEY` is valid
- Check OpenRouter account balance
- Look for rate limiting issues

## 📝 Manual Commands

```bash
# Sync last 24 hours only
node scripts/sync-domo-transcripts.mjs --start-date $(date -d '1 day ago' +%Y-%m-%d)

# Sync specific date range
node scripts/sync-domo-transcripts.mjs --start-date 2024-12-10 --end-date 2024-12-15

# Dry run (no changes)
node scripts/sync-domo-transcripts.mjs --start-date 2024-12-10 --dry-run

# Test with limit
node scripts/sync-domo-transcripts.mjs --limit 10
```

## 🎯 Next Steps

1. ✅ Run backfill to get historical data
2. ✅ Test hourly sync
3. ✅ Set up automated scheduling
4. ✅ Monitor sync status daily for the first week
5. ✅ Set up alerts for sync failures (optional)

## 📞 Support

For issues or questions:
- Check the Domo API documentation: https://developer.domo.com/
- Review error logs in the console
- Contact IT for Domo access issues
