import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

type DepreciationMethod = 'straight_line' | 'declining_balance';

interface CalculateBody {
  fiscalYear: number;
  method?: DepreciationMethod;
  assetIds?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id');
    const userId = request.headers.get('x-auth-user-id');
    const role = request.headers.get('x-auth-role');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-auth-tenant-id header is required' },
        { status: 400 },
      );
    }

    // Only admins can trigger depreciation calculations
    if (role !== 'admin' && role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only administrators can calculate depreciation' },
        { status: 403 },
      );
    }

    const body: CalculateBody = await request.json();
    const { fiscalYear, method, assetIds } = body;

    if (!fiscalYear || typeof fiscalYear !== 'number' || fiscalYear < 1900 || fiscalYear > 2200) {
      return NextResponse.json(
        { error: 'A valid fiscalYear (number between 1900 and 2200) is required' },
        { status: 400 },
      );
    }

    if (method && method !== 'straight_line' && method !== 'declining_balance') {
      return NextResponse.json(
        { error: 'method must be "straight_line" or "declining_balance"' },
        { status: 400 },
      );
    }

    // Build query for assets to calculate
    const assetsWhere: Record<string, unknown> = {
      tenantId,
      purchasePrice: { gt: 0 },
    };

    if (assetIds && assetIds.length > 0) {
      assetsWhere.id = { in: assetIds };
    } else {
      // Exclude assets that already have a depreciation record for this fiscalYear
      const existingDepAssetIds = await db.depreciation
        .findMany({
          where: { tenantId, fiscalYear },
          select: { assetId: true },
          distinct: ['assetId'],
        })
        .then((records) => records.map((r) => r.assetId));

      assetsWhere.id = { notIn: existingDepAssetIds };
    }

    const assets = await db.asset.findMany({
      where: assetsWhere,
    });

    if (assets.length === 0) {
      return NextResponse.json({
        calculated: 0,
        errors: [],
        message: 'No eligible assets found for depreciation calculation',
      });
    }

    // Load tenant settings for defaults
    const tenantSettings = await db.tenantSettings.findUnique({
      where: { tenantId },
    });

    const defaultMethod = (method || tenantSettings?.defaultDepreciationMethod || 'straight_line') as DepreciationMethod;
    const defaultUsefulLife = tenantSettings?.defaultUsefulLifeYears || 5;

    let calculated = 0;
    const errors: string[] = [];

    for (const asset of assets) {
      try {
        const usefulLife = asset.usefulLifeYears || defaultUsefulLife;
        const residualValue = asset.residualValue || 0;
        const purchasePrice = asset.purchasePrice!;
        const assetMethod = (asset.depreciationMethod || defaultMethod) as DepreciationMethod;

        if (usefulLife <= 0) {
          errors.push(`Asset "${asset.name}" (${asset.id}): usefulLifeYears must be > 0`);
          continue;
        }

        // Determine starting book value: use currentValue if set, otherwise purchasePrice
        const previousDep = await db.depreciation.findFirst({
          where: {
            assetId: asset.id,
            fiscalYear: { lt: fiscalYear },
          },
          orderBy: { fiscalYear: 'desc' },
        });

        const startingBookValue = previousDep
          ? previousDep.bookValue
          : purchasePrice;

        let periodDepreciation: number;
        let newBookValue: number;
        const depreciationRate = 2 / usefulLife;

        if (assetMethod === 'straight_line') {
          // Straight-line: (purchasePrice - residualValue) / usefulLifeYears
          periodDepreciation = (purchasePrice - residualValue) / usefulLife;
          newBookValue = startingBookValue - periodDepreciation;
        } else {
          // Declining balance: bookValue * (2 / usefulLifeYears), minimum = residualValue
          periodDepreciation = startingBookValue * depreciationRate;
          newBookValue = startingBookValue - periodDepreciation;
          if (newBookValue < residualValue) {
            periodDepreciation = startingBookValue - residualValue;
            newBookValue = residualValue;
          }
        }

        // Prevent negative depreciation or book value below residual
        if (periodDepreciation < 0) {
          periodDepreciation = 0;
          newBookValue = startingBookValue;
        }

        const accumulatedDepreciation = (previousDep?.accumulatedDepreciation || 0) + periodDepreciation;

        await db.depreciation.create({
          data: {
            tenantId,
            assetId: asset.id,
            fiscalYear,
            periodNumber: 1,
            method: assetMethod,
            purchasePrice,
            residualValue,
            usefulLifeYears: usefulLife,
            depreciationRate: assetMethod === 'straight_line' ? 1 / usefulLife : depreciationRate,
            periodDepreciation: Math.round(periodDepreciation * 100) / 100,
            accumulatedDepreciation: Math.round(accumulatedDepreciation * 100) / 100,
            bookValue: Math.round(newBookValue * 100) / 100,
            status: 'calculated',
            calculatedAt: new Date(),
          },
        });

        // Update asset currentValue
        await db.asset.update({
          where: { id: asset.id },
          data: { currentValue: Math.round(newBookValue * 100) / 100 },
        });

        calculated++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Asset "${asset.name}" (${asset.id}): ${msg}`);
      }
    }

    return NextResponse.json({ calculated, errors });
  } catch (error) {
    console.error('Calculate depreciation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
