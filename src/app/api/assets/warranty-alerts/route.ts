import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (auth instanceof NextResponse) return auth;

    const { tenantId } = auth;

    const { searchParams } = new URL(request.url);
    let days = parseInt(searchParams.get('days') || '30', 10);
    days = Math.min(Math.max(days, 1), 365);

    const now = new Date();
    const futureCutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    // Find assets expiring within the window (warrantyExpiry between now and now+days)
    const expiringAssets = await db.asset.findMany({
      where: {
        tenantId,
        warrantyExpiry: {
          not: null,
          gte: now,
          lte: futureCutoff,
        },
      },
      include: {
        category: { select: { id: true, name: true, code: true, color: true, icon: true } },
        location: { select: { id: true, name: true, code: true } },
      },
      orderBy: { warrantyExpiry: 'asc' },
    });

    // Find already-expired assets (warrantyExpiry in the past)
    const expiredAssets = await db.asset.findMany({
      where: {
        tenantId,
        warrantyExpiry: {
          not: null,
          lt: now,
        },
      },
      include: {
        category: { select: { id: true, name: true, code: true, color: true, icon: true } },
        location: { select: { id: true, name: true, code: true } },
      },
      orderBy: { warrantyExpiry: 'desc' },
    });

    function enrichWithDays(asset: typeof expiringAssets[number]) {
      const warrantyDate = new Date(asset.warrantyExpiry!);
      const diffMs = warrantyDate.getTime() - now.getTime();
      const daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return {
        ...asset,
        daysUntilExpiry,
        categoryName: asset.category?.name ?? null,
        locationName: asset.location?.name ?? null,
      };
    }

    const expiring = expiringAssets.map(enrichWithDays);
    const expired = expiredAssets.map(enrichWithDays);
    const total = expiring.length + expired.length;

    return NextResponse.json({ expiring, expired, total });
  } catch (error) {
    console.error('Warranty alerts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
