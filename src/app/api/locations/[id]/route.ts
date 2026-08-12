import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requirePermission, logAudit } from '@/lib/auth-helpers';
import { locationSchema, validateBody } from '@/lib/validations';

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

    const existing = await db.location.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    const body = await request.json();

    const validation = validateBody(locationSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { name, code, address, parentId } = validation.data;

    if (parentId && parentId !== existing.parentId) {
      const parent = await db.location.findFirst({
        where: { id: parentId, tenantId },
      });
      if (!parent) {
        return NextResponse.json({ error: 'Parent location not found' }, { status: 404 });
      }
    }

    const location = await db.location.update({
      where: { id },
      data: {
        name,
        code,
        address: address || null,
        parentId: parentId || null,
      },
      include: {
        _count: {
          select: { assets: true, children: true },
        },
        parent: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    const changedFields = Object.keys(body).join(', ');
    await logAudit({
      db,
      tenantId,
      userId,
      action: 'location_updated',
      details: `Updated location "${existing.name}" (${existing.code}) — changed: ${changedFields}`,
    });

    return NextResponse.json({ data: location });
  } catch (error: unknown) {
    console.error('Update location error:', error);
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json({ error: 'Location name already exists for this tenant' }, { status: 409 });
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

    const existing = await db.location.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    await db.location.delete({ where: { id } });

    await logAudit({
      db,
      tenantId,
      userId,
      action: 'location_deleted',
      details: `Deleted location "${existing.name}" (${existing.code})`,
    });

    return NextResponse.json({ message: 'Location deleted successfully' });
  } catch (error) {
    console.error('Delete location error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
