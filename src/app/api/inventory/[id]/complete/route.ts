import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = request.headers.get('x-auth-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-auth-tenant-id header is required' }, { status: 400 });
    }

    const session = await db.inventorySession.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          include: {
            asset: true,
          },
        },
        location: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Inventory session not found' }, { status: 404 });
    }

    if (session.status !== 'in_progress') {
      return NextResponse.json(
        { error: `Session is already '${session.status}'` },
        { status: 400 }
      );
    }

    // Determine expected assets based on session location
    const assetWhere: Record<string, unknown> = { tenantId, status: 'active' };
    if (session.locationId) {
      assetWhere.locationId = session.locationId;
    }
    const expectedAssets = await db.asset.findMany({
      where: assetWhere,
      select: { id: true, qrCode: true },
    });

    const scannedQrCodes = new Set(
      session.items.filter((item) => item.qrCode).map((item) => item.qrCode!)
    );

    // Find missing assets (expected but not scanned)
    const missingAssets: { id: string; qrCode: string }[] = [];
    for (const expected of expectedAssets) {
      if (!scannedQrCodes.has(expected.qrCode)) {
        missingAssets.push(expected);

        // Create inventory item for missing asset
        await db.inventoryItem.create({
          data: {
            qrCode: expected.qrCode,
            assetId: expected.id,
            sessionId: session.id,
            discrepancyType: 'missing',
            discrepancyNote: 'Asset was expected but not scanned during inventory',
          },
        });
      }
    }

    // Recount stats
    const updatedItems = await db.inventoryItem.findMany({
      where: { sessionId: session.id },
    });

    const totalScanned = updatedItems.filter(
      (item) => item.discrepancyType !== 'missing'
    ).length;
    const totalMissing = updatedItems.filter(
      (item) => item.discrepancyType === 'missing'
    ).length;
    const totalExtra = updatedItems.filter(
      (item) => item.discrepancyType === 'extra'
    ).length;
    const totalWrongLocation = updatedItems.filter(
      (item) => item.discrepancyType === 'wrong_location'
    ).length;
    const totalStatusMismatch = updatedItems.filter(
      (item) => item.discrepancyType === 'status_mismatch'
    ).length;

    const completedSession = await db.inventorySession.update({
      where: { id: session.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        totalExpected: expectedAssets.length,
        totalScanned,
        totalMissing,
        totalExtra,
      },
      include: {
        location: { select: { id: true, name: true, code: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({
      data: completedSession,
      stats: {
        totalExpected: expectedAssets.length,
        totalScanned,
        totalMissing,
        totalExtra,
        totalWrongLocation,
        totalStatusMismatch,
        matchRate: expectedAssets.length > 0
          ? ((totalScanned / expectedAssets.length) * 100).toFixed(1)
          : '0',
        discrepancyRate: updatedItems.length > 0
          ? (((totalMissing + totalExtra + totalWrongLocation + totalStatusMismatch) / updatedItems.length) * 100).toFixed(1)
          : '0',
      },
    });
  } catch (error) {
    console.error('Complete inventory session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
