import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requirePermission } from '@/lib/auth-helpers';
import { checkoutCreateSchema, validateBody } from '@/lib/validations';

const VALID_STATUSES = ['checked_out', 'returned', 'overdue'] as const;

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-auth-tenant-id header is required' },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId };

    if (assetId) where.assetId = assetId;
    if (userId) where.userId = userId;
    if (status) {
      if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
        return NextResponse.json(
          {
            error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
          },
          { status: 400 },
        );
      }
      where.status = status;
    }

    const [checkouts, total] = await Promise.all([
      db.assetCheckout.findMany({
        where,
        skip: offset,
        take: limit,
        include: {
          asset: {
            select: {
              id: true,
              name: true,
              qrCode: true,
              tagNumber: true,
              serialNumber: true,
              status: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              department: true,
            },
          },
        },
        orderBy: { checkedOutAt: 'desc' },
      }),
      db.assetCheckout.count({ where }),
    ]);

    return NextResponse.json({
      data: checkouts,
      pagination: {
        limit,
        offset,
        total,
      },
    });
  } catch (error) {
    console.error('List checkouts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
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

    const validation = validateBody(checkoutCreateSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { assetId, userId: targetUserId, expectedReturnAt, conditionAtCheckout, notes } = validation.data;

    // Verify the asset belongs to the tenant
    const asset = await db.asset.findFirst({
      where: { id: assetId, tenantId },
    });

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found or does not belong to your organization' },
        { status: 404 },
      );
    }

    // Verify the target user belongs to the tenant
    const targetUser = await db.user.findFirst({
      where: { id: targetUserId, tenantId },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found or does not belong to your organization' },
        { status: 404 },
      );
    }

    // Check if asset is already checked out
    const activeCheckout = await db.assetCheckout.findFirst({
      where: { assetId, tenantId, status: 'checked_out' },
    });

    if (activeCheckout) {
      return NextResponse.json(
        { error: 'Asset is already checked out. Please return it before checking out again.' },
        { status: 409 },
      );
    }

    const checkout = await db.assetCheckout.create({
      data: {
        tenantId,
        assetId,
        userId: targetUserId,
        expectedReturnAt: expectedReturnAt ? new Date(expectedReturnAt) : null,
        conditionAtCheckout: conditionAtCheckout || null,
        notes: notes || null,
        status: 'checked_out',
      },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            qrCode: true,
            tagNumber: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update asset status to checked_out and set assignedTo
    await db.asset.update({
      where: { id: assetId },
      data: {
        status: 'checked_out',
        assignedTo: targetUser.name,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        assetId,
        action: 'asset_checked_out',
        details: `Asset "${asset.name}" (${asset.tagNumber}) checked out to "${targetUser.name}"`,
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({ data: checkout }, { status: 201 });
  } catch (error) {
    console.error('Create checkout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
