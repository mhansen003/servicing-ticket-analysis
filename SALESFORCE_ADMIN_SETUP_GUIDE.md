# Salesforce Admin Setup Guide
## Enable API Access for Recording URL Integration

This guide is for the Salesforce administrator to configure the Connected App for API access.

## Problem

The Connected App exists but needs to be configured to allow server-to-server authentication via Client Credentials Flow.

**Current Error:** `"no client credentials user enabled"`

## Solution: Configure Client Credentials Flow

### Step 1: Locate the Connected App

1. Log into Salesforce as an administrator
2. Go to **Setup** (gear icon in top right)
3. In Quick Find, search for: **"App Manager"**
4. Find the Connected App with Client ID: `3MVG9Xl3BC6VHB.aRzYaN9JVzXo9ILzcbhlr7xQN6kvFEvE9r61iV0NC3zBcYqXMsTRO.Z71x4d3cGmqLFzDs`
5. Click the dropdown arrow next to the app → Select **"Manage"**

### Step 2: Enable Client Credentials Flow

1. Click **"Edit Policies"**
2. Scroll down to the **"Client Credentials Flow"** section
3. Check the box: **☑ Enable Client Credentials Flow**
4. You'll see a **"Run As"** dropdown appear

### Step 3: Configure the "Run As" User

The "Run As" user is the Salesforce user account on whose behalf the API will execute requests. This user's permissions determine what data the integration can access.

**Option A: Use an Existing API User (Recommended)**
- Select an existing integration/API user from the "Run As" dropdown
- This user must have:
  - API Enabled permission
  - Read access to VoiceCall and VoiceCallRecording objects

**Option B: Create a New API-Only User (More Secure)**
1. Go to **Setup** → **Users** → **Profiles**
2. Clone the **"API Only System Integrations"** profile
3. Name it: **"DOMO Recording Integration API"**
4. Edit the profile and ensure it has:
   - **Object Permissions:**
     - VoiceCall: Read
     - VoiceCallRecording: Read
   - **System Permissions:**
     - API Enabled: ☑
5. Create a new user:
   - Go to **Setup** → **Users** → **New User**
   - Username: `integration.domo.recordings@cmgfi.com`
   - Email: `mhansen@cmgfi.com` (for notifications)
   - Profile: **DOMO Recording Integration API**
   - User License: **Salesforce API Integration** (cost-effective)
   - Active: ☑
6. Return to the Connected App → **"Edit Policies"**
7. Select this new user in the **"Run As"** dropdown

### Step 4: Save Configuration

1. Click **"Save"** to apply changes
2. The Connected App is now ready for Client Credentials authentication

## Step 5: Verify Object Access

Ensure the "Run As" user can access the required objects:

1. Go to **Setup** → **Object Manager**
2. Find and click on **"VoiceCall"**
3. Click **"Details"**
4. Verify the "Run As" user's profile has **Read** access
5. Repeat for **"VoiceCallRecording"** object

## Step 6: Test the Integration

Once configured, the development team can test the connection:

```bash
node scripts/test-salesforce-auth.mjs
```

If successful, you should see:
```
✅ Authenticated with Salesforce API (Client Credentials)
✅ All tests passed!
```

## Alternative: Enable Username-Password Flow (Less Secure)

If Client Credentials Flow cannot be enabled for organizational reasons, you can enable Username-Password flow as a temporary solution:

1. Go to **Setup** → **Identity** → **OAuth and OpenID Connect Settings**
2. Check: **☑ Allow OAuth Username-Password Flows**
3. Click **"Save"**

**Note:** This is less secure and not recommended for production integrations.

## Troubleshooting

### Error: "no client credentials user enabled"
- **Cause:** Client Credentials Flow is not enabled, or no "Run As" user is configured
- **Fix:** Follow Step 2 and Step 3 above

### Error: "invalid_client"
- **Cause:** Client ID or Secret is incorrect
- **Fix:** Verify the Connected App credentials match the `.env.local` file

### Error: "user hasn't approved this consumer"
- **Cause:** The Connected App needs admin pre-approval
- **Fix:** In Connected App → Manage → Edit Policies → Set "Permitted Users" to "Admin approved users are pre-authorized"

### No VoiceCallRecording Records Found
- **Cause:** Call recording may not be enabled
- **Fix:** Go to **Setup** → **Service Cloud Voice** → Enable call recording

## Security Best Practices

1. **Use API-Only User:** Create a dedicated API user with minimal required permissions
2. **Principle of Least Privilege:** Grant only Read access to VoiceCall and VoiceCallRecording objects
3. **Monitor API Usage:** Regularly review API call logs in **Setup** → **System Overview** → **API Usage**
4. **Rotate Secrets:** Periodically regenerate the Consumer Secret for the Connected App
5. **IP Restrictions:** Consider adding IP restrictions to the Connected App for additional security

## Questions?

Contact: Mark Hansen (mhansen@cmgfi.com)

Connected App Details:
- **Client ID:** 3MVG9Xl3BC6VHB.aRzYaN9JVzXo9ILzcbhlr7xQN6kvFEvE9r61iV0NC3zBcYqXMsTRO.Z71x4d3cGmqLFzDs
- **Instance:** https://cmgfinancialfscorg.my.salesforce.com
