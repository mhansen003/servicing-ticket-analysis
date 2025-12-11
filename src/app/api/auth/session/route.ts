/**
 * Session Check API Route
 * Verifies if user has a valid active session
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/jwt';
import { AUTH_CONFIG } from '@/lib/auth/config';

export async function GET(req: NextRequest) {
  try {
    // Get auth token from cookie
    const token = req.cookies.get(AUTH_CONFIG.COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json(
        { authenticated: false, error: 'No session found' },
        { status: 401 }
      );
    }

    // Verify token
    const session = verifyAuthToken(token);

    if (!session) {
      return NextResponse.json(
        { authenticated: false, error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Return session info
    return NextResponse.json({
      authenticated: true,
      email: session.email,
      expiresAt: session.expiresAt,
    });

  } catch (error) {
    console.error('[Session Check] Error:', error);
    return NextResponse.json(
      { authenticated: false, error: 'Session check failed' },
      { status: 500 }
    );
  }
}
