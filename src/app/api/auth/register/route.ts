import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantName, tenantSlug, tenantType, name, email, password } = body;

    if (!tenantName || !name || !email || !password) {
      return NextResponse.json(
        { error: 'tenantName, name, email, and password are required' },
        { status: 400 }
      );
    }

    const slug = tenantSlug ||
      tenantName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') +
      '-' +
      Date.now().toString(36);

    const existingTenant = await db.tenant.findUnique({
      where: { slug },
    });

    if (existingTenant) {
      return NextResponse.json(
        { error: 'Tenant slug already exists' },
        { status: 409 }
      );
    }

    const passwordHash = createHash('sha256').update(password + 'zeitgeist-salt-2024').digest('hex');

    const tenant = await db.tenant.create({
      data: {
        name: tenantName,
        slug,
        type: tenantType || 'private',
        users: {
          create: {
            name,
            email: email.toLowerCase(),
            passwordHash,
            role: 'admin',
          },
        },
      },
      include: {
        users: true,
      },
    });

    const adminUser = tenant.users[0];
    const { passwordHash: _, ...userWithoutPassword } = adminUser;

    return NextResponse.json(
      {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          type: tenant.type,
          plan: tenant.plan,
        },
        user: userWithoutPassword,
        token: adminUser.id,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Registration error:', error);
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Email already registered for this tenant' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
