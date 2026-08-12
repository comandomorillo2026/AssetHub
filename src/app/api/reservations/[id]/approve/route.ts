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

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot approve reservation with status "${existing.status}". Only pending reservations can be approved.` },
        { status: 409 },
      );
    }

    // Re-check for conflicting approved/fulfilled reservations
    const conflicting = await db.reservation.findFirst({
      where: {
        assetId: existing.assetId,
        tenantId,
        status: { in: ['approved', 'fulfilled'] },
        id: { not: id },
        startDate: { lt: existing.endDate },
        endDate: { gt: existing.startDate },
      },
    });

    if (conflicting) {
      return NextResponse.json(
        { error: 'A conflicting reservation already exists for this asset in the requested period' },
        { status: 409 },
      );
    }

    const reservation = await db.reservation.update({
      where: { id },
      data: {
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
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
        action: 'reservation_approved',
        details: `Reservation for asset "${existing.asset.name}" (${existing.asset.tagNumber}) by "${existing.user.name}" approved`,
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({ data: reservation });
  } catch (error) {
    console.error('Approve reservation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
