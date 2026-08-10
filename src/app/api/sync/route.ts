import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 400 });
    }

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

      try {
        let result;

        switch (entity) {
          case 'asset': {
            if (operation === 'create') {
              result = await db.asset.create({
                data: { ...payload, tenantId },
              });
            } else if (operation === 'update' && entityId) {
              const { id, tenantId: _, ...updatePayload } = payload;
              result = await db.asset.update({
                where: { id: entityId, tenantId },
                data: updatePayload,
              });
            } else if (operation === 'delete' && entityId) {
              result = await db.asset.delete({
                where: { id: entityId, tenantId },
              });
            }
            break;
          }

          case 'inventory_item': {
            if (operation === 'create') {
              result = await db.inventoryItem.create({
                data: { ...payload },
              });
            } else if (operation === 'update' && entityId) {
              const { id, ...updatePayload } = payload;
              result = await db.inventoryItem.update({
                where: { id: entityId },
                data: updatePayload,
              });
            }
            break;
          }

          case 'audit_log': {
            if (operation === 'create') {
              result = await db.auditLog.create({
                data: { ...payload, tenantId },
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

    // Queue any failed operations for retry
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
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const entity = searchParams.get('entity');
    const since = searchParams.get('since');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    // Return pending sync queue items for this tenant
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

    // Mark as synced
    if (pendingItems.length > 0) {
      await db.syncQueue.updateMany({
        where: {
          id: { in: pendingItems.map((item) => item.id) },
        },
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
