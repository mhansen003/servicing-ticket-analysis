/**
 * Authentication Database Layer
 * Prisma storage for OTP codes and rate limiting
 */

import { prisma } from '../db';
import { AUTH_CONFIG } from './config';

/**
 * Store OTP code for email
 */
export async function storeOTP(email: string, code: string): Promise<void> {
  const expiresAt = new Date(Date.now() + AUTH_CONFIG.OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.auth_otp.upsert({
    where: { email },
    create: {
      email,
      code,
      attempts: 0,
      expires_at: expiresAt,
    },
    update: {
      code,
      attempts: 0,
      created_at: new Date(),
      expires_at: expiresAt,
    },
  });
}

/**
 * Get OTP data for email
 */
export async function getOTP(email: string): Promise<{ code: string; attempts: number } | null> {
  const otpData = await prisma.auth_otp.findFirst({
    where: {
      email,
      expires_at: {
        gt: new Date(),
      },
    },
    select: {
      code: true,
      attempts: true,
    },
  });

  return otpData;
}

/**
 * Increment OTP attempt counter
 */
export async function incrementOTPAttempt(email: string): Promise<number> {
  const result = await prisma.auth_otp.updateMany({
    where: {
      email,
      expires_at: {
        gt: new Date(),
      },
    },
    data: {
      attempts: {
        increment: 1,
      },
    },
  });

  // Fetch the updated attempts count
  const otpData = await prisma.auth_otp.findUnique({
    where: { email },
    select: { attempts: true },
  });

  return otpData?.attempts || 0;
}

/**
 * Delete OTP after successful verification
 */
export async function deleteOTP(email: string): Promise<void> {
  await prisma.auth_otp.delete({
    where: { email },
  }).catch(() => {
    // Ignore if already deleted
  });
}

/**
 * Check rate limit for email
 */
export async function checkRateLimit(email: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const rateLimitData = await prisma.auth_rate_limit.findFirst({
    where: {
      email,
      expires_at: {
        gt: new Date(),
      },
    },
    select: {
      request_count: true,
      expires_at: true,
    },
  });

  if (!rateLimitData) {
    // No rate limit entry, allowed
    return { allowed: true };
  }

  if (rateLimitData.request_count >= AUTH_CONFIG.MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((rateLimitData.expires_at.getTime() - Date.now()) / 1000);
    return { allowed: false, retryAfter };
  }

  return { allowed: true };
}

/**
 * Increment rate limit counter
 */
export async function incrementRateLimit(email: string): Promise<void> {
  const windowSeconds = AUTH_CONFIG.RATE_LIMIT_WINDOW_MINUTES * 60;
  const expiresAt = new Date(Date.now() + windowSeconds * 1000);

  // Check if existing rate limit is still valid
  const existing = await prisma.auth_rate_limit.findUnique({
    where: { email },
  });

  if (existing && existing.expires_at > new Date()) {
    // Increment existing counter
    await prisma.auth_rate_limit.update({
      where: { email },
      data: {
        request_count: {
          increment: 1,
        },
      },
    });
  } else {
    // Create new or reset expired
    await prisma.auth_rate_limit.upsert({
      where: { email },
      create: {
        email,
        request_count: 1,
        window_start: new Date(),
        expires_at: expiresAt,
      },
      update: {
        request_count: 1,
        window_start: new Date(),
        expires_at: expiresAt,
      },
    });
  }
}

/**
 * Clean up expired OTP and rate limit entries
 * Should be called periodically (e.g., via cron job)
 */
export async function cleanupExpiredAuth(): Promise<void> {
  const now = new Date();

  await prisma.$transaction([
    prisma.auth_otp.deleteMany({
      where: {
        expires_at: {
          lt: now,
        },
      },
    }),
    prisma.auth_rate_limit.deleteMany({
      where: {
        expires_at: {
          lt: now,
        },
      },
    }),
  ]);

  console.log('[Auth DB] Cleaned up expired entries');
}
