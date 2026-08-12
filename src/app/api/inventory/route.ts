import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-auth-tenant-id header is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;

    const [sessions, total] = await Promise.all([
      db.inventorySession.findMany({
        where,
        skip,
        take: limit,
        include: {
          location: { select: { id: true, name: true, code: true } },
          user: { select: { id: true, name: true, email: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.inventorySession.count({ where }),
    ]);

    return NextResponse.json({
      data: sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List inventory sessions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-auth-tenant-id header is required' }, { status: 400 });
    }

    const body = await request.json();
    const { name, locationId, notes, userId } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    // Count expected assets at the location (or all if no location)
    const assetWhere: Record<string, unknown> = { tenantId, status: 'active' };
    if (locationId) {
      assetWhere.locationId = locationId;
    }

    const totalExpected = await db.asset.count({ where: assetWhere });

    const session = await db.inventorySession.create({
      data: {
        name,
        locationId: locationId || null,
        notes: notes || null,
        userId: userId || null,
        totalExpected,
        tenantId,
      },
      include: {
        location: { select: { id: true, name: true, code: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ data: session }, { status: 201 });
  } catch (error) {
    console.error('Create inventory session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
