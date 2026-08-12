import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requirePermission, logAudit } from '@/lib/auth-helpers';
import { assetUpdateSchema, validateBody } from '@/lib/validations';

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
    const auth = getAuthContext(request);
    if (auth instanceof NextResponse) return auth;

    const permCheck = requirePermission(auth, 'canUpdate');
    if (permCheck) return permCheck;

    const { tenantId, userId } = auth;
    const { id } = await params;

    const existing = await db.asset.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const body = await request.json();

    const validation = validateBody(assetUpdateSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      ...validation.data,
    };

    // Convert date strings to Date objects
    if (updateData.purchaseDate !== undefined) updateData.purchaseDate = updateData.purchaseDate ? new Date(updateData.purchaseDate as string) : null;
    if (updateData.warrantyExpiry !== undefined) updateData.warrantyExpiry = updateData.warrantyExpiry ? new Date(updateData.warrantyExpiry as string) : null;

    // Pull optional fields not in the schema from raw body
    if (body.photo !== undefined) updateData.photo = body.photo;

    const asset = await db.asset.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true, code: true, color: true, icon: true } },
        location: { select: { id: true, name: true, code: true } },
      },
    });

    const changedFields = Object.keys(updateData).join(', ');
    await logAudit({
      db,
      tenantId,
      userId,
      action: 'asset_updated',
      details: `Updated asset "${existing.name}" (${existing.tagNumber}) — changed: ${changedFields}`,
      assetId: id,
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
    const auth = getAuthContext(request);
    if (auth instanceof NextResponse) return auth;

    const permCheck = requirePermission(auth, 'canDelete');
    if (permCheck) return permCheck;

    const { tenantId, userId } = auth;
    const { id } = await params;

    const existing = await db.asset.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    await db.asset.delete({ where: { id } });

    await logAudit({
      db,
      tenantId,
      userId,
      action: 'asset_deleted',
      details: `Deleted asset "${existing.name}" (${existing.tagNumber})`,
      assetId: id,
    });

    return NextResponse.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Delete asset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
