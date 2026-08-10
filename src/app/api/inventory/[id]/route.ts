import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 400 });
    }

    const session = await db.inventorySession.findFirst({
      where: { id, tenantId },
      include: {
        location: { select: { id: true, name: true, code: true, address: true } },
        user: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            asset: {
              include: {
                category: { select: { id: true, name: true, code: true, color: true } },
                location: { select: { id: true, name: true, code: true } },
              },
            },
          },
          orderBy: { scannedAt: 'desc' },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Inventory session not found' }, { status: 404 });
    }

    return NextResponse.json({ data: session });
  } catch (error) {
    console.error('Get inventory session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 400 });
    }

    const existing = await db.inventorySession.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Inventory session not found' }, { status: 404 });
    }

    if (existing.status !== 'in_progress') {
      return NextResponse.json(
        { error: `Cannot update a session with status '${existing.status}'` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, notes, status } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (notes !== undefined) updateData.notes = notes;
    if (status && ['completed', 'cancelled'].includes(status)) {
      updateData.status = status;
      if (status === 'completed') {
        updateData.completedAt = new Date();
      }
    }

    const session = await db.inventorySession.update({
      where: { id },
      data: updateData,
      include: {
        location: { select: { id: true, name: true, code: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ data: session });
  } catch (error) {
    console.error('Update inventory session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 400 });
    }

    const existing = await db.inventorySession.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Inventory session not found' }, { status: 404 });
    }

    if (existing.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot delete a completed inventory session' },
        { status: 400 }
      );
    }

    await db.inventorySession.delete({ where: { id } });

    return NextResponse.json({ message: 'Inventory session deleted successfully' });
  } catch (error) {
    console.error('Delete inventory session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
