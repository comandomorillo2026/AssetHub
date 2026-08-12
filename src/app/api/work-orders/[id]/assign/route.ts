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
        { error: 'Only administrators can assign work orders' },
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
    if (existing.status !== 'approved') {
      return NextResponse.json(
        { error: `Cannot assign work order with status "${existing.status}". Only approved work orders can be assigned.` },
        { status: 409 },
      );
    }

    const body = await request.json();
    const { assignedTo } = body;

    if (!assignedTo || typeof assignedTo !== 'string') {
      return NextResponse.json(
        { error: 'assignedTo (technician user ID) is required' },
        { status: 400 },
      );
    }

    // Verify the assignee belongs to the same tenant
    const assignee = await db.user.findFirst({
      where: { id: assignedTo, tenantId },
    });

    if (!assignee) {
      return NextResponse.json(
        { error: 'Assigned user not found or does not belong to your organization' },
        { status: 404 },
      );
    }

    const workOrder = await db.workOrder.update({
      where: { id },
      data: {
        status: 'in_progress',
        assignedTo,
        startedAt: new Date(),
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
        action: 'work_order_assigned',
        details: `Assigned work order "${existing.title}" to ${assignee.name} (${assignee.email})`,
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({ data: workOrder });
  } catch (error) {
    console.error('Assign work order error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
