import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, verifySuperAdminToken } from '@/lib/jwt';

const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/admin/auth',
  '/api/qr',
  '/api/payments/webhook',
  '/api/payments/demo-checkout',
];

const SUPER_ADMIN_PATHS = ['/api/admin'];

const RATE_LIMIT_MAP = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // per window
const AUTH_RATE_LIMIT_MAX = 10;

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return ip;
}

function checkRateLimit(key: string, max: number): boolean {
  const now = Date.now();
  const entry = RATE_LIMIT_MAP.get(key);
  if (!entry || now > entry.resetTime) {
    RATE_LIMIT_MAP.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  entry.count++;
  if (entry.count > max) {
    return false;
  }
  return true;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip non-API routes (Next.js pages, static files, _next)
  if (!pathname.startsWith('/api/')) {
    // For non-API routes, ensure they go through the SPA
    return NextResponse.next();
  }

  // Allow public endpoints
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Rate limiting for auth endpoints
  if (pathname.startsWith('/api/auth/login') || pathname.startsWith('/api/auth/register')) {
    const key = getRateLimitKey(request);
    if (!checkRateLimit(key, AUTH_RATE_LIMIT_MAX)) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }
  }

  // General rate limiting for all API routes
  const rateKey = getRateLimitKey(request);
  if (!checkRateLimit(rateKey, RATE_LIMIT_MAX)) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  }

  if (isPublic) {
    return NextResponse.next();
  }

  // Super admin routes
  if (SUPER_ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    try {
      const token = authHeader.split(' ')[1];
      verifySuperAdminToken(token);
      return NextResponse.next();
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
  }

  // Protected tenant routes
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);

    // Inject tenantId and userId into request headers for downstream use
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-auth-user-id', payload.userId);
    requestHeaders.set('x-auth-tenant-id', payload.tenantId);
    requestHeaders.set('x-auth-role', payload.role);

    // For non-GET requests, check user role permissions
    if (request.method !== 'GET' && payload.role === 'user') {
      // Users can only modify assets they're assigned to (handled at route level)
      // But allow basic operations
    }

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Invalid or expired token';
    if (msg.includes('expired')) {
      return NextResponse.json({ error: 'Token expired', code: 'TOKEN_EXPIRED' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}

export const config = {
  matcher: ['/api/:path*'],
};
