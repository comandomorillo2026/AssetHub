import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, tenantSlug } = body;

    if (!email || !password || !tenantSlug) {
      return NextResponse.json(
        { error: 'Email, password, and tenantSlug are required' },
        { status: 400 }
      );
    }

    const tenant = await db.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    if (!tenant.isActive) {
      return NextResponse.json(
        { error: 'Tenant account is deactivated' },
        { status: 403 }
      );
    }

    const passwordHash = createHash('sha256').update(password + 'zeitgeist-salt-2024').digest('hex');

    const user = await db.user.findFirst({
      where: {
        email: email.toLowerCase(),
        tenantId: tenant.id,
        passwordHash,
        isActive: true,
      },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true, type: true, plan: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    await db.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const { passwordHash: _, ...userWithoutPassword } = user;

    return NextResponse.json({
      user: userWithoutPassword,
      token: user.id,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
