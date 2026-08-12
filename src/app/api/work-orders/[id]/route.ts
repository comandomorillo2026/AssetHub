import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requirePermission } from '@/lib/auth-helpers';
import { workOrderUpdateSchema, validateBody } from '@/lib/validations';

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

    const workOrder = await db.workOrder.findFirst({
      where: { id, tenantId },
      include: {
        asset: {
          select: { id: true, name: true, qrCode: true, tagNumber: true, serialNumber: true, status: true },
        },
        location: {
          select: { id: true, name: true, code: true, address: true },
        },
        requester: {
          select: { id: true, name: true, email: true },
        },
        assignee: {
          select: { id: true, name: true, email: true },
        },
        approver: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!workOrder) {
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: workOrder });
  } catch (error) {
    console.error('Get work order error:', error);
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

    // Only requester or admin can update work order fields
    if (existing.requestedBy !== userId && role !== 'admin') {
      return NextResponse.json(
        { error: 'Only the requester or an admin can update this work order' },
        { status: 403 },
      );
    }

    // Only allow updates on pending or rejected work orders
    if (!['pending', 'rejected'].includes(existing.status)) {
      return NextResponse.json(
        { error: `Cannot update work order with status "${existing.status}". Only pending or rejected work orders can be edited.` },
        { status: 409 },
      );
    }

    const body = await request.json();
    const validation = validateBody(workOrderUpdateSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { title, description, priority, assetId, locationId, assignedTo, dueDate, estimatedCost, actualCost } = validation.data;

    // Verify asset belongs to tenant if provided
    if (assetId) {
      const asset = await db.asset.findFirst({ where: { id: assetId, tenantId } });
      if (!asset) {
        return NextResponse.json(
          { error: 'Asset not found or does not belong to your organization' },
          { status: 404 },
        );
      }
    }

    // Verify location belongs to tenant if provided
    if (locationId) {
      const location = await db.location.findFirst({ where: { id: locationId, tenantId } });
      if (!location) {
        return NextResponse.json(
          { error: 'Location not found or does not belong to your organization' },
          { status: 404 },
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (priority !== undefined) updateData.priority = priority;
    if (assetId !== undefined) updateData.assetId = assetId;
    if (locationId !== undefined) updateData.locationId = locationId;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (dueDate !== undefined) updateData.dueDate = dueDate;
    if (estimatedCost !== undefined) updateData.estimatedCost = estimatedCost;
    if (actualCost !== undefined) updateData.actualCost = actualCost;

    // If rejected work order is being updated, reset to pending
    if (existing.status === 'rejected') {
      updateData.status = 'pending';
      updateData.rejectedBy = null;
      updateData.rejectedAt = null;
      updateData.rejectedReason = null;
    }

    const workOrder = await db.workOrder.update({
      where: { id },
      data: updateData,
      include: {
        asset: {
          select: { id: true, name: true, qrCode: true, tagNumber: true },
        },
        location: {
          select: { id: true, name: true, code: true },
        },
        requester: {
          select: { id: true, name: true, email: true },
        },
        assignee: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Create audit log
    const changes: string[] = [];
    if (title && title !== existing.title) changes.push('title updated');
    if (description !== undefined && description !== existing.description) changes.push('description updated');
    if (priority && priority !== existing.priority) changes.push(`priority: ${existing.priority} → ${priority}`);
    if (assetId !== undefined && assetId !== existing.assetId) changes.push('asset updated');
    if (locationId !== undefined && locationId !== existing.locationId) changes.push('location updated');
    if (dueDate !== undefined) changes.push('dueDate updated');
    if (estimatedCost !== undefined) changes.push('estimatedCost updated');

    if (changes.length > 0 || existing.status === 'rejected') {
      await db.auditLog.create({
        data: {
          tenantId,
          userId,
          assetId: assetId || existing.assetId || null,
          action: 'work_order_updated',
          details: `Updated work order "${existing.title}": ${changes.join('; ')}${existing.status === 'rejected' ? '; re-submitted from rejected' : ''}`,
          ipAddress: request.headers.get('x-forwarded-for') || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      });
    }

    return NextResponse.json({ data: workOrder });
  } catch (error) {
    console.error('Update work order error:', error);
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
    const { id } = await params;
    const auth = getAuthContext(request);
    if (auth instanceof NextResponse) return auth;

    const permCheck = requirePermission(auth, 'canDelete');
    if (permCheck) return permCheck;

    const { tenantId, userId } = auth;

    const existing = await db.workOrder.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 },
      );
    }

    // Only pending or rejected work orders can be deleted
    if (!['pending', 'rejected'].includes(existing.status)) {
      return NextResponse.json(
        { error: `Cannot delete work order with status "${existing.status}". Only pending or rejected work orders can be deleted.` },
        { status: 409 },
      );
    }

    await db.workOrder.delete({ where: { id } });

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId,
        userId,
        assetId: existing.assetId || null,
        action: 'work_order_deleted',
        details: `Deleted work order "${existing.title}" (was ${existing.status})`,
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({ message: 'Work order deleted successfully' });
  } catch (error) {
    console.error('Delete work order error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
