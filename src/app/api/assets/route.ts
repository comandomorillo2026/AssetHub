import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId');
    const locationId = searchParams.get('locationId');
    const status = searchParams.get('status');
    const condition = searchParams.get('condition');

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { tagNumber: { contains: search } },
        { serialNumber: { contains: search } },
        { qrCode: { contains: search } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (locationId) where.locationId = locationId;
    if (status) where.status = status;
    if (condition) where.condition = condition;

    const [assets, total] = await Promise.all([
      db.asset.findMany({
        where,
        skip,
        take: limit,
        include: {
          category: { select: { id: true, name: true, code: true, color: true, icon: true } },
          location: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.asset.count({ where }),
    ]);

    return NextResponse.json({
      data: assets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List assets error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 400 });
    }

    const body = await request.json();
    const { name, tagNumber, description, serialNumber, brand, model, purchaseDate, purchasePrice, currentValue, warrantyExpiry, status, condition, assignedTo, notes, photo, categoryId, locationId } = body;

    if (!name || !tagNumber) {
      return NextResponse.json({ error: 'name and tagNumber are required' }, { status: 400 });
    }

    const timestamp = Date.now();
    const random4 = Math.floor(1000 + Math.random() * 9000);
    const qrCode = `AST-${timestamp}-${random4}`;

    const asset = await db.asset.create({
      data: {
        qrCode,
        tagNumber,
        name,
        description,
        serialNumber,
        brand,
        model,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
        currentValue: currentValue ? parseFloat(currentValue) : null,
        warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
        status: status || 'active',
        condition: condition || 'good',
        assignedTo,
        notes,
        photo,
        categoryId,
        locationId,
        tenantId,
      },
      include: {
        category: { select: { id: true, name: true, code: true, color: true, icon: true } },
        location: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json({ data: asset }, { status: 201 });
  } catch (error: unknown) {
    console.error('Create asset error:', error);
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json({ error: 'Tag number already exists for this tenant' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
