import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requirePermission } from '@/lib/auth-helpers';
import { reservationCreateSchema, validateBody } from '@/lib/validations';

const VALID_STATUSES = ['pending', 'approved', 'rejected', 'fulfilled', 'completed', 'cancelled'] as const;

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

    const [reservations, total] = await Promise.all([
      db.reservation.findMany({
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
          approvedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.reservation.count({ where }),
    ]);

    return NextResponse.json({
      data: reservations,
      pagination: {
        limit,
        offset,
        total,
      },
    });
  } catch (error) {
    console.error('List reservations error:', error);
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

    const validation = validateBody(reservationCreateSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const {
      assetId,
      userId: targetUserId,
      purpose,
      startDate,
      endDate,
      notes,
    } = validation.data;

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

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 },
      );
    }

    // Check for conflicting reservations on the same asset
    const conflicting = await db.reservation.findFirst({
      where: {
        assetId,
        tenantId,
        status: { in: ['pending', 'approved', 'fulfilled'] },
        startDate: { lt: end },
        endDate: { gt: start },
      },
    });

    if (conflicting) {
      return NextResponse.json(
        { error: 'Asset already has a reservation overlapping with the requested period' },
        { status: 409 },
      );
    }

    const reservation = await db.reservation.create({
      data: {
        tenantId,
        assetId,
        userId: targetUserId,
        purpose: purpose || null,
        startDate: start,
        endDate: end,
        notes: notes || null,
        status: 'pending',
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

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        assetId,
        action: 'reservation_created',
        details: `Reservation created for asset "${asset.name}" (${asset.tagNumber}) by "${targetUser.name}" from ${start.toISOString()} to ${end.toISOString()}`,
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({ data: reservation }, { status: 201 });
  } catch (error) {
    console.error('Create reservation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
