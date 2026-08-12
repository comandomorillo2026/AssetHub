import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, verifySuperAdminToken } from '@/lib/jwt';

const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/admin/auth',
  '/api/qr',
  '/api/payments/webhook',
];

const SUPER_ADMIN_PATHS = ['/api/admin'];

const RATE_LIMIT_MAP = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 60;
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (pathname.startsWith('/api/auth/login') || pathname.startsWith('/api/auth/register')) {
    const key = getRateLimitKey(request);
    if (!checkRateLimit(key, AUTH_RATE_LIMIT_MAX)) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }
  }

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
      await verifySuperAdminToken(token);
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
    const payload = await verifyAccessToken(token);

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-auth-user-id', payload.userId);
    requestHeaders.set('x-auth-tenant-id', payload.tenantId);
    requestHeaders.set('x-auth-role', payload.role);

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
