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

    // Validate current status
    if (existing.status !== 'in_progress') {
      return NextResponse.json(
        { error: `Cannot complete work order with status "${existing.status}". Only in_progress work orders can be completed.` },
        { status: 409 },
      );
    }

    // Only assignee or admin can complete
    if (existing.assignedTo !== userId && role !== 'admin') {
      return NextResponse.json(
        { error: 'Only the assigned technician or an admin can complete this work order' },
        { status: 403 },
      );
    }

    const workOrder = await db.workOrder.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date(),
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
        action: 'work_order_completed',
        details: `Completed work order "${existing.title}"`,
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({ data: workOrder });
  } catch (error) {
    console.error('Complete work order error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
