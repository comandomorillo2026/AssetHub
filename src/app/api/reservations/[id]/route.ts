import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requirePermission } from '@/lib/auth-helpers';
import { reservationUpdateSchema, validateBody } from '@/lib/validations';

const VALID_STATUSES = ['pending', 'approved', 'rejected', 'fulfilled', 'completed', 'cancelled'] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tenantId = request.headers.get('x-auth-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-auth-tenant-id header is required' },
        { status: 400 },
      );
    }

    const reservation = await db.reservation.findFirst({
      where: { id, tenantId },
      include: {
        asset: {
          include: {
            category: {
              select: { id: true, name: true, code: true, color: true, icon: true },
            },
            location: {
              select: { id: true, name: true, code: true, address: true },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            jobTitle: true,
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
    });

    if (!reservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: reservation });
  } catch (error) {
    console.error('Get reservation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PUT(
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
        user: { select: { id: true, name: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 },
      );
    }

    // Only allow edits on pending or rejected reservations
    if (existing.status !== 'pending' && existing.status !== 'rejected') {
      return NextResponse.json(
        { error: `Cannot edit reservation with status "${existing.status}". Only pending or rejected reservations can be edited.` },
        { status: 409 },
      );
    }

    const body = await request.json();
    const validation = validateBody(reservationUpdateSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { purpose, startDate, endDate, notes } = validation.data;

    const updateData: Record<string, unknown> = {};
    if (purpose !== undefined) updateData.purpose = purpose;
    if (notes !== undefined) updateData.notes = notes;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = new Date(endDate);

    // Validate date range if both are provided
    if (startDate && endDate) {
      if (new Date(endDate) <= new Date(startDate)) {
        return NextResponse.json(
          { error: 'End date must be after start date' },
          { status: 400 },
        );
      }

      // Check for conflicting reservations
      const conflicting = await db.reservation.findFirst({
        where: {
          assetId: existing.assetId,
          tenantId,
          status: { in: ['pending', 'approved', 'fulfilled'] },
          id: { not: id },
          startDate: { lt: new Date(endDate) },
          endDate: { gt: new Date(startDate) },
        },
      });

      if (conflicting) {
        return NextResponse.json(
          { error: 'Asset already has a reservation overlapping with the requested period' },
          { status: 409 },
        );
      }
    } else if (startDate || endDate) {
      // Partial date update: check against the other existing date
      const effectiveStart = startDate ? new Date(startDate) : existing.startDate;
      const effectiveEnd = endDate ? new Date(endDate) : existing.endDate;
      if (effectiveEnd <= effectiveStart) {
        return NextResponse.json(
          { error: 'End date must be after start date' },
          { status: 400 },
        );
      }
    }

    // If re-editing a rejected reservation, reset to pending
    if (existing.status === 'rejected') {
      updateData.status = 'pending';
    }

    const reservation = await db.reservation.update({
      where: { id },
      data: updateData,
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
        action: 'reservation_updated',
        details: `Updated reservation for asset "${existing.asset.name}" (${existing.asset.tagNumber}) by "${existing.user.name}"`,
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({ data: reservation });
  } catch (error) {
    console.error('Update reservation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = getAuthContext(request);
    if (auth instanceof NextResponse) return auth;

    const permCheck = requirePermission(auth, 'canDelete');
    if (permCheck) return permCheck;

    const { tenantId, userId } = auth;
    const { id } = await params;

    const existing = await db.reservation.findFirst({
      where: { id, tenantId },
      include: {
        asset: { select: { id: true, name: true, tagNumber: true } },
        user: { select: { id: true, name: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 },
      );
    }

    // Only allow deletion of pending or rejected reservations
    if (!['pending', 'rejected'].includes(existing.status)) {
      return NextResponse.json(
        {
          error: `Cannot delete reservation with status "${existing.status}". Only pending or rejected reservations can be deleted.`,
        },
        { status: 409 },
      );
    }

    await db.reservation.delete({ where: { id } });

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        assetId: existing.assetId,
        action: 'reservation_deleted',
        details: `Deleted reservation for asset "${existing.asset.name}" (${existing.asset.tagNumber}) by "${existing.user.name}"`,
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({ message: 'Reservation deleted successfully' });
  } catch (error) {
    console.error('Delete reservation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
