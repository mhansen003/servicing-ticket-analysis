# Daily DOMO Sync - Documentation

## Overview

The daily DOMO sync job runs automatically every day at **6 AM UTC** to keep the database synchronized with the latest call transcripts from DOMO.

## How It Works

### Delta-Only Sync Strategy

The sync is **incremental** and **efficient** - it only fetches and processes **NEW** data:

1. **Query Database**: Checks the database for the most recent transcript date
2. **Calculate Delta**: Determines which dates need to be synced (since last sync)
3. **Baseline Protection**: Never goes back before **Dec 1, 2025** (our baseline cutoff date)
4. **Fetch New Data**: Retrieves only new transcripts from DOMO API
5. **Import**: Upserts transcripts to database (updates existing, creates new)
6. **AI Analysis**: Runs AI sentiment/topic analysis ONLY on newly imported records

### Benefits

- ✅ **Efficient**: Only processes new data, not entire dataset
- ✅ **Fast**: Minimal API calls and database operations
- ✅ **Cost-effective**: Reduces AI analysis costs by avoiding re-analysis
- ✅ **Automatic**: Runs daily without manual intervention
- ✅ **Safe**: Never syncs historical data before Dec 1, 2025

## Configuration

### Cron Schedule

**File**: `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-transcripts",
      "schedule": "0 6 * * *"
    }
  ]
}
```

**Schedule**: `0 6 * * *` = Every day at 6:00 AM UTC

### Scripts

1. **Daily Sync Script**: `scripts/daily-sync-domo.mjs`
   - Delta-only sync
   - Auto-determines start date from database
   - Never goes back before Dec 1, 2025

2. **Manual Full Sync Script**: `scripts/sync-domo-transcripts.mjs`
   - For manual/ad-hoc syncs
   - Allows custom date ranges
   - Use for backfills or catch-up syncs

### API Endpoint

**Endpoint**: `/api/cron/sync-transcripts`

**File**: `src/app/api/cron/sync-transcripts/route.ts`

**Security**: Protected by Vercel Cron Secret (`CRON_SECRET` env var)

## Manual Testing

### Test Daily Sync (Dry Run)

```bash
cd C:\GitHub\servicing-ticket-analysis
node scripts/daily-sync-domo.mjs --dry-run
```

This will:
- Query database for last sync date
- Show what WOULD be synced
- NOT actually import or analyze anything

### Run Daily Sync Manually

```bash
cd C:\GitHub\servicing-ticket-analysis
node scripts/daily-sync-domo.mjs
```

⚠️ **Warning**: This will actually fetch, import, and analyze data!

### Test Full Sync with Custom Dates

```bash
node scripts/sync-domo-transcripts.mjs --start-date 2025-12-01 --end-date 2025-12-10
```

## Environment Variables

Required environment variables (set in `.env.local`):

```env
DATABASE_URL=postgresql://...
DOMO_CLIENT_ID=...
DOMO_CLIENT_SECRET=...
DOMO_DATASET_ID=...
DOMO_ENVIRONMENT=cmgfi
OPENROUTER_API_KEY=...
CRON_SECRET=...  # For Vercel Cron authentication
```

## Monitoring

### Check Last Sync

The UI shows the most recent import:
- **Location**: Transcript Analytics > Global Date Range Filter
- **Format**: "9,328 imports (last: Dec 10, 2025)"

### Cron Logs

View cron job logs in Vercel:
1. Go to Vercel Dashboard
2. Select your project
3. Navigate to "Deployments" > "Functions" > "Crons"
4. View execution logs

### Database Check

Query the most recent transcript:

```sql
SELECT vendor_call_key, call_start
FROM transcripts
ORDER BY call_start DESC
LIMIT 1;
```

## Troubleshooting

### Sync Failed

1. **Check Vercel Logs**: See error messages in Vercel dashboard
2. **Verify Environment Variables**: Ensure all env vars are set correctly
3. **Test DOMO Connection**: Run `node scripts/daily-sync-domo.mjs --dry-run`
4. **Check Database**: Ensure DATABASE_URL is correct and database is accessible

### Missing Data

If you notice missing transcripts:

1. **Check Date Range**: Verify the sync covered the correct dates
2. **Manual Sync**: Run a manual sync for specific dates:
   ```bash
   node scripts/sync-domo-transcripts.mjs --start-date YYYY-MM-DD --end-date YYYY-MM-DD
   ```

### Cron Not Running

1. **Verify `vercel.json`**: Ensure cron configuration is correct
2. **Check Deployment**: Cron jobs only run in production, not preview deployments
3. **Verify CRON_SECRET**: Ensure the secret is set in Vercel environment variables

## Best Practices

### Daily Operations

- ✅ Let the cron job run automatically - no manual intervention needed
- ✅ Monitor the UI tag to see last import date
- ✅ Check Vercel logs weekly to ensure no failures

### Manual Syncs

Only run manual syncs for:
- 🔧 Backfilling historical data
- 🔧 Recovering from sync failures
- 🔧 Testing new features

### Data Baseline

- 🚫 **Never sync before Dec 1, 2025** - we don't need historical data
- ✅ The script enforces this automatically
- ✅ Manual syncs should also respect this baseline

## Maintenance

### Updating the Sync Logic

1. Edit `scripts/daily-sync-domo.mjs`
2. Test with `--dry-run` flag
3. Commit and push to trigger Vercel deployment
4. Monitor first production run

### Changing Schedule

1. Edit `vercel.json` cron schedule
2. Use [crontab.guru](https://crontab.guru) to verify schedule
3. Deploy to production

### Emergency Stop

To disable the daily sync:
1. Remove cron configuration from `vercel.json`
2. Deploy to production
3. Re-add when ready to resume

---

**Last Updated**: December 2025
