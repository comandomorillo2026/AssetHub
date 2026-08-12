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

    // Admin only
    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Only administrators can close work orders' },
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
    if (existing.status !== 'completed') {
      return NextResponse.json(
        { error: `Cannot close work order with status "${existing.status}". Only completed work orders can be closed.` },
        { status: 409 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { closedNotes, actualCost } = body as { closedNotes?: string; actualCost?: number };

    const updateData: Record<string, unknown> = {
      status: 'closed',
      closedAt: new Date(),
    };

    if (closedNotes !== undefined) updateData.closedNotes = closedNotes;
    if (actualCost !== undefined) updateData.actualCost = actualCost;

    const workOrder = await db.workOrder.update({
      where: { id },
      data: updateData,
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
    const details = [`Closed work order "${existing.title}"`];
    if (closedNotes) details.push(`Notes: ${closedNotes}`);
    if (actualCost !== undefined) details.push(`Actual cost: ${actualCost}`);

    await db.auditLog.create({
      data: {
        tenantId,
        userId,
        assetId: existing.assetId || null,
        action: 'work_order_closed',
        details: details.join('. '),
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({ data: workOrder });
  } catch (error) {
    console.error('Close work order error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
