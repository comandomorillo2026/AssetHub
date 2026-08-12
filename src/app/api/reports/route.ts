import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-auth-tenant-id header is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'dashboard';
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const dateFilter: Record<string, unknown> = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) (dateFilter.createdAt as Record<string, Date>).gte = new Date(from);
      if (to) (dateFilter.createdAt as Record<string, Date>).lte = new Date(to);
    }

    switch (type) {
      case 'dashboard': {
        const tenant = await db.tenant.findUnique({
          where: { id: tenantId },
          select: { currency: true },
        });

        const [totalAssets, assetsByStatus, categories, locations, recentLogs] =
          await Promise.all([
            db.asset.count({ where: { tenantId } }),
            db.asset.groupBy({
              by: ['status'],
              where: { tenantId },
              _count: { status: true },
            }),
            db.category.findMany({
              where: { tenantId },
              include: { _count: { select: { assets: true } } },
              orderBy: { name: 'asc' },
            }),
            db.location.findMany({
              where: { tenantId },
              include: { _count: { select: { assets: true } } },
              orderBy: { name: 'asc' },
            }),
            db.auditLog.findMany({
              where: { tenantId },
              take: 20,
              orderBy: { createdAt: 'desc' },
              include: {
                user: { select: { id: true, name: true, email: true } },
                asset: { select: { id: true, name: true, tagNumber: true, qrCode: true } },
              },
            }),
          ]);

        const totalValue = await db.asset.aggregate({
          where: { tenantId, currentValue: { not: null } },
          _sum: { currentValue: true },
        });

        const activeAssets = assetsByStatus.find((s) => s.status === 'active')?._count.status || 0;
        const pendingInventories = await db.inventorySession.count({
          where: { tenantId, status: 'in_progress' },
        });

        const [categoryCurrentValues, categoryFallbackValues] = await Promise.all([
          db.asset.groupBy({
            by: ['categoryId'],
            where: { tenantId, currentValue: { not: null } },
            _sum: { currentValue: true },
          }),
          db.asset.groupBy({
            by: ['categoryId'],
            where: { tenantId, currentValue: null },
            _sum: { purchasePrice: true },
          }),
        ]);

        const categoryValueMap = new Map<string, number>();
        for (const row of categoryCurrentValues) {
          const id = row.categoryId!;
          categoryValueMap.set(id, (categoryValueMap.get(id) || 0) + (row._sum.currentValue || 0));
        }
        for (const row of categoryFallbackValues) {
          const id = row.categoryId!;
          categoryValueMap.set(id, (categoryValueMap.get(id) || 0) + (row._sum.purchasePrice || 0));
        }

        return NextResponse.json({
          totalAssets,
          activeAssets,
          totalValue: totalValue._sum.currentValue || 0,
          currency: tenant?.currency || 'TTD',
          pendingInventories,
          byStatus: assetsByStatus.map((s) => ({
            status: s.status,
            count: s._count.status,
          })),
          byCategory: categories.map((c) => ({
            category: c.name,
            count: c._count.assets,
            value: categoryValueMap.get(c.id) || 0,
          })),
          byLocation: locations.map((l) => ({
            location: l.name,
            count: l._count.assets,
          })),
          recentLogs: recentLogs.map((log) => ({
            id: log.id,
            action: log.action,
            details: log.details,
            createdAt: log.createdAt.toISOString(),
            user: log.user ? { name: log.user.name } : undefined,
          })),
        });
      }

      case 'assets_by_category': {
        const categories = await db.category.findMany({
          where: { tenantId },
          include: { _count: { select: { assets: true } } },
          orderBy: { name: 'asc' },
        });
        return NextResponse.json({
          data: categories.map((c) => ({
            id: c.id,
            name: c.name,
            code: c.code,
            color: c.color,
            assetCount: c._count.assets,
          })),
        });
      }

      case 'assets_by_location': {
        const locations = await db.location.findMany({
          where: { tenantId },
          include: { _count: { select: { assets: true } } },
          orderBy: { name: 'asc' },
        });
        return NextResponse.json({
          data: locations.map((l) => ({
            id: l.id,
            name: l.name,
            code: l.code,
            assetCount: l._count.assets,
          })),
        });
      }

      case 'discrepancies': {
 const discrepancySessions = await db.inventorySession.findMany({
          where: {
            tenantId,
            status: 'completed',
            ...(Object.keys(dateFilter).length > 0 ? dateFilter : {}),
          },
          include: {
            location: { select: { id: true, name: true } },
            items: {
              where: { discrepancyType: { not: null } },
            },
          },
          orderBy: { completedAt: 'desc' },
        });

        const allDiscrepancies = discrepancySessions.flatMap((s) =>
          s.items.map((item) => ({
            ...item,
            sessionName: s.name,
            sessionDate: s.completedAt,
            locationName: s.location?.name || 'All Locations',
          }))
        );

        return NextResponse.json({ data: allDiscrepancies });
      }

      case 'audit_trail': {
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        const skip = (page - 1) * limit;
        const action = searchParams.get('action');

        const where: Record<string, unknown> = { tenantId };
        if (action) where.action = action;
        if (Object.keys(dateFilter).length > 0) {
          Object.assign(where, dateFilter);
        }

        const [logs, total] = await Promise.all([
          db.auditLog.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
              user: { select: { id: true, name: true, email: true } },
              asset: { select: { id: true, name: true, tagNumber: true, qrCode: true } },
            },
          }),
          db.auditLog.count({ where }),
        ]);

        return NextResponse.json({
          data: logs,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown report type: ${type}. Use dashboard|discrepancies|assets_by_category|assets_by_location|audit_trail` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
