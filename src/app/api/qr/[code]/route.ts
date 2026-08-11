import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!code) {
      return NextResponse.json({ error: 'QR code is required' }, { status: 400 });
    }

    const asset = await db.asset.findFirst({
      where: { qrCode: code },
      include: {
        category: { select: { id: true, name: true, code: true, color: true } },
        location: { select: { id: true, name: true, code: true, address: true } },
        tenant: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found for this QR code' }, { status: 404 });
    }

    // Return limited info for scanning purposes (no sensitive financial data)
    return NextResponse.json({
      data: {
        id: asset.id,
        qrCode: asset.qrCode,
        tagNumber: asset.tagNumber,
        name: asset.name,
        description: asset.description,
        serialNumber: asset.serialNumber,
        brand: asset.brand,
        model: asset.model,
        status: asset.status,
        condition: asset.condition,
        assignedTo: asset.assignedTo,
        category: asset.category,
        location: asset.location,
        tenant: asset.tenant,
      },
    });
  } catch (error) {
    console.error('QR resolve error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
