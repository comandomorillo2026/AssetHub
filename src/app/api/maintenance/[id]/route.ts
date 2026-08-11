import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const VALID_TYPES = ['preventive', 'corrective', 'emergency'] as const;
const VALID_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'] as const;

// Valid status transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
  scheduled: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: ['scheduled'], // allow re-opening
  cancelled: ['scheduled'], // allow re-opening
};

type UpdateMaintenanceBody = {
  type?: string;
  title?: string;
  description?: string;
  scheduledDate?: string;
  cost?: number;
  vendor?: string;
  vendorContact?: string;
  performedBy?: string;
  notes?: string;
  status?: string;
};

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

    const maintenance = await db.maintenance.findFirst({
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
      },
    });

    if (!maintenance) {
      return NextResponse.json(
        { error: 'Maintenance record not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: maintenance });
  } catch (error) {
    console.error('Get maintenance record error:', error);
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
    const tenantId = request.headers.get('x-auth-tenant-id');
    const userId = request.headers.get('x-auth-user-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-auth-tenant-id header is required' },
        { status: 400 },
      );
    }

    const existing = await db.maintenance.findFirst({
      where: { id, tenantId },
      include: {
        asset: { select: { id: true, name: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Maintenance record not found' },
        { status: 404 },
      );
    }

    const body: UpdateMaintenanceBody = await request.json();
    const {
      type,
      title,
      description,
      scheduledDate,
      cost,
      vendor,
      vendorContact,
      performedBy,
      notes,
      status,
    } = body;

    // Validate type if provided
    if (type && !VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    // Validate and check status transition if provided
    if (status) {
      if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
          { status: 400 },
        );
      }

      const allowedTransitions = STATUS_TRANSITIONS[existing.status];
      if (!allowedTransitions.includes(status)) {
        return NextResponse.json(
          {
            error: `Cannot transition from "${existing.status}" to "${status}". Allowed transitions: ${allowedTransitions.join(', ')}`,
          },
          { status: 409 },
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (type !== undefined) updateData.type = type;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (scheduledDate !== undefined)
      updateData.scheduledDate = scheduledDate ? new Date(scheduledDate) : null;
    if (cost !== undefined)
      updateData.cost = cost != null ? parseFloat(String(cost)) : null;
    if (vendor !== undefined) updateData.vendor = vendor;
    if (vendorContact !== undefined) updateData.vendorContact = vendorContact;
    if (performedBy !== undefined) updateData.performedBy = performedBy;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;

    // If transitioning to completed, set completedDate
    if (status === 'completed') {
      updateData.completedDate = new Date();
    }

    const maintenance = await db.maintenance.update({
      where: { id },
      data: updateData,
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            qrCode: true,
            tagNumber: true,
          },
        },
      },
    });

    // Create audit log for status changes
    if (status && status !== existing.status) {
      await db.auditLog.create({
        data: {
          tenantId,
          userId: userId || null,
          assetId: existing.assetId,
          action: 'maintenance_status_changed',
          details: `Maintenance "${existing.title}" status changed from "${existing.status}" to "${status}" for asset "${existing.asset.name}"`,
          ipAddress: request.headers.get('x-forwarded-for') || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      });
    }

    // Create audit log for general updates (non-status changes)
    if (type || title || description || scheduledDate || cost || vendor || vendorContact || performedBy || notes) {
      const changes: string[] = [];
      if (type && type !== existing.type) changes.push(`type: ${existing.type} → ${type}`);
      if (title && title !== existing.title) changes.push(`title updated`);
      if (description !== undefined && description !== existing.description) changes.push('description updated');
      if (scheduledDate !== undefined) changes.push('scheduledDate updated');
      if (cost !== undefined && cost !== existing.cost) changes.push(`cost: ${existing.cost} → ${cost}`);
      if (vendor !== undefined && vendor !== existing.vendor) changes.push('vendor updated');
      if (vendorContact !== undefined && vendorContact !== existing.vendorContact) changes.push('vendorContact updated');
      if (performedBy !== undefined && performedBy !== existing.performedBy) changes.push('performedBy updated');
      if (notes !== undefined && notes !== existing.notes) changes.push('notes updated');

      if (changes.length > 0) {
        await db.auditLog.create({
          data: {
            tenantId,
            userId: userId || null,
            assetId: existing.assetId,
            action: 'maintenance_updated',
            details: `Updated maintenance "${existing.title}" for asset "${existing.asset.name}": ${changes.join('; ')}`,
            ipAddress: request.headers.get('x-forwarded-for') || null,
            userAgent: request.headers.get('user-agent') || null,
          },
        });
      }
    }

    return NextResponse.json({ data: maintenance });
  } catch (error) {
    console.error('Update maintenance record error:', error);
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
    const tenantId = request.headers.get('x-auth-tenant-id');
    const userId = request.headers.get('x-auth-user-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-auth-tenant-id header is required' },
        { status: 400 },
      );
    }

    const existing = await db.maintenance.findFirst({
      where: { id, tenantId },
      include: {
        asset: { select: { id: true, name: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Maintenance record not found' },
        { status: 404 },
      );
    }

    if (existing.status !== 'scheduled') {
      return NextResponse.json(
        {
          error: `Cannot delete maintenance record with status "${existing.status}". Only scheduled maintenance records can be deleted.`,
        },
        { status: 409 },
      );
    }

    await db.maintenance.delete({ where: { id } });

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        assetId: existing.assetId,
        action: 'maintenance_deleted',
        details: `Deleted scheduled maintenance "${existing.title}" for asset "${existing.asset.name}"`,
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({ message: 'Maintenance record deleted successfully' });
  } catch (error) {
    console.error('Delete maintenance record error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
