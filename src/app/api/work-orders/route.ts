import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requirePermission } from '@/lib/auth-helpers';
import { workOrderCreateSchema, validateBody } from '@/lib/validations';

const VALID_STATUSES = ['pending', 'approved', 'rejected', 'in_progress', 'completed', 'closed', 'cancelled'] as const;
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-auth-tenant-id header is required' },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const assetId = searchParams.get('assetId');
    const assignedTo = searchParams.get('assignedTo');
    const requestedBy = searchParams.get('requestedBy');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId };

    if (status) {
      if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
          { status: 400 },
        );
      }
      where.status = status;
    }

    if (priority) {
      if (!VALID_PRIORITIES.includes(priority as (typeof VALID_PRIORITIES)[number])) {
        return NextResponse.json(
          { error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` },
          { status: 400 },
        );
      }
      where.priority = priority;
    }

    if (assetId) where.assetId = assetId;
    if (assignedTo) where.assignedTo = assignedTo;
    if (requestedBy) where.requestedBy = requestedBy;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [workOrders, total] = await Promise.all([
      db.workOrder.findMany({
        where,
        skip: offset,
        take: limit,
        include: {
          asset: {
            select: { id: true, name: true, qrCode: true, tagNumber: true, serialNumber: true, status: true },
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
        orderBy: { createdAt: 'desc' },
      }),
      db.workOrder.count({ where }),
    ]);

    return NextResponse.json({
      data: workOrders,
      pagination: { limit, offset, total },
    });
  } catch (error) {
    console.error('List work orders error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (auth instanceof NextResponse) return auth;

    const permCheck = requirePermission(auth, 'canCreate');
    if (permCheck) return permCheck;

    const { tenantId, userId } = auth;

    const body = await request.json();
    const validation = validateBody(workOrderCreateSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { title, description, priority, assetId, locationId, dueDate, estimatedCost } = validation.data;

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

    const workOrder = await db.workOrder.create({
      data: {
        tenantId,
        title,
        description: description || null,
        priority,
        status: 'pending',
        requestedBy: userId,
        assetId: assetId || null,
        locationId: locationId || null,
        dueDate: dueDate || null,
        estimatedCost: estimatedCost != null ? estimatedCost : null,
      },
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
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId,
        userId,
        assetId: assetId || null,
        action: 'work_order_created',
        details: `Created work order "${title}" (priority: ${priority})`,
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({ data: workOrder }, { status: 201 });
  } catch (error) {
    console.error('Create work order error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
