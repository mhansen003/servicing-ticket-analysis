# OTP Authentication Setup Guide

## Overview

The Servicing Ticket Analysis application now includes OTP (One-Time Password) authentication using Gmail SMTP, following the same pattern as the Servicing Backlog Manager.

## Features

✅ **Email-based OTP Authentication** - 6-digit codes sent via Gmail SMTP
✅ **@cmgfi.com Domain Restriction** - Only CMG Financial emails allowed
✅ **JWT Session Management** - 7-day sessions with httpOnly cookies
✅ **Rate Limiting** - Prevents OTP abuse (20 requests per 15 minutes)
✅ **Attempt Tracking** - Maximum 5 verification attempts per OTP
✅ **Prisma Database Storage** - Auth tables for OTP and rate limiting
✅ **Route Protection** - Middleware guards all routes except login/auth APIs

## Architecture

### Database Tables (Prisma)

Two new tables were added to the schema:

- **auth_otp** - Stores OTP codes with expiration and attempt tracking
- **auth_rate_limit** - Tracks OTP request frequency per email

### Authentication Flow

1. **Email Entry** → User enters @cmgfi.com email
2. **OTP Generation** → 6-digit code generated and sent via Gmail
3. **Code Verification** → User enters code (5 attempts max, 5-minute expiry)
4. **JWT Creation** → httpOnly cookie set with 7-day expiration
5. **Session Validation** → Middleware verifies JWT on all protected routes

### File Structure

```
src/
├── lib/auth/
│   ├── config.ts       # Auth configuration constants
│   ├── jwt.ts          # JWT token creation/verification
│   ├── email.ts        # OTP email sending via Gmail
│   └── db.ts           # Prisma database operations
├── app/
│   ├── login/
│   │   └── page.tsx    # Login page with 2-step OTP flow
│   └── api/auth/
│       ├── send-otp/route.ts    # Send OTP email
│       ├── verify-otp/route.ts  # Verify code & create session
│       ├── session/route.ts     # Check session status
│       └── logout/route.ts      # End session
└── middleware.ts       # Route protection
```

## Environment Variables Setup

### Required Variables

Add these to your `.env` file:

```bash
# Database (already configured)
DATABASE_URL=postgresql://...

# JWT Secret - Generate with:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your_generated_secret_here

# Gmail SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@cmgfi.com
SMTP_PASS=your-gmail-app-password
```

### Gmail App Password Setup

1. Go to your Google Account settings
2. Enable 2-Factor Authentication
3. Navigate to **Security** → **2-Step Verification** → **App passwords**
4. Generate a new app password for "Mail"
5. Use this 16-character password as `SMTP_PASS`

**Important:** Use an app password, NOT your regular Gmail password!

## Database Migration

Push the new auth tables to your database:

```bash
npx prisma db push
```

Or create a migration:

```bash
npx prisma migrate dev --name add-auth-tables
```

## Configuration Settings

Edit `src/lib/auth/config.ts` to customize:

```typescript
export const AUTH_CONFIG = {
  OTP_LENGTH: 6,                        // Code length
  OTP_EXPIRY_MINUTES: 5,                // Code validity
  MAX_ATTEMPTS: 5,                      // Max verification tries
  RATE_LIMIT_WINDOW_MINUTES: 15,       // Rate limit window
  MAX_REQUESTS_PER_WINDOW: 20,         // Max OTP sends
  SESSION_EXPIRY_HOURS: 168,           // 7 days
  ALLOWED_DOMAIN: 'cmgfi.com',         // Email domain
  COOKIE_NAME: 'ticket_analysis_auth_token',
};
```

## Testing the Implementation

### 1. Start Development Server

```bash
npm run dev
```

### 2. Access Login Page

Navigate to `http://localhost:3000/login`

### 3. Test Flow

1. Enter your @cmgfi.com email
2. Check your email for the 6-digit code
3. Enter the code within 5 minutes
4. Should redirect to dashboard with active session

### 4. Verify Session

- Session cookie should be set (check DevTools → Application → Cookies)
- Accessing any route should work without redirect
- `/api/auth/session` should return authenticated status

### 5. Test Logout

- Call `/api/auth/logout` or implement a logout button
- Cookie should be cleared
- Next page access should redirect to login

## Security Features

### Rate Limiting
- **20 OTP requests per 15 minutes** per email address
- Prevents brute force and abuse
- Returns `429 Too Many Requests` with retry-after time

### Attempt Tracking
- **5 verification attempts** per OTP code
- Automatically deletes OTP after max attempts
- Forces new code request

### Domain Restriction
- Only **@cmgfi.com** emails accepted
- Server-side validation on both send and verify
- Returns `403 Forbidden` for other domains

### Secure Sessions
- **httpOnly cookies** prevent XSS access
- **7-day expiration** with automatic cleanup
- **JWT signed** with secret key
- **Secure flag** in production (HTTPS only)

## Production Deployment

### Vercel Setup

1. **Add Environment Variables** in Vercel dashboard:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `SMTP_USER`
   - `SMTP_PASS`

2. **Deploy:**
   ```bash
   git add .
   git commit -m "Add OTP authentication"
   git push
   ```

3. **Migrate Database:**
   ```bash
   # If using Vercel Postgres or Neon
   npx prisma db push
   ```

### Gmail in Production

Ensure your Gmail account:
- Has 2FA enabled
- App password is created specifically for production
- Account is not flagged for suspicious activity
- SMTP access is allowed

## Troubleshooting

### Email Not Sending

Check:
- `SMTP_USER` and `SMTP_PASS` are correct
- Using app password, not regular password
- Gmail account has 2FA enabled
- Check server logs for SMTP errors

### Database Errors

- Ensure `DATABASE_URL` is set correctly
- Run `npx prisma generate` after schema changes
- Run `npx prisma db push` to sync database

### Session Issues

- Clear cookies and try again
- Verify `JWT_SECRET` is set
- Check middleware logs for token validation errors
- Ensure cookie `secure` flag matches environment (dev vs prod)

### Middleware Redirects

- Check console logs for middleware path checks
- Verify public routes in `middleware.ts`
- Ensure login page is accessible without auth

## Maintenance

### Cleanup Expired Entries

Add a cron job to clean up expired OTP and rate limit entries:

```typescript
import { cleanupExpiredAuth } from '@/lib/auth/db';

// Run daily or via Vercel cron
export async function GET() {
  await cleanupExpiredAuth();
  return Response.json({ success: true });
}
```

## Next Steps

- [ ] Push database schema changes
- [ ] Configure environment variables
- [ ] Set up Gmail app password
- [ ] Test OTP flow in development
- [ ] Deploy to Vercel
- [ ] Test in production
- [ ] Add logout button to UI (optional)
- [ ] Monitor auth logs for issues

## Support

For issues or questions, refer to:
- **Reference Implementation:** `C:\GitHub\servicing-backlog-manager`
- **Prisma Docs:** https://www.prisma.io/docs
- **Gmail App Passwords:** https://support.google.com/accounts/answer/185833
