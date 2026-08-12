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

    const url = new URL(request.url);
    const tenantParam = url.searchParams.get('tenant');

    // Build the where clause
    const where: { qrCode: string; tenantId?: string } = { qrCode: code };

    // If tenant param provided, look up tenant by slug or id and filter
    if (tenantParam) {
      const tenant = await db.tenant.findFirst({
        where: {
          OR: [
            { slug: tenantParam },
            { id: tenantParam },
          ],
        },
        select: { id: true },
      });

      if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
      }

      where.tenantId = tenant.id;
    }

    const asset = await db.asset.findFirst({
      where,
      select: {
        id: true,
        name: true,
        tagNumber: true,
        status: true,
        condition: true,
        category: { select: { name: true } },
        location: { select: { name: true } },
      },
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found for this QR code' }, { status: 404 });
    }

    // Return only limited public-safe fields (no financial data, no tenant details)
    return NextResponse.json({
      data: {
        id: asset.id,
        name: asset.name,
        tagNumber: asset.tagNumber,
        status: asset.status,
        condition: asset.condition,
        category: asset.category,
        location: asset.location,
      },
    });
  } catch (error) {
    console.error('QR resolve error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
