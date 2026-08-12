import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requirePermission, logAudit } from '@/lib/auth-helpers';
import { userCreateSchema, validateBody } from '@/lib/validations';
import { hashPassword } from '@/lib/jwt';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (auth instanceof NextResponse) return auth;

    const permCheck = requirePermission(auth, 'canManageUsers');
    if (permCheck) return permCheck;

    const { tenantId } = auth;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role');
    const isActive = searchParams.get('isActive');
    const department = searchParams.get('department');

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }
    if (role) where.role = role;
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }
    if (department) where.department = department;

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatar: true,
          phone: true,
          department: true,
          jobTitle: true,
          isActive: true,
          lastLogin: true,
          twoFactorEnabled: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (auth instanceof NextResponse) return auth;

    const permCheck = requirePermission(auth, 'canManageUsers');
    if (permCheck) return permCheck;

    const { tenantId, userId } = auth;

    const body = await request.json();

    const validation = validateBody(userCreateSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { email, name, password, role, phone, department, jobTitle } = validation.data;

    const passwordHash = await hashPassword(password);

    const user = await db.user.create({
      data: {
        email,
        name,
        passwordHash,
        role,
        phone: phone || null,
        department: department || null,
        jobTitle: jobTitle || null,
        tenantId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        phone: true,
        department: true,
        jobTitle: true,
        isActive: true,
        lastLogin: true,
        twoFactorEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await logAudit({
      db,
      tenantId,
      userId,
      action: 'user_created',
      details: `Created user "${name}" (${email}) with role "${role}"`,
    });

    return NextResponse.json({ data: user }, { status: 201 });
  } catch (error: unknown) {
    console.error('Create user error:', error);
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'A user with this email already exists in this tenant' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
