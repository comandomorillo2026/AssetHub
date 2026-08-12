import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Allowed fields for each entity — anything not listed here is stripped
const ASSET_ALLOWED_FIELDS = [
  'name', 'description', 'serialNumber', 'brand', 'model',
  'tagNumber', 'qrCode', 'status', 'condition', 'assignedTo',
  'purchaseDate', 'purchasePrice', 'currentValue', 'warrantyExpiry',
  'categoryId', 'locationId', 'notes',
];

const INVENTORY_ITEM_ALLOWED_FIELDS = [
  'inventorySessionId', 'assetId', 'expectedStatus', 'actualStatus', 'notes',
];

const AUDIT_LOG_ALLOWED_FIELDS = [
  'action', 'details', 'userId', 'entityType', 'entityId',
];

function stripPayload(payload: Record<string, unknown>, allowedFields: string[]): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in payload && payload[key] !== undefined) {
      clean[key] = payload[key];
    }
  }
  return clean;
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const userId = request.headers.get('x-auth-user-id') || '';

    const body = await request.json();
    const { operations } = body;

    if (!Array.isArray(operations) || operations.length === 0) {
      return NextResponse.json({ error: 'operations array is required' }, { status: 400 });
    }

    if (operations.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 operations per request' },
        { status: 400 }
      );
    }

    const results: { index: number; success: boolean; id?: string; error?: string }[] = [];

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const { operation, entity, entityId, payload } = op;

      // Validate operation type
      if (!['create', 'update', 'delete'].includes(operation)) {
        results.push({ index: i, success: false, error: `Invalid operation: ${operation}` });
        continue;
      }

      try {
        let result;

        switch (entity) {
          case 'asset': {
            const cleanPayload = stripPayload(payload || {}, ASSET_ALLOWED_FIELDS);
            if (operation === 'create') {
              result = await db.asset.create({
                data: { ...cleanPayload, tenantId },
              });
            } else if (operation === 'update' && entityId) {
              // Verify asset belongs to this tenant before updating
              const existing = await db.asset.findFirst({ where: { id: entityId, tenantId } });
              if (!existing) {
                results.push({ index: i, success: false, error: 'Asset not found or belongs to another tenant' });
                continue;
              }
              result = await db.asset.update({
                where: { id: entityId },
                data: cleanPayload,
              });
            } else if (operation === 'delete' && entityId) {
              const existing = await db.asset.findFirst({ where: { id: entityId, tenantId } });
              if (!existing) {
                results.push({ index: i, success: false, error: 'Asset not found or belongs to another tenant' });
                continue;
              }
              result = await db.asset.delete({ where: { id: entityId } });
            }
            break;
          }

          case 'inventory_item': {
            const cleanPayload = stripPayload(payload || {}, INVENTORY_ITEM_ALLOWED_FIELDS);
            if (operation === 'create') {
              // Verify the inventory session belongs to this tenant
              if (cleanPayload.inventorySessionId) {
                const session = await db.inventorySession.findFirst({
                  where: { id: cleanPayload.inventorySessionId as string, tenantId },
                });
                if (!session) {
                  results.push({ index: i, success: false, error: 'Inventory session not found for this tenant' });
                  continue;
                }
              }
              result = await db.inventoryItem.create({
                data: { ...cleanPayload },
              });
            } else if (operation === 'update' && entityId) {
              const cleanUpdate = stripPayload(payload || {}, INVENTORY_ITEM_ALLOWED_FIELDS);
              // Verify through the inventory session
              const existingItem = await db.inventoryItem.findUnique({ where: { id: entityId }, include: { inventorySession: { select: { tenantId: true } } } });
              if (!existingItem || existingItem.inventorySession.tenantId !== tenantId) {
                results.push({ index: i, success: false, error: 'Inventory item not found or belongs to another tenant' });
                continue;
              }
              result = await db.inventoryItem.update({
                where: { id: entityId },
                data: cleanUpdate,
              });
            }
            break;
          }

          case 'audit_log': {
            const cleanPayload = stripPayload(payload || {}, AUDIT_LOG_ALLOWED_FIELDS);
            if (operation === 'create') {
              result = await db.auditLog.create({
                data: { ...cleanPayload, tenantId, userId },
              });
            }
            break;
          }

          default:
            results.push({ index: i, success: false, error: `Unknown entity: ${entity}` });
            continue;
        }

        results.push({ index: i, success: true, id: result?.id });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        results.push({ index: i, success: false, error: message });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    // Queue failed operations for retry
    const failedOps = operations.filter((_: unknown, i: number) => !results[i]?.success);
    if (failedOps.length > 0) {
      await db.syncQueue.createMany({
        data: failedOps.map((op: Record<string, unknown>) => ({
          operation: op.operation as string,
          entity: op.entity as string,
          entityId: (op.entityId as string) || null,
          payload: JSON.stringify(op.payload),
          status: 'failed',
          attempts: 1,
          tenantId,
        })),
      });
    }

    return NextResponse.json({
      data: results,
      summary: { total: operations.length, succeeded, failed },
    });
  } catch (error) {
    console.error('Sync push error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const entity = searchParams.get('entity');
    const since = searchParams.get('since');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const where: Record<string, unknown> = { tenantId, status: 'pending' };
    if (entity) where.entity = entity;
    if (since) {
      where.createdAt = { gte: new Date(since) };
    }

    const pendingItems = await db.syncQueue.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    // Mark as synced only after successful retrieval
    if (pendingItems.length > 0) {
      await db.syncQueue.updateMany({
        where: { id: { in: pendingItems.map((item) => item.id) } },
        data: { status: 'synced' },
      });
    }

    return NextResponse.json({
      data: pendingItems,
      count: pendingItems.length,
    });
  } catch (error) {
    console.error('Sync pull error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
