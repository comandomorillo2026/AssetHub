import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 400 });
    }

    const body = await request.json();
    const { sessionId, qrCode } = body;

    if (!sessionId || !qrCode) {
      return NextResponse.json(
        { error: 'sessionId and qrCode are required' },
        { status: 400 }
      );
    }

    const session = await db.inventorySession.findFirst({
      where: { id: sessionId, tenantId },
      include: {
        items: true,
        location: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Inventory session not found' }, { status: 404 });
    }

    if (session.status !== 'in_progress') {
      return NextResponse.json(
        { error: `Cannot scan in a session with status '${session.status}'` },
        { status: 400 }
      );
    }

    // Check if already scanned in this session
    const alreadyScanned = session.items.find((item) => item.qrCode === qrCode);
    if (alreadyScanned) {
      return NextResponse.json(
        { error: 'This QR code has already been scanned in this session', item: alreadyScanned },
        { status: 409 }
      );
    }

    // Find the asset by QR code
    const asset = await db.asset.findFirst({
      where: { qrCode, tenantId },
      include: {
        category: { select: { id: true, name: true, code: true, color: true } },
        location: { select: { id: true, name: true, code: true } },
      },
    });

    let discrepancyType: string | null = null;
    let discrepancyNote: string | null = null;
    let assetId: string | null = null;

    if (!asset) {
      // Extra scan - QR code not found in any asset
      discrepancyType = 'extra';
      discrepancyNote = 'QR code does not match any registered asset';
    } else {
      assetId = asset.id;

      // Check if asset belongs to this tenant
      if (asset.tenantId !== tenantId) {
        discrepancyType = 'extra';
        discrepancyNote = `Asset belongs to a different tenant`;
      }
      // Check wrong location
      else if (session.locationId && asset.locationId && asset.locationId !== session.locationId) {
        discrepancyType = 'wrong_location';
        discrepancyNote = `Asset should be at ${asset.location?.name || 'unknown location'} but was found during scan at session location`;
      }
      // Check status mismatch (e.g., scanning a disposed asset)
      else if (asset.status === 'disposed' || asset.status === 'lost' || asset.status === 'stolen') {
        discrepancyType = 'status_mismatch';
        discrepancyNote = `Asset has status '${asset.status}' but was physically found`;
      }
    }

    // Create the inventory item record
    const inventoryItem = await db.inventoryItem.create({
      data: {
        qrCode,
        assetId,
        sessionId,
        discrepancyType,
        discrepancyNote,
      },
      include: {
        asset: asset
          ? {
              include: {
                category: { select: { id: true, name: true, code: true, color: true } },
                location: { select: { id: true, name: true, code: true } },
              },
            }
          : false,
      },
    });

    // Update session scan counts
    const updateData: Record<string, unknown> = {
      totalScanned: { increment: 1 },
    };
    if (discrepancyType === 'extra') {
      updateData.totalExtra = { increment: 1 };
    }

    await db.inventorySession.update({
      where: { id: sessionId },
      data: updateData,
    });

    return NextResponse.json({
      data: inventoryItem,
      discrepancy: discrepancyType
        ? { type: discrepancyType, note: discrepancyNote }
        : null,
    });
  } catch (error) {
    console.error('Scan QR error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
