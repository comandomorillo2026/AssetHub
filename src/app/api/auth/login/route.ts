import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { comparePassword, signAccessToken, signRefreshToken, type JwtPayload } from '@/lib/jwt';
import { loginSchema, validateBody } from '@/lib/validations';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = validateBody(loginSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { email, password } = validation.data;
    const { tenantSlug } = body;

    if (!tenantSlug) {
      return NextResponse.json(
        { error: 'tenantSlug is required' },
        { status: 400 }
      );
    }

    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    if (!tenant.isActive) {
      return NextResponse.json({ error: 'Tenant account is deactivated' }, { status: 403 });
    }

    const user = await db.user.findFirst({
      where: { email: email.toLowerCase(), tenantId: tenant.id, isActive: true },
      include: { tenant: { select: { id: true, name: true, slug: true, type: true, currency: true, subscription: { include: { plan: { select: { name: true, maxAssets: true, maxUsers: true } } } } } } },
    });

    if (!user || !(await comparePassword(password, user.passwordHash))) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    await db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    // Create refresh token in DB
    const refreshToken = signRefreshToken(user.id, tenant.id);
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.refreshToken.create({
      data: { token: refreshToken, userId: user.id, tenantId: tenant.id, expiresAt: refreshExpiry },
    });

    const jwtPayload: JwtPayload = { userId: user.id, tenantId: tenant.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(jwtPayload);

    const { passwordHash: _, ...userWithoutSensitive } = user;

    return NextResponse.json({
      user: userWithoutSensitive,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}