import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requirePermission } from '@/lib/auth-helpers';
import { checkoutReturnSchema, validateBody } from '@/lib/validations';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = getAuthContext(request);
    if (auth instanceof NextResponse) return auth;

    const permCheck = requirePermission(auth, 'canUpdate');
    if (permCheck) return permCheck;

    const { tenantId, userId } = auth;
    const { id } = await params;

    const existing = await db.assetCheckout.findFirst({
      where: { id, tenantId },
      include: {
        asset: { select: { id: true, name: true, tagNumber: true } },
        user: { select: { id: true, name: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Checkout record not found' },
        { status: 404 },
      );
    }

    if (existing.status !== 'checked_out' && existing.status !== 'overdue') {
      return NextResponse.json(
        { error: `Cannot return asset. Checkout status is "${existing.status}".` },
        { status: 409 },
      );
    }

    const body = await request.json();
    const validation = validateBody(checkoutReturnSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { conditionAtReturn, notes } = validation.data;

    const checkout = await db.assetCheckout.update({
      where: { id },
      data: {
        returnedAt: new Date(),
        conditionAtReturn: conditionAtReturn || null,
        notes: notes || existing.notes,
        status: 'returned',
      },
      include: {
        asset: {
          select: { id: true, name: true, qrCode: true, tagNumber: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Update asset status back to active and clear assignedTo
    const assetUpdateData: Record<string, unknown> = {
      status: 'active',
      assignedTo: null,
    };

    // If condition at return was provided, update the asset condition too
    if (conditionAtReturn) {
      assetUpdateData.condition = conditionAtReturn;
    }

    await db.asset.update({
      where: { id: existing.assetId },
      data: assetUpdateData,
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        assetId: existing.assetId,
        action: 'asset_returned',
        details: `Asset "${existing.asset.name}" (${existing.asset.tagNumber}) returned by "${existing.user.name}"${conditionAtReturn ? ` (condition: ${conditionAtReturn})` : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({ data: checkout });
  } catch (error) {
    console.error('Return checkout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
