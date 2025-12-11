/**
 * Send OTP API Route
 * Generates and emails a 6-digit OTP code to valid @cmgfi.com addresses
 */

import { NextRequest, NextResponse } from 'next/server';
import { isValidCMGEmail } from '@/lib/auth/jwt';
import { generateOTP } from '@/lib/auth/email';
import { checkRateLimit, incrementRateLimit, storeOTP } from '@/lib/auth/db';
import { AUTH_CONFIG, EMAIL_CONFIG } from '@/lib/auth/config';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    // Validate email format
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate CMG domain
    if (!isValidCMGEmail(email)) {
      return NextResponse.json(
        { error: 'Only @cmgfi.com email addresses are allowed' },
        { status: 403 }
      );
    }

    const emailLower = email.toLowerCase().trim();

    // Rate limiting check
    const rateLimit = await checkRateLimit(emailLower);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
    }

    // Generate OTP
    const otp = generateOTP();

    // Store OTP in database
    await storeOTP(emailLower, otp);

    // Update rate limit counter
    await incrementRateLimit(emailLower);

    // Send OTP email (inline to avoid bundling issues)
    try {
      const nodemailerModule = require('nodemailer');

      if (!EMAIL_CONFIG.SMTP_USER || !EMAIL_CONFIG.SMTP_PASS) {
        throw new Error('SMTP credentials not configured');
      }

      // Use createTransport
      const transporter = nodemailerModule.createTransport({
        host: EMAIL_CONFIG.SMTP_HOST,
        port: EMAIL_CONFIG.SMTP_PORT,
        secure: false,
        auth: {
          user: EMAIL_CONFIG.SMTP_USER,
          pass: EMAIL_CONFIG.SMTP_PASS,
        },
      });

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #000000; color: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #000000; border-radius: 16px; border: 1px solid #333333; overflow: hidden; }
    .header { background: #000000; border-bottom: 1px solid #333333; padding: 40px 30px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; }
    .content { padding: 40px 30px; background: #000000; }
    .code-box { background: #1a1a1a; border: 2px solid #10b981; border-radius: 12px; padding: 24px; text-align: center; margin: 30px 0; }
    .code { font-size: 42px; font-weight: bold; letter-spacing: 12px; color: #10b981; font-family: 'Courier New', monospace; }
    .footer { background: #000000; border-top: 1px solid #333333; padding: 24px; text-align: center; font-size: 12px; color: #888888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-size: 48px; margin-bottom: 12px;">🔐</div>
      <h1>Servicing Ticket Analysis</h1>
    </div>
    <div class="content">
      <h2 style="color: #10b981; margin-top: 0;">Your Access Code</h2>
      <p style="line-height: 1.6; color: #cccccc;">Hello! Someone requested access to the Servicing Ticket Analysis dashboard using this email address.</p>
      <div class="code-box">
        <div style="color: #888888; font-size: 12px;">VERIFICATION CODE</div>
        <div class="code">${otp}</div>
        <div style="color: #888888; font-size: 12px;">Valid for ${AUTH_CONFIG.OTP_EXPIRY_MINUTES} minutes</div>
      </div>
      <p style="line-height: 1.6; color: #cccccc;">Enter this code on the login page to access your ticket analysis dashboard.</p>
    </div>
    <div class="footer">
      <p style="margin: 0;">CMG Financial | Servicing Ticket Analysis</p>
      <p style="margin: 16px 0 0 0; color: #666666;">This is an automated message. Please do not reply.</p>
    </div>
  </div>
</body>
</html>`;

      await transporter.sendMail({
        from: `"${EMAIL_CONFIG.FROM_NAME}" <${EMAIL_CONFIG.SMTP_USER}>`,
        to: emailLower,
        subject: 'Your Servicing Ticket Analysis Access Code',
        html: htmlContent,
        text: `Your verification code: ${otp}\n\nThis code is valid for ${AUTH_CONFIG.OTP_EXPIRY_MINUTES} minutes.`,
      });

      console.log(`[Send OTP] Code sent to ${emailLower}`);
    } catch (emailError) {
      console.error('[Send OTP] Email error:', emailError);
      throw new Error('Failed to send verification email');
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
    });

  } catch (error) {
    console.error('[Send OTP] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send verification code. Please try again.' },
      { status: 500 }
    );
  }
}
