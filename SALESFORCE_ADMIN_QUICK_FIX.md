# Salesforce Admin Quick Fix - Connected App Configuration

## Issue
Getting "authentication failure" error when trying to connect to Salesforce API.

## Connected App Details
- **Client ID:** `3MVG9Xl3BC6VHB.aRzYaN9JVzXo9ILzcbhlr7xQN6kvFEvE9r61iV0NC3zBcYqXMsTRO.Z71x4d3cGmqLFzDs`
- **Instance:** https://cmgfinancialfscorg.my.salesforce.com
- **User:** mhansen@cmgfi.com

## Quick Fix Checklist

Please have your Salesforce admin check these settings:

### Step 1: Find the Connected App
1. Go to **Setup** → **App Manager**
2. Search for the app with Client ID above
3. Click dropdown arrow → **Manage**

### Step 2: Enable Username-Password Flow
1. Click **Edit Policies**
2. Find **"OAuth Policies"** section
3. Check: **☑ Allow OAuth Username-Password Flows**
4. Save

### Step 3: Allow User Self-Authorization
1. In the same **Edit Policies** page
2. Find **"Permitted Users"** dropdown
3. Select: **"All users may self-authorize"**
4. Save

### Step 4: Verify User Has API Access
1. Go to **Setup** → **Users**
2. Find user: mhansen@cmgfi.com
3. Edit user profile
4. Ensure **"API Enabled"** permission is checked
5. Save

### Step 5: Check Login History (for debugging)
1. Go to **Setup** → **Login History**
2. Look for failed login attempts from mhansen@cmgfi.com
3. Check the error message for more details

## Alternative: Enable Client Credentials Flow (Better for Production)

Instead of Username-Password flow, configure Client Credentials:

1. In Connected App → **Edit Policies**
2. Check: **☑ Enable Client Credentials Flow**
3. Select a **"Run As"** user (e.g., an API-only integration user)
4. Save

This is more secure and doesn't require user passwords.

## Test After Configuration

Once configured, we can test with:
```bash
node scripts/test-salesforce-auth.mjs
```

Expected output:
```
✅ Authenticated with Salesforce API
✅ All tests passed!
```

## Contact
Mark Hansen - mhansen@cmgfi.com
