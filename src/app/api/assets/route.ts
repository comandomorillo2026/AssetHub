import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requirePermission, logAudit } from '@/lib/auth-helpers';
import { assetCreateSchema, validateBody } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-auth-tenant-id header is required' }, { status: 400 });
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
    const auth = getAuthContext(request);
    if (auth instanceof NextResponse) return auth;

    const permCheck = requirePermission(auth, 'canCreate');
    if (permCheck) return permCheck;

    const { tenantId, userId } = auth;

    const body = await request.json();

    const validation = validateBody(assetCreateSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const {
      name, tagNumber, description, serialNumber, brand, model,
      purchaseDate, purchasePrice, currentValue, warrantyExpiry,
      status, condition, assignedTo, notes, categoryId, locationId,
    } = validation.data;

    const timestamp = Date.now();
    const random4 = Math.floor(1000 + Math.random() * 9000);
    const qrCode = `AST-${timestamp}-${random4}`;

    // Pull optional fields not in the schema from raw body
    const { photo } = body;

    const asset = await db.asset.create({
      data: {
        qrCode,
        tagNumber: tagNumber || `TAG-${timestamp}`,
        name,
        description,
        serialNumber,
        brand,
        model,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        purchasePrice: purchasePrice ?? null,
        currentValue: currentValue ?? null,
        warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
        status,
        condition,
        assignedTo,
        notes,
        photo: photo || null,
        categoryId,
        locationId,
        tenantId,
      },
      include: {
        category: { select: { id: true, name: true, code: true, color: true, icon: true } },
        location: { select: { id: true, name: true, code: true } },
      },
    });

    await logAudit({
      db,
      tenantId,
      userId,
      action: 'asset_created',
      details: `Created asset "${name}" (tag: ${tagNumber || `TAG-${timestamp}`})`,
      assetId: asset.id,
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