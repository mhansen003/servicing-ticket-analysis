/**
 * Authentication Middleware
 * Protects routes by verifying JWT token from cookie
 * Redirects unauthenticated users to /login
 */

// Force Node.js runtime for crypto support
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/jwt';
import { AUTH_CONFIG } from '@/lib/auth/config';

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/api/auth/send-otp',
  '/api/auth/verify-otp',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log('[Middleware] Checking path:', pathname);

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    console.log('[Middleware] Public route, allowing');
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next();
  }

  // Get auth token from cookie
  const token = request.cookies.get(AUTH_CONFIG.COOKIE_NAME)?.value;
  console.log('[Middleware] Token present:', !!token);

  // Check if token exists and is valid
  const session = token ? verifyAuthToken(token) : null;
  console.log('[Middleware] Session valid:', !!session);

  // If not authenticated
  if (!session) {
    console.log('[Middleware] Not authenticated, redirecting to login');
    // For API routes, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // For pages, redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  console.log('[Middleware] Authenticated, allowing request');
  // Authenticated - allow request
  return NextResponse.next();
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
};
