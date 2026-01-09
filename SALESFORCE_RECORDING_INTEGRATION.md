# Salesforce Recording URL Integration Plan

## Overview

This document outlines how to integrate Salesforce VoiceCallRecording data to retrieve recording URLs for call transcripts stored in DOMO.

## Current State

### Available Data in DOMO
- `VoiceCallId` - Salesforce VoiceCall record ID (e.g., `0LQWQ00000ERARR4A5`)
- `VendorCallKey` - Amazon Connect Contact ID (e.g., `120f2505-00c8-4139-bba1-3153baf067f8`)
- Call metadata (timestamps, agent info, transcript text)

### Missing Data
- Recording URLs (stored in Salesforce `VoiceCallRecording` object)

## Solution: Query Salesforce REST API

### Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│    DOMO     │      │  Our System  │      │   Salesforce    │
│  Dataset    │─────▶│              │─────▶│  REST API       │
│             │      │  Sync Script │      │  VoiceCall      │
└─────────────┘      │              │      │  Recording      │
                     └──────────────┘      └─────────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Database   │
                     │  + Recording │
                     │     URLs     │
                     └──────────────┘
```

## Implementation Steps

### 1. Salesforce Setup (Required from Admin)

#### A. Create Connected App
1. Navigate to **Setup → App Manager → New Connected App**
2. Basic Information:
   - Connected App Name: `DOMO Transcript Recording Integration`
   - API Name: `DOMO_Transcript_Recording_Integration`
   - Contact Email: [your email]

3. API (Enable OAuth Settings):
   - ✅ Enable OAuth Settings
   - ✅ Enable Client Credentials Flow
   - Callback URL: `https://localhost` (not used for client credentials)
   - Selected OAuth Scopes:
     - `api` - Full API access
     - `refresh_token, offline_access` - Maintain access

4. Save and retrieve:
   - Consumer Key (Client ID)
   - Consumer Secret (Client Secret)

#### B. Create Integration User (Optional but Recommended)
1. Navigate to **Setup → Users → New User**
2. User Details:
   - Username: `integration.domo@yourcompany.com`
   - Email: [your email]
   - Profile: **API Only System Integrations**
   - License: **Salesforce API Integration**

3. Assign Permission Sets:
   - Read access to `VoiceCall` and `VoiceCallRecording` objects
   - Follow least privilege principle

#### C. Configure Connected App for Client Credentials
1. Navigate to created Connected App
2. Click **Manage**
3. Edit Policies:
   - Client Credentials Flow: **Enabled**
   - Run As: Select the integration user created above
4. Save

### 2. Environment Variables

Add to `.env.local`:

```bash
# Salesforce API Configuration
SALESFORCE_INSTANCE_URL=https://yourinstance.my.salesforce.com
SALESFORCE_CLIENT_ID=your_consumer_key_here
SALESFORCE_CLIENT_SECRET=your_consumer_secret_here
SALESFORCE_API_VERSION=v61.0
```

### 3. Database Schema Changes

Update `prisma/schema.prisma`:

```prisma
model Transcript {
  id                  Int       @id @default(autoincrement())
  vendor_call_key     String    @unique
  voice_call_id       String?   // Salesforce VoiceCall ID
  recording_url       String?   // NEW: Recording URL from Salesforce
  recording_media_src String?   // NEW: MediaSrc from VoiceCallRecording
  call_start          DateTime
  call_end            DateTime
  duration_seconds    Int
  // ... existing fields ...
}
```

Run migration:
```bash
npx prisma migrate dev --name add_recording_urls
```

### 4. Salesforce API Client

Create `scripts/salesforce-api.mjs`:

```javascript
import fetch from 'node-fetch';

export class SalesforceAPI {
  constructor(instanceUrl, clientId, clientSecret, apiVersion = 'v61.0') {
    this.instanceUrl = instanceUrl;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.apiVersion = apiVersion;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Authenticate using OAuth 2.0 Client Credentials Flow
   */
  async authenticate() {
    const tokenUrl = `${this.instanceUrl}/services/oauth2/token`;

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Salesforce authentication failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.instanceUrl = data.instance_url; // Use returned instance URL

    // Token expires in 2 hours, set expiry with 5 min buffer
    this.tokenExpiry = Date.now() + (115 * 60 * 1000);

    console.log('✅ Authenticated with Salesforce API');
    return this.accessToken;
  }

  /**
   * Get valid access token (authenticate if needed)
   */
  async getAccessToken() {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      await this.authenticate();
    }
    return this.accessToken;
  }

  /**
   * Execute SOQL Query
   */
  async query(soql) {
    const token = await this.getAccessToken();
    const encodedQuery = encodeURIComponent(soql);
    const url = `${this.instanceUrl}/services/data/${this.apiVersion}/query/?q=${encodedQuery}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Salesforce query failed: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  /**
   * Get recording URL for a VoiceCall
   */
  async getRecordingUrl(voiceCallId) {
    const soql = `SELECT Id, VoiceCallId, MediaSrc, CallRecordingUrl
                  FROM VoiceCallRecording
                  WHERE VoiceCallId = '${voiceCallId}'
                  LIMIT 1`;

    const result = await this.query(soql);

    if (result.totalSize === 0) {
      return null;
    }

    return {
      recordingId: result.records[0].Id,
      voiceCallId: result.records[0].VoiceCallId,
      mediaSrc: result.records[0].MediaSrc,
      callRecordingUrl: result.records[0].CallRecordingUrl,
    };
  }

  /**
   * Batch get recording URLs for multiple VoiceCalls
   */
  async getRecordingUrls(voiceCallIds) {
    if (!voiceCallIds || voiceCallIds.length === 0) {
      return [];
    }

    // Salesforce SOQL has a limit on IN clause items (~1000)
    const batchSize = 500;
    const results = [];

    for (let i = 0; i < voiceCallIds.length; i += batchSize) {
      const batch = voiceCallIds.slice(i, i + batchSize);
      const ids = batch.map(id => `'${id}'`).join(',');

      const soql = `SELECT Id, VoiceCallId, MediaSrc, CallRecordingUrl
                    FROM VoiceCallRecording
                    WHERE VoiceCallId IN (${ids})`;

      const result = await this.query(soql);
      results.push(...result.records);
    }

    return results;
  }
}
```

### 5. Enhanced Sync Script

Update `scripts/daily-sync-domo.mjs` to include Salesforce recording lookup:

```javascript
import { SalesforceAPI } from './salesforce-api.mjs';

// Initialize Salesforce client
const salesforce = new SalesforceAPI(
  process.env.SALESFORCE_INSTANCE_URL,
  process.env.SALESFORCE_CLIENT_ID,
  process.env.SALESFORCE_CLIENT_SECRET
);

// After fetching from DOMO, enrich with recording URLs
async function enrichWithRecordingUrls(domoRecords) {
  // Extract VoiceCallIds
  const voiceCallIds = domoRecords
    .map(r => r.VoiceCallId)
    .filter(Boolean);

  console.log(`🔍 Fetching recording URLs for ${voiceCallIds.length} calls...`);

  // Batch query Salesforce
  const recordings = await salesforce.getRecordingUrls(voiceCallIds);

  // Create lookup map
  const recordingMap = new Map(
    recordings.map(r => [r.VoiceCallId, r])
  );

  // Enrich DOMO records
  const enriched = domoRecords.map(record => ({
    ...record,
    recordingUrl: recordingMap.get(record.VoiceCallId)?.CallRecordingUrl || null,
    recordingMediaSrc: recordingMap.get(record.VoiceCallId)?.MediaSrc || null,
  }));

  const withRecordings = enriched.filter(r => r.recordingUrl).length;
  console.log(`✅ Found recording URLs for ${withRecordings}/${domoRecords.length} calls`);

  return enriched;
}
```

### 6. API Endpoint Updates

Update `src/app/api/transcripts/route.ts` to return recording URLs:

```typescript
// GET /api/transcripts
export async function GET(request: Request) {
  const transcripts = await prisma.transcript.findMany({
    select: {
      id: true,
      vendor_call_key: true,
      voice_call_id: true,
      recording_url: true,        // NEW
      recording_media_src: true,  // NEW
      call_start: true,
      call_end: true,
      // ... other fields
    },
  });

  return Response.json(transcripts);
}
```

### 7. Frontend Integration

Add audio player component for recordings:

```tsx
// components/RecordingPlayer.tsx
export function RecordingPlayer({ recordingUrl }: { recordingUrl: string | null }) {
  if (!recordingUrl) {
    return <span className="text-gray-400">No recording available</span>;
  }

  return (
    <audio controls className="w-full">
      <source src={recordingUrl} type="audio/mpeg" />
      Your browser does not support the audio element.
    </audio>
  );
}
```

## Testing Plan

### 1. Test Salesforce Authentication
```bash
node scripts/test-salesforce-auth.mjs
```

### 2. Test Recording Query
```bash
node scripts/test-salesforce-recordings.mjs
```

### 3. Test Full Sync
```bash
node scripts/daily-sync-domo.mjs --sample 10
```

## Important Considerations

### Authentication
- Client credentials flow doesn't produce refresh tokens
- Request new access token when expired (every ~2 hours)
- Store credentials securely in environment variables

### Rate Limits
- Salesforce API has daily limits (depends on license)
- Batch queries to minimize API calls
- Consider caching recording URLs in database

### Recording Access
- Users must have Salesforce permissions to access recordings
- Recording URLs may require active Salesforce session
- Consider proxy through your backend for access control

### Data Privacy
- Recording URLs may contain sensitive data
- Implement proper access controls
- Log all recording access for audit purposes

## Cost Analysis

### API Calls
- Initial sync: 1 call per 500 VoiceCallIds
- For 10,000 calls: ~20 API calls
- Daily sync: Minimal (only new calls)

### Salesforce License
- API Only System Integrations license recommended
- Cost-effective for server-to-server integrations

## Rollout Strategy

### Phase 1: Setup (Week 1)
1. Create Salesforce Connected App
2. Configure integration user
3. Test authentication

### Phase 2: Development (Week 1-2)
1. Implement Salesforce API client
2. Update database schema
3. Enhance sync scripts

### Phase 3: Testing (Week 2)
1. Test with sample data
2. Verify recording URL access
3. Load testing

### Phase 4: Deployment (Week 3)
1. Backfill existing records
2. Enable in production
3. Monitor API usage

## Troubleshooting

### Common Issues

**Authentication Failed**
- Verify Client ID and Secret
- Check Connected App is approved
- Ensure Client Credentials Flow is enabled

**No Recording URLs Found**
- Verify recordings are enabled in Salesforce
- Check VoiceCallRecording object has data
- Confirm VoiceCallId matches exactly

**API Rate Limit Exceeded**
- Reduce batch size
- Implement exponential backoff
- Contact Salesforce to increase limits

## References

- [Salesforce VoiceCallRecording Object Reference](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_voicecallrecording.htm)
- [OAuth 2.0 Client Credentials Flow](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_client_credentials_flow.htm)
- [Salesforce REST API Query](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/dome_query.htm)
- [Client Credentials Flow Blog](https://developer.salesforce.com/blogs/2023/03/using-the-client-credentials-flow-for-easier-api-authentication)
