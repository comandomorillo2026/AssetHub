import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requirePermission } from '@/lib/auth-helpers';
import { locationSchema, validateBody } from '@/lib/validations';

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
        { address: { contains: search } },
      ];
    }

    const locations = await db.location.findMany({
      where,
      include: {
        _count: {
          select: {
            assets: true,
            children: true,
          },
        },
        parent: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Build hierarchy tree
    const locationMap = new Map<string, typeof locations[0] & { children?: (typeof locations[0] & { children?: unknown[] })[] }>();
    const roots: (typeof locations[0] & { children?: (typeof locations[0] & { children?: unknown[] })[] })[] = [];

    for (const loc of locations) {
      locationMap.set(loc.id, { ...loc, children: [] });
    }

    for (const loc of locations) {
      const node = locationMap.get(loc.id)!;
      if (loc.parentId && locationMap.has(loc.parentId)) {
        locationMap.get(loc.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    }

    return NextResponse.json({
      data: locations,
      tree: roots,
    });
  } catch (error) {
    console.error('List locations error:', error);
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

    const validation = validateBody(locationSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { name, code, address, parentId } = validation.data;

    if (parentId) {
      const parent = await db.location.findFirst({
        where: { id: parentId, tenantId },
      });
      if (!parent) {
        return NextResponse.json({ error: 'Parent location not found' }, { status: 404 });
      }
    }

    const location = await db.location.create({
      data: {
        name,
        code,
        address: address || null,
        parentId: parentId || null,
        tenantId,
      },
      include: {
        _count: {
          select: { assets: true, children: true },
        },
      },
    });

    return NextResponse.json({ data: location }, { status: 201 });
  } catch (error: unknown) {
    console.error('Create location error:', error);
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Location name already exists for this tenant' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
