# 🔄 Data Migration Guide

## Why You're Not Seeing Data in the New Tabs

The new **Categories** and **Trends** tabs rely on the enhanced database schema that includes categorization fields (`category`, `subcategory`, `all_issues`, `categorization_confidence`).

### Current Situation:
✅ **Database schema updated** - New columns exist in the database
✅ **Categorization engine built** - Smart categorization logic ready
✅ **23,190 tickets categorized** - Saved to `data/tickets-categorized.csv`
❌ **Data not in database yet** - Existing tickets don't have the new fields populated

---

## Solution Options

### Option 1: Migrate Existing Tickets to Database (Recommended)

This will add categories to all your existing 23,000+ tickets in the database.

#### Steps:

1. **Ensure DATABASE_URL is set**:
   ```bash
   # Check .env.local file
   DATABASE_URL="your-neon-database-url"
   ```

2. **Run the migration script with database access**:
   ```bash
   cd C:\GitHub\servicing-ticket-analysis
   node scripts/migrate-categorization.mjs
   ```

   This will:
   - Connect to your Neon PostgreSQL database
   - Find all tickets without categories
   - Analyze and categorize each one
   - Update the database with categories, subcategories, and confidence scores

3. **Redeploy to Vercel**:
   ```bash
   vercel --prod
   ```

#### Expected Output:
```
🔄 Starting categorization migration...
📊 Found 23190 tickets to categorize

  Processed 100/23190 tickets...
  Processed 200/23190 tickets...
  ...
  Processed 23190/23190 tickets...

✅ Migration complete!
   Processed: 23190 tickets
   Updated: 23190 tickets
```

---

### Option 2: Use Ingestion API to Import Categorized Data

If you prefer a fresh start or want more control:

1. **The categorized CSV is ready**:
   Located at: `C:\GitHub\servicing-ticket-analysis\data\tickets-categorized.csv`

2. **Import using the API**:
   ```bash
   # Convert CSV to JSON and send to API
   # (You can use a script or tool like Postman)

   POST https://your-app.vercel.app/api/ingest-v2
   Content-Type: application/json

   {
     "type": "tickets",
     "format": "csv",
     "mode": "replace",
     "data": "... CSV content ..."
   }
   ```

3. **Or import in batches** (for large datasets):
   - Split the CSV into smaller chunks (1000-5000 rows each)
   - Import each batch using the API
   - Use `mode: "append"` for all batches

---

### Option 3: Generate Sample Data for Testing

To see the tabs working immediately with sample data:

1. **Create sample transcript data**:
   ```bash
   curl -X POST https://your-app.vercel.app/api/ingest-v2 \
     -H "Content-Type: application/json" \
     -d '{
       "type": "transcripts",
       "format": "json",
       "mode": "append",
       "data": [
         {
           "vendorCallKey": "DEMO-001",
           "agentName": "Smith, John",
           "callDate": "2025-11-15",
           "durationSeconds": 300,
           "conversation": [
             {"role": "agent", "text": "Hello, how can I help you today?"},
             {"role": "customer", "text": "I need help making my first payment."},
             {"role": "agent", "text": "I can help with that. Your payment can be made online or by mail."},
             {"role": "customer", "text": "Thank you! That helps."}
           ]
         },
         {
           "vendorCallKey": "DEMO-002",
           "agentName": "Doe, Jane",
           "callDate": "2025-11-20",
           "durationSeconds": 450,
           "conversation": [
             {"role": "agent", "text": "Good morning, this is Jane."},
             {"role": "customer", "text": "I cannot log in to my account!"},
             {"role": "agent", "text": "Let me help you reset your password."},
             {"role": "customer", "text": "Thank you, I really appreciate it."}
           ]
         }
       ]
     }'
   ```

   This will instantly create categorized transcripts that will show up in the new tabs!

---

## Understanding the Categorization

### What Gets Categorized:

**For Tickets:**
- Title and description analyzed
- Category assigned (e.g., "Payment Issues")
- Subcategory assigned (e.g., "First Payment Assistance")
- Confidence score (0.0 - 1.0)
- All issues detected (pipe-separated list)

**For Transcripts:**
- Full conversation analyzed
- Category/subcategory assigned
- Sentiment detected (positive/negative/neutral)
- Resolution status determined
- Customer intent identified
- Quality score calculated

### Example Categorization:

**Input:**
```
Title: "Cannot make first payment"
Description: "I just closed my loan and need to know where to send my first payment"
```

**Output:**
```json
{
  "category": "Payment Issues",
  "subcategory": "First Payment Assistance",
  "confidence": 0.92,
  "allIssues": ["Payment Issues"]
}
```

---

## Verifying the Migration

After running the migration, verify it worked:

### 1. Check Database Directly

Connect to your Neon database and run:
```sql
SELECT
  category,
  subcategory,
  COUNT(*) as count,
  AVG(categorization_confidence) as avg_confidence
FROM tickets
WHERE category IS NOT NULL
GROUP BY category, subcategory
ORDER BY count DESC
LIMIT 20;
```

### 2. Check via API

```bash
curl https://your-app.vercel.app/api/analytics?type=categories
```

Should return JSON with category statistics.

### 3. Check via UI

Visit the deployed app and click on:
- **Categories tab** - Should show pie chart and category breakdown
- **Trends tab** - Should show baseline vs recent comparison

---

## Troubleshooting

### Issue: "DATABASE_URL environment variable not set"

**Solution:**
1. Create `.env.local` file in project root
2. Add: `DATABASE_URL="your-connection-string-here"`
3. Get connection string from Neon dashboard
4. Ensure it's the pooled connection string

### Issue: Migration script fails with timeout

**Solution:**
- Break into smaller batches:
  ```javascript
  // Modify script to process in chunks
  const BATCH_SIZE = 1000;
  for (let i = 0; i < tickets.length; i += BATCH_SIZE) {
    const batch = tickets.slice(i, i + BATCH_SIZE);
    // Process batch...
  }
  ```

### Issue: Vercel deployment has authentication

**Solution:**
- The Vercel deployment has protection enabled
- To test locally: `npm run dev`
- To disable protection: Vercel dashboard → Settings → Deployment Protection
- Or add your IP to allowlist

### Issue: Categories not matching expectations

**Solution:**
- Review `/src/lib/categorization.ts`
- Adjust keyword lists and weights
- Re-run migration after changes
- Categories are customizable!

---

## Next Steps After Migration

Once data is migrated:

1. **Explore the Categories Tab**:
   - See distribution of all categories
   - Click on categories to drill into subcategories
   - Review confidence scores

2. **Explore the Trends Tab**:
   - Change time windows (7, 14, 21, 30, 60, 90 days)
   - Filter by trend type (increasing/decreasing/stable)
   - Identify problematic trends

3. **Use the Analytics API**:
   - Build custom reports
   - Export data for presentations
   - Integrate with other tools

4. **Customize Categorization**:
   - Add new categories in `categorization.ts`
   - Adjust confidence thresholds
   - Add domain-specific keywords

---

## Migration Checklist

- [ ] DATABASE_URL environment variable set
- [ ] Run migration script: `node scripts/migrate-categorization.mjs`
- [ ] Verify data in database (SQL query or API check)
- [ ] Redeploy to Vercel: `vercel --prod`
- [ ] Test Categories tab in browser
- [ ] Test Trends tab in browser
- [ ] Review categorization accuracy
- [ ] Adjust categories if needed
- [ ] Re-run migration if categories changed

---

## Support

If you run into issues:

1. **Check the categorized CSV**:
   - Location: `data/tickets-categorized.csv`
   - Verify last 3 columns have data

2. **Check script output**:
   - Look for error messages
   - Note how many tickets were processed

3. **Check Vercel logs**:
   - Use Vercel dashboard
   - Look for API errors

4. **Test locally first**:
   ```bash
   npm run dev
   # Visit http://localhost:3000
   ```

---

**Migration script location**: `scripts/migrate-categorization.mjs`
**Categorization logic**: `src/lib/categorization.ts`
**Transcript analysis**: `src/lib/transcript-analysis.ts`
