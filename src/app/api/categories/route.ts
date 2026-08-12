import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requirePermission } from '@/lib/auth-helpers';
import { categorySchema, validateBody } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-auth-tenant-id header is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
 const search = searchParams.get('search') || '';

    const where: Record<string, unknown> = { tenantId };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
      ];
    }

    const categories = await db.category.findMany({
      where,
      include: {
        _count: { select: { assets: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ data: categories });
  } catch (error) {
    console.error('List categories error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (auth instanceof NextResponse) return auth;

    const permCheck = requirePermission(auth, 'canCreate');
    if (permCheck) return permCheck;

    const { tenantId } = auth;

    const body = await request.json();

    const validation = validateBody(categorySchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { name, code, color, icon } = validation.data;

    const category = await db.category.create({
      data: {
        name,
        code,
        color: color || '#6366f1',
        icon: icon || 'Package',
        tenantId,
      },
      include: {
        _count: { select: { assets: true } },
      },
    });

    return NextResponse.json({ data: category }, { status: 201 });
  } catch (error: unknown) {
    console.error('Create category error:', error);
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Category name or code already exists for this tenant' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
