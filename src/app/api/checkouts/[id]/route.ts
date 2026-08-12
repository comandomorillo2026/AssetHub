import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tenantId = request.headers.get('x-auth-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-auth-tenant-id header is required' },
        { status: 400 },
      );
    }

    const checkout = await db.assetCheckout.findFirst({
      where: { id, tenantId },
      include: {
        asset: {
          include: {
            category: {
              select: { id: true, name: true, code: true, color: true, icon: true },
            },
            location: {
              select: { id: true, name: true, code: true, address: true },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            jobTitle: true,
          },
        },
      },
    });

    if (!checkout) {
      return NextResponse.json(
        { error: 'Checkout record not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: checkout });
  } catch (error) {
    console.error('Get checkout record error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tenantId = request.headers.get('x-auth-tenant-id');
    const userId = request.headers.get('x-auth-user-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-auth-tenant-id header is required' },
        { status: 400 },
      );
    }

    const existing = await db.assetCheckout.findFirst({
      where: { id, tenantId },
      include: {
        asset: { select: { id: true, name: true, tagNumber: true } },
        user: { select: { id: true, name: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Checkout record not found' },
        { status: 404 },
      );
    }

    if (existing.status !== 'checked_out') {
      return NextResponse.json(
        {
          error: `Cannot delete checkout record with status "${existing.status}". Only active check-outs can be deleted.`,
        },
        { status: 409 },
      );
    }

    await db.assetCheckout.delete({ where: { id } });

    // Restore asset status
    await db.asset.update({
      where: { id: existing.assetId },
      data: {
        status: 'active',
        assignedTo: null,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        assetId: existing.assetId,
        action: 'checkout_deleted',
        details: `Deleted active checkout of asset "${existing.asset.name}" (${existing.asset.tagNumber}) by "${existing.user.name}"`,
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({ message: 'Checkout record deleted successfully' });
  } catch (error) {
    console.error('Delete checkout record error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
