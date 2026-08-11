import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-auth-tenant-id header is required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const entityType = searchParams.get('entityType');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

    const where: Record<string, unknown> = { tenantId };

    if (status) {
      const validStatuses = ['pending', 'processing', 'completed', 'failed', 'rolled_back'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
      where.status = status;
    }

    if (entityType) {
      const validTypes = ['assets', 'categories', 'locations', 'users'];
      if (!validTypes.includes(entityType)) {
        return NextResponse.json(
          { error: `Invalid entityType. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }
      where.entityType = entityType;
    }

    const skip = (page - 1) * limit;

    const [migrations, total] = await Promise.all([
      db.dataMigration.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.dataMigration.count({ where }),
    ]);

    // Compute aggregate stats for the tenant
    const [totalMigrations, completedMigrations, failedMigrations, totalProcessed, totalFailed] =
      await Promise.all([
        db.dataMigration.count({ where: { tenantId } }),
        db.dataMigration.count({ where: { tenantId, status: 'completed' } }),
        db.dataMigration.count({ where: { tenantId, status: 'failed' } }),
        db.dataMigration.aggregate({
          where: { tenantId },
          _sum: { processedRows: true },
        }),
        db.dataMigration.aggregate({
          where: { tenantId },
          _sum: { failedRows: true },
        }),
      ]);

    return NextResponse.json({
      data: migrations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total: totalMigrations,
        completed: completedMigrations,
        failed: failedMigrations,
        totalRowsProcessed: totalProcessed._sum.processedRows || 0,
        totalRowsFailed: totalFailed._sum.failedRows || 0,
      },
    });
  } catch (error) {
    console.error('List migrations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
