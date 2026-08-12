import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = getAuthContext(request);
    if (auth instanceof NextResponse) return auth;

    const { tenantId, userId, role } = auth;

    const existing = await db.workOrder.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 },
      );
    }

    // Only admin or the original requester can cancel
    if (existing.requestedBy !== userId && role !== 'admin') {
      return NextResponse.json(
        { error: 'Only the requester or an admin can cancel this work order' },
        { status: 403 },
      );
    }

    // Validate current status - can cancel pending, approved, or in_progress
    if (!['pending', 'approved', 'in_progress'].includes(existing.status)) {
      return NextResponse.json(
        { error: `Cannot cancel work order with status "${existing.status}". Only pending, approved, or in_progress work orders can be cancelled.` },
        { status: 409 },
      );
    }

    const workOrder = await db.workOrder.update({
      where: { id },
      data: {
        status: 'cancelled',
      },
      include: {
        asset: {
          select: { id: true, name: true, tagNumber: true },
        },
        requester: {
          select: { id: true, name: true, email: true },
        },
        assignee: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        tenantId,
        userId,
        assetId: existing.assetId || null,
        action: 'work_order_cancelled',
        details: `Cancelled work order "${existing.title}" (was ${existing.status})`,
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({ data: workOrder });
  } catch (error) {
    console.error('Cancel work order error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
