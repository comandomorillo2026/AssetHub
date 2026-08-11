import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
    const fiscalYear = searchParams.get('fiscalYear');
    const assetId = searchParams.get('assetId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId };

    if (fiscalYear) {
      const year = parseInt(fiscalYear, 10);
      if (isNaN(year) || year < 1900 || year > 2200) {
        return NextResponse.json(
          { error: 'fiscalYear must be a valid year between 1900 and 2200' },
          { status: 400 },
        );
      }
      where.fiscalYear = year;
    }

    if (assetId) {
      where.assetId = assetId;
    }

    const [records, total] = await Promise.all([
      db.depreciation.findMany({
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
            },
          },
        },
        orderBy: [
          { fiscalYear: 'desc' },
          { calculatedAt: 'desc' },
        ],
      }),
      db.depreciation.count({ where }),
    ]);

    // Summarize totals
    const summaryResult = await db.depreciation.aggregate({
      _sum: {
        periodDepreciation: true,
        accumulatedDepreciation: true,
      },
      where,
    });

    return NextResponse.json({
      data: records,
      pagination: {
        limit,
        offset,
        total,
      },
      summary: {
        totalDepreciation: summaryResult._sum.periodDepreciation || 0,
        totalAccumulatedDepreciation: summaryResult._sum.accumulatedDepreciation || 0,
      },
    });
  } catch (error) {
    console.error('List depreciation history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
