/**
 * Verify OTP API Route
 * Validates OTP code and creates authenticated session with JWT
 */

import { NextRequest, NextResponse } from 'next/server';
import { isValidCMGEmail, createAuthToken } from '@/lib/auth/jwt';
import { AUTH_CONFIG } from '@/lib/auth/config';
import { getOTP, incrementOTPAttempt, deleteOTP } from '@/lib/auth/db';

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();

    // Validate inputs
    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and code are required' },
        { status: 400 }
      );
    }

    // Validate CMG domain
    if (!isValidCMGEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 403 }
      );
    }

    const emailLower = email.toLowerCase().trim();

    // Retrieve OTP data from database
    const otpData = await getOTP(emailLower);

    if (!otpData) {
      return NextResponse.json(
        { error: 'Verification code expired or not found' },
        { status: 404 }
      );
    }

    // Check max attempts
    if (otpData.attempts >= AUTH_CONFIG.MAX_ATTEMPTS) {
      await deleteOTP(emailLower);
      return NextResponse.json(
        { error: 'Maximum verification attempts exceeded. Please request a new code.' },
        { status: 403 }
      );
    }

    // Verify code
    if (otpData.code !== code.trim()) {
      // Increment attempt counter
      const newAttempts = await incrementOTPAttempt(emailLower);
      const remainingAttempts = AUTH_CONFIG.MAX_ATTEMPTS - newAttempts;
      return NextResponse.json(
        {
          error: 'Invalid verification code',
          remainingAttempts
        },
        { status: 401 }
      );
    }

    // Success! Delete OTP from database
    await deleteOTP(emailLower);

    // Create JWT token with 7-day expiry
    const token = createAuthToken(emailLower);

    // Create response with httpOnly cookie
    const response = NextResponse.json({
      success: true,
      message: 'Authentication successful',
      email: emailLower,
      expiresAt: Date.now() + (AUTH_CONFIG.SESSION_EXPIRY_HOURS * 60 * 60 * 1000),
    });

    // Set httpOnly cookie for 7 days
    response.cookies.set({
      name: AUTH_CONFIG.COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: AUTH_CONFIG.SESSION_EXPIRY_HOURS * 60 * 60, // 7 days in seconds
      path: '/',
    });

    console.log(`[Verify OTP] User authenticated: ${emailLower}`);

    return response;

  } catch (error) {
    console.error('[Verify OTP] Error:', error);
    return NextResponse.json(
      { error: 'Verification failed. Please try again.' },
      { status: 500 }
    );
  }
}
