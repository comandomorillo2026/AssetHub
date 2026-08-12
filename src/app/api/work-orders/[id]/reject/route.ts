import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-helpers';
import { workOrderRejectSchema, validateBody } from '@/lib/validations';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = getAuthContext(request);
    if (auth instanceof NextResponse) return auth;

    const { tenantId, userId, role } = auth;

    // Admin only
    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Only administrators can reject work orders' },
        { status: 403 },
      );
    }

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
    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot reject work order with status "${existing.status}". Only pending work orders can be rejected.` },
        { status: 409 },
      );
    }

    const body = await request.json();
    const validation = validateBody(workOrderRejectSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { reason } = validation.data;

    const workOrder = await db.workOrder.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectedBy: userId,
        rejectedAt: new Date(),
        rejectedReason: reason,
      },
      include: {
        asset: {
          select: { id: true, name: true, tagNumber: true },
        },
        requester: {
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
        action: 'work_order_rejected',
        details: `Rejected work order "${existing.title}". Reason: ${reason}`,
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({ data: workOrder });
  } catch (error) {
    console.error('Reject work order error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
