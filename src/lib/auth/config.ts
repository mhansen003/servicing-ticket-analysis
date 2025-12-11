/**
 * Authentication Configuration
 * Centralized constants for OTP and session management
 */

export const AUTH_CONFIG = {
  // OTP Settings
  OTP_LENGTH: 6,                        // 6-digit verification code
  OTP_EXPIRY_MINUTES: 5,                // Code valid for 5 minutes
  MAX_ATTEMPTS: 5,                      // Max OTP verification attempts

  // Rate Limiting
  RATE_LIMIT_WINDOW_MINUTES: 15,       // Rate limit window
  MAX_REQUESTS_PER_WINDOW: 20,         // Max OTP sends per window

  // Session Management
  SESSION_EXPIRY_HOURS: 168,           // JWT expiry (7 days)

  // Email Domain Restriction
  ALLOWED_DOMAIN: 'cmgfi.com',         // Only @cmgfi.com emails

  // Cookie Configuration
  COOKIE_NAME: 'ticket_analysis_auth_token',   // Cookie name for JWT storage
} as const;

/**
 * Email configuration from environment
 */
export const EMAIL_CONFIG = {
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587'),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  FROM_NAME: 'Servicing Ticket Analysis',
};

/**
 * Validate required environment variables
 */
export function validateAuthEnv(): { valid: boolean; missing: string[] } {
  const required = ['JWT_SECRET', 'DATABASE_URL', 'SMTP_USER', 'SMTP_PASS'];
  const missing = required.filter(key => !process.env[key]);

  return {
    valid: missing.length === 0,
    missing,
  };
}
