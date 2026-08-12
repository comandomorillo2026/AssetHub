import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = getAuthContext(request);
    if (auth instanceof NextResponse) return auth;

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

    if (!['pending', 'approved'].includes(existing.status)) {
      return NextResponse.json(
        { error: `Cannot cancel reservation with status "${existing.status}". Only pending or approved reservations can be cancelled.` },
        { status: 409 },
      );
    }

    const reservation = await db.reservation.update({
      where: { id },
      data: {
        status: 'cancelled',
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

    // If fulfilled, the asset might need its status restored
    // (but cancel is only allowed from pending/approved, so no asset status change needed)

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        assetId: existing.assetId,
        action: 'reservation_cancelled',
        details: `Reservation for asset "${existing.asset.name}" (${existing.asset.tagNumber}) by "${existing.user.name}" cancelled`,
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({ data: reservation });
  } catch (error) {
    console.error('Cancel reservation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
