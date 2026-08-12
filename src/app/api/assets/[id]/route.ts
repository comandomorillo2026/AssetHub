import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = request.headers.get('x-auth-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-auth-tenant-id header is required' }, { status: 400 });
    }

    const asset = await db.asset.findFirst({
      where: { id, tenantId },
      include: {
        category: { select: { id: true, name: true, code: true, color: true, icon: true } },
        location: { select: { id: true, name: true, code: true, address: true, parentId: true } },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json({ data: asset });
  } catch (error) {
    console.error('Get asset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = request.headers.get('x-auth-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-auth-tenant-id header is required' }, { status: 400 });
    }

    const existing = await db.asset.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      name, tagNumber, description, serialNumber, brand, model,
      purchaseDate, purchasePrice, currentValue, warrantyExpiry,
      status, condition, assignedTo, notes, photo, categoryId, locationId,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (tagNumber !== undefined) updateData.tagNumber = tagNumber;
    if (description !== undefined) updateData.description = description;
    if (serialNumber !== undefined) updateData.serialNumber = serialNumber;
    if (brand !== undefined) updateData.brand = brand;
    if (model !== undefined) updateData.model = model;
    if (purchaseDate !== undefined) updateData.purchaseDate = purchaseDate ? new Date(purchaseDate) : null;
    if (purchasePrice !== undefined) updateData.purchasePrice = purchasePrice !== null ? parseFloat(purchasePrice) : null;
    if (currentValue !== undefined) updateData.currentValue = currentValue !== null ? parseFloat(currentValue) : null;
    if (warrantyExpiry !== undefined) updateData.warrantyExpiry = warrantyExpiry ? new Date(warrantyExpiry) : null;
    if (status !== undefined) updateData.status = status;
    if (condition !== undefined) updateData.condition = condition;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (notes !== undefined) updateData.notes = notes;
    if (photo !== undefined) updateData.photo = photo;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (locationId !== undefined) updateData.locationId = locationId;

    const asset = await db.asset.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true, code: true, color: true, icon: true } },
        location: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json({ data: asset });
  } catch (error: unknown) {
    console.error('Update asset error:', error);
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = request.headers.get('x-auth-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-auth-tenant-id header is required' }, { status: 400 });
    }

    const existing = await db.asset.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    await db.asset.delete({ where: { id } });

    return NextResponse.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Delete asset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
