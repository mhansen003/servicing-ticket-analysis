# Salesforce Authentication Troubleshooting Checklist

## Still Getting "authentication failure" Error

Your admin enabled the settings but it's still not working. Let's diagnose the exact issue.

## Step-by-Step Diagnosis

### Check 1: Login History (Most Important!)

1. **Go to Setup → Login History**
2. Look for recent failed attempts from: **mhansen@cmgfi.com**
3. Click on the failed login entry
4. **What does the "Status" column say?**

Common statuses and fixes:
- **"Password Lockout"** → User account is locked, unlock it
- **"Invalid Password"** → Security token might be wrong, reset it again
- **"API Disabled for User"** → User profile needs "API Enabled" permission
- **"User Is Inactive"** → User account needs to be activated
- **"Password Expired"** → User needs to reset their password

### Check 2: Connected App OAuth Settings

1. **Setup → App Manager**
2. Find the Connected App (Client ID: `3MVG9Xl3BC6VHB...`)
3. Click dropdown → **Manage**
4. Click **Edit Policies**

**Verify ALL these settings:**

**OAuth Policies:**
- ☑ **Enable OAuth Settings** (should already be checked)
- ☑ **Enable for Device Flow** (optional)
- ☑ **Require Proof Key for Code Exchange (PKCE)** - Should be UNCHECKED for password flow
- Selected OAuth Scopes should include:
  - Access and manage your data (api)
  - Full access (full) - OR at minimum (api)

**OAuth Policies Section (further down):**
- ☑ **Allow OAuth Username-Password Flows** ← CRITICAL
- Client Credentials Flow: Can be enabled or not (separate issue)

**Permitted Users:**
- Select: **"All users may self-authorize"**
  (NOT "Admin approved users are pre-authorized")

**IP Relaxation:**
- Select: **"Relax IP restrictions"**
  (This allows API access from any IP)

### Check 3: User Profile Permissions

1. **Setup → Users**
2. Find user: **mhansen@cmgfi.com**
3. Click the user's name
4. Click their **Profile** name (e.g., "System Administrator")
5. Scroll to **System Permissions**
6. Verify: **☑ API Enabled**

### Check 4: User Active Status

1. **Setup → Users**
2. Find user: **mhansen@cmgfi.com**
3. Check the **Active** checkbox is checked ✅

### Check 5: Password & Security Token

1. Verify password hasn't expired
2. If needed, reset security token again:
   - User Settings → Reset My Security Token
   - Check email for new token
   - Update `.env.local` with: `password+new_token`

### Check 6: Connected App Session Settings

Sometimes session settings can interfere:

1. In Connected App → **Edit Policies**
2. **Session Policies:**
   - Timeout Value: Set to reasonable value (e.g., 2 hours)
   - Refresh Token Policy: "Refresh token is valid until revoked"

### Check 7: Organization-Wide OAuth Settings

1. **Setup → OAuth and OpenID Connect Settings**
2. Verify: **☑ Allow OAuth Username-Password Flows**

If this is unchecked at the org level, individual Connected Apps can't use it!

## After Each Fix

Test again with:
```bash
node scripts/test-salesforce-auth.mjs
```

## Expected Success Output

```
✅ Authenticated with Salesforce API (Username-Password)
   Access Token: 00D9D000000xxxx...
   Instance URL: https://cmgfinancialfscorg.my.salesforce.com

✅ All tests passed!
```

## If Still Failing

Send us the exact error from **Login History** so we can determine the root cause.

## Alternative: Use a Different User

Sometimes it's easier to create a fresh API user:

1. **Setup → Users → New User**
2. Username: `api.integration@cmgfi.com`
3. Email: `mhansen@cmgfi.com`
4. Profile: **System Administrator** (or custom with API Enabled)
5. Active: ☑
6. Generate password and security token
7. Update `.env.local` with new credentials
8. Test

## Contact

Mark Hansen - mhansen@cmgfi.com
