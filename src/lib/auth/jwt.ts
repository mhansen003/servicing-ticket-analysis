/**
 * JWT Token Management
 * Handles creation and verification of JSON Web Tokens for session management
 */

import jwt from 'jsonwebtoken';
import { AUTH_CONFIG } from './config';

/**
 * Session data stored in JWT
 */
export interface AuthSession {
  email: string;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Validate email domain restriction
 */
export function isValidCMGEmail(email: string): boolean {
  const emailLower = email.toLowerCase().trim();
  return emailLower.endsWith(`@${AUTH_CONFIG.ALLOWED_DOMAIN}`);
}

/**
 * Create a signed JWT token for authenticated session
 */
export function createAuthToken(email: string): string {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  const now = Date.now();
  const expiryMs = AUTH_CONFIG.SESSION_EXPIRY_HOURS * 60 * 60 * 1000;

  const session: AuthSession = {
    email,
    issuedAt: now,
    expiresAt: now + expiryMs,
  };

  return jwt.sign(session, jwtSecret, {
    expiresIn: `${AUTH_CONFIG.SESSION_EXPIRY_HOURS}h`,
  });
}

/**
 * Verify JWT token and return session data
 */
export function verifyAuthToken(token: string): AuthSession | null {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    console.error('[Auth] JWT_SECRET not configured');
    return null;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as AuthSession;

    // Double-check expiration
    if (decoded.expiresAt < Date.now()) {
      console.log('[Auth] Token expired:', decoded.email);
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('[Auth] Token verification failed:', error);
    return null;
  }
}

/**
 * Extract email username (before @)
 */
export function extractUsername(email: string): string {
  return email.split('@')[0];
}

/**
 * Get user email from NextRequest cookies
 * Returns email if authenticated, null otherwise
 */
export function getUserEmailFromRequest(request: Request): string | null {
  try {
    // Get cookies from request headers
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return null;

    // Parse cookie header to find auth token
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const token = cookies[AUTH_CONFIG.COOKIE_NAME];
    if (!token) return null;

    // Verify token and extract email
    const session = verifyAuthToken(token);
    return session?.email || null;
  } catch (error) {
    console.error('[Auth] Error getting user email from request:', error);
    return null;
  }
}
