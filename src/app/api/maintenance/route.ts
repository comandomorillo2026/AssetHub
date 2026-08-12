import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requirePermission } from '@/lib/auth-helpers';
import { maintenanceCreateSchema, validateBody } from '@/lib/validations';

const VALID_TYPES = ['preventive', 'corrective', 'emergency'] as const;
type MaintenanceType = (typeof VALID_TYPES)[number];

const VALID_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'] as const;

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
    const assetId = searchParams.get('assetId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId };

    if (assetId) where.assetId = assetId;
    if (status) {
      if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
        return NextResponse.json(
          {
            error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
          },
          { status: 400 },
        );
      }
      where.status = status;
    }
    if (type) {
      if (!VALID_TYPES.includes(type as MaintenanceType)) {
        return NextResponse.json(
          {
            error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`,
          },
          { status: 400 },
        );
      }
      where.type = type;
    }

    const [maintenances, total] = await Promise.all([
      db.maintenance.findMany({
        where,
        skip: offset,
        take: limit,
        include: {
          asset: {
            select: {
              id: true,
              name: true,
              qrCode: true,
              tagNumber: true,
              serialNumber: true,
              status: true,
            },
          },
        },
        orderBy: { scheduledDate: 'desc' },
      }),
      db.maintenance.count({ where }),
    ]);

    return NextResponse.json({
      data: maintenances,
      pagination: {
        limit,
        offset,
        total,
      },
    });
  } catch (error) {
    console.error('List maintenance records error:', error);
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

    const validation = validateBody(maintenanceCreateSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const {
      assetId,
      type,
      description,
      scheduledDate,
      cost,
      vendor,
    } = validation.data;

    // Pull extra fields from the raw body that aren't in the schema
    const { title, vendorContact, performedBy, notes } = body;

    // Verify the asset belongs to the tenant
    const asset = await db.asset.findFirst({
      where: { id: assetId, tenantId },
    });

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found or does not belong to your organization' },
        { status: 404 },
      );
    }

    const maintenance = await db.maintenance.create({
      data: {
        tenantId,
        assetId,
        type,
        status: 'scheduled',
        title: title || description,
        description: description || null,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        cost: cost ?? null,
        vendor: vendor || null,
        vendorContact: vendorContact || null,
        performedBy: performedBy || null,
        notes: notes || null,
      },
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

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        assetId,
        action: 'maintenance_created',
        details: `Created maintenance record "${title || description}" (type: ${type}) for asset "${asset.name}"`,
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({ data: maintenance }, { status: 201 });
  } catch (error) {
    console.error('Create maintenance record error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
