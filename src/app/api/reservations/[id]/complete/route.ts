import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requirePermission } from '@/lib/auth-helpers';

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
        asset: { select: { id: true, name: true, tagNumber: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 },
      );
    }

    if (existing.status !== 'fulfilled') {
      return NextResponse.json(
        { error: `Cannot complete reservation with status "${existing.status}". Only fulfilled reservations can be completed.` },
        { status: 409 },
      );
    }

    // Verify the asset has been returned (no active checkout)
    const activeCheckout = await db.assetCheckout.findFirst({
      where: {
        assetId: existing.assetId,
        tenantId,
        userId: existing.userId,
        status: 'checked_out',
      },
    });

    if (activeCheckout) {
      return NextResponse.json(
        { error: 'Asset has not been returned yet. Please return the asset before completing the reservation.' },
        { status: 409 },
      );
    }

    const reservation = await db.reservation.update({
      where: { id },
      data: {
        status: 'completed',
      },
      include: {
        asset: {
          select: { id: true, name: true, qrCode: true, tagNumber: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
        approvedByUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        assetId: existing.assetId,
        action: 'reservation_completed',
        details: `Reservation for asset "${existing.asset.name}" (${existing.asset.tagNumber}) by "${existing.user.name}" completed`,
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({ data: reservation });
  } catch (error) {
    console.error('Complete reservation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
