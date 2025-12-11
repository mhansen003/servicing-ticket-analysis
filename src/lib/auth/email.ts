/**
 * Email and OTP Management
 * Handles OTP generation and email delivery via SMTP (Gmail)
 */

import { AUTH_CONFIG, EMAIL_CONFIG } from './config';

/**
 * Generate a random 6-digit OTP
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Create and configure email transporter for Gmail
 */
export function createEmailTransporter() {
  if (!EMAIL_CONFIG.SMTP_USER || !EMAIL_CONFIG.SMTP_PASS) {
    throw new Error('SMTP credentials not configured');
  }

  // Use dynamic require for better Next.js compatibility
  const nodemailer = require('nodemailer');

  return nodemailer.createTransport({
    host: EMAIL_CONFIG.SMTP_HOST,
    port: EMAIL_CONFIG.SMTP_PORT,
    secure: false, // Use STARTTLS
    auth: {
      user: EMAIL_CONFIG.SMTP_USER,
      pass: EMAIL_CONFIG.SMTP_PASS,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });
}

/**
 * Send OTP verification email with Servicing Ticket Analysis branding
 */
export async function sendOTPEmail(email: string, code: string): Promise<void> {
  const transporter = createEmailTransporter();

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #0f172a;
      color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: linear-gradient(to bottom right, #1e293b, #0f172a);
      border-radius: 16px;
      border: 1px solid rgba(148, 163, 184, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header-icon {
      font-size: 48px;
      margin-bottom: 12px;
    }
    .header h1 {
      margin: 0;
      color: white;
      font-size: 28px;
      font-weight: bold;
    }
    .content {
      padding: 40px 30px;
    }
    .code-box {
      background: rgba(59, 130, 246, 0.1);
      border: 2px solid #3b82f6;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin: 30px 0;
    }
    .code {
      font-size: 42px;
      font-weight: bold;
      letter-spacing: 12px;
      color: #3b82f6;
      font-family: 'Courier New', monospace;
    }
    .warning {
      background: rgba(239, 68, 68, 0.1);
      border-left: 4px solid #ef4444;
      padding: 16px;
      margin: 24px 0;
      border-radius: 6px;
      font-size: 14px;
    }
    .footer {
      background: rgba(148, 163, 184, 0.05);
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid rgba(148, 163, 184, 0.1);
    }
    a {
      color: #3b82f6;
      text-decoration: none;
    }
    .meta-text {
      color: #94a3b8;
      font-size: 12px;
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-icon">🔐</div>
      <h1>Servicing Ticket Analysis</h1>
    </div>
    <div class="content">
      <h2 style="color: #3b82f6; margin-top: 0; font-size: 22px;">Your Access Code</h2>
      <p style="line-height: 1.6; color: #cbd5e1;">
        Hello! Someone requested access to the Servicing Ticket Analysis dashboard using this email address.
      </p>

      <div class="code-box">
        <div class="meta-text">VERIFICATION CODE</div>
        <div class="code">${code}</div>
        <div class="meta-text">Valid for ${AUTH_CONFIG.OTP_EXPIRY_MINUTES} minutes</div>
      </div>

      <p style="line-height: 1.6; color: #cbd5e1;">
        Enter this code on the login page to access your ticket analysis dashboard.
      </p>

      <div class="warning">
        <strong style="color: #fca5a5;">⚠️ Security Notice:</strong><br>
        <div style="margin-top: 8px; line-height: 1.6;">
          • This code expires in ${AUTH_CONFIG.OTP_EXPIRY_MINUTES} minutes<br>
          • You have ${AUTH_CONFIG.MAX_ATTEMPTS} attempts to enter it correctly<br>
          • If you didn't request this code, please ignore this email<br>
          • Never share this code with anyone
        </div>
      </div>

      <p style="margin-top: 30px; color: #94a3b8; font-size: 14px; line-height: 1.6;">
        Your session will remain active for 7 days after successful login. Questions? Contact your IT administrator.
      </p>
    </div>
    <div class="footer">
      <p style="margin: 0 0 8px 0; font-weight: 600;">CMG Financial | Servicing Ticket Analysis</p>
      <p style="margin: 0;">AI-Powered Transcript Analytics & Insights</p>
      <p style="margin: 16px 0 0 0; color: #64748b;">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const textContent = `
Servicing Ticket Analysis - Access Verification

Your verification code: ${code}

This code is valid for ${AUTH_CONFIG.OTP_EXPIRY_MINUTES} minutes.

Enter this code on the login page to access your account.

If you didn't request this code, you can safely ignore this email.

SECURITY NOTICE:
• Never share this code with anyone
• The code expires in ${AUTH_CONFIG.OTP_EXPIRY_MINUTES} minutes
• You have ${AUTH_CONFIG.MAX_ATTEMPTS} attempts to enter it correctly
• Your session will remain active for 7 days after login

---
This email was sent to ${email}
Servicing Ticket Analysis - AI-Powered Transcript Analytics
© ${new Date().getFullYear()} CMG Financial. All rights reserved.
  `.trim();

  try {
    await transporter.sendMail({
      from: `"${EMAIL_CONFIG.FROM_NAME}" <${EMAIL_CONFIG.SMTP_USER}>`,
      to: email,
      subject: 'Your Servicing Ticket Analysis Access Code',
      html: htmlContent,
      text: textContent,
    });

    console.log(`[Auth Email] OTP sent to ${email}`);
  } catch (error) {
    console.error('[Auth Email] Failed to send OTP:', error);
    throw new Error('Failed to send verification email');
  }
}
