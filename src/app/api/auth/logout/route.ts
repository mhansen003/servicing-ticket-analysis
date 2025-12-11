/**
 * Logout API Route
 * Clears the authentication cookie and ends the session
 */

import { NextRequest, NextResponse } from 'next/server';
import { AUTH_CONFIG } from '@/lib/auth/config';

export async function POST(req: NextRequest) {
  try {
    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    // Clear auth cookie
    response.cookies.set({
      name: AUTH_CONFIG.COOKIE_NAME,
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    console.log('[Logout] User logged out');

    return response;

  } catch (error) {
    console.error('[Logout] Error:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}
