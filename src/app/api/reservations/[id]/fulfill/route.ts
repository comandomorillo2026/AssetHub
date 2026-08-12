import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requirePermission } from '@/lib/auth-helpers';
import { checkoutCreateSchema, validateBody } from '@/lib/validations';

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

    const existing = await db.reservation.findFirst({
      where: { id, tenantId },
      include: {
        asset: { select: { id: true, name: true, tagNumber: true, status: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 },
      );
    }

    if (existing.status !== 'approved') {
      return NextResponse.json(
        { error: `Cannot fulfill reservation with status "${existing.status}". Only approved reservations can be fulfilled.` },
        { status: 409 },
      );
    }

    // Check if asset is already checked out
    const activeCheckout = await db.assetCheckout.findFirst({
      where: { assetId: existing.assetId, tenantId, status: 'checked_out' },
    });

    if (activeCheckout) {
      return NextResponse.json(
        { error: 'Asset is already checked out. Please return it before fulfilling this reservation.' },
        { status: 409 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const validation = validateBody(checkoutCreateSchema, {
      assetId: existing.assetId,
      userId: existing.userId,
      ...body,
    });

    // Use the reservation's dates for the checkout
    const expectedReturnAt = body.expectedReturnAt
      ? new Date(body.expectedReturnAt)
      : existing.endDate;
    const conditionAtCheckout = body.conditionAtCheckout || null;
    const notes = body.notes || `Fulfilled from reservation ${id}`;

    // Fulfill the reservation and create a checkout in a transaction
    const result = await db.$transaction([
      db.reservation.update({
        where: { id },
        data: { status: 'fulfilled' },
        include: {
          asset: { select: { id: true, name: true, qrCode: true, tagNumber: true } },
          user: { select: { id: true, name: true, email: true } },
          approvedByUser: { select: { id: true, name: true, email: true } },
        },
      }),
      db.assetCheckout.create({
        data: {
          tenantId,
          assetId: existing.assetId,
          userId: existing.userId,
          expectedReturnAt,
          conditionAtCheckout,
          notes,
          status: 'checked_out',
        },
        include: {
          asset: { select: { id: true, name: true, qrCode: true, tagNumber: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      db.asset.update({
        where: { id: existing.assetId },
        data: {
          status: 'checked_out',
          assignedTo: existing.user.name,
        },
      }),
    ]);

    const [reservation] = result;

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        assetId: existing.assetId,
        action: 'reservation_fulfilled',
        details: `Reservation for asset "${existing.asset.name}" (${existing.asset.tagNumber}) by "${existing.user.name}" fulfilled and asset checked out`,
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({ data: reservation });
  } catch (error) {
    console.error('Fulfill reservation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
