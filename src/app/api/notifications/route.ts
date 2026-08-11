import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id');
    const userId = request.headers.get('x-auth-user-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-auth-tenant-id header is required' },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = {
      tenantId,
      OR: [
        { userId: null }, // broadcast to all tenant users
        { userId }, // user-specific
      ],
    };

    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total] = await Promise.all([
      db.notification.findMany({
        where,
        skip: offset,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.notification.count({ where }),
    ]);

    return NextResponse.json({
      data: notifications,
      pagination: {
        limit,
        offset,
        total,
      },
    });
  } catch (error) {
    console.error('List notifications error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-auth-tenant-id header is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { type, title, message, userId, data } = body;

    if (!type || !title || !message) {
      return NextResponse.json(
        { error: 'type, title, and message are required' },
        { status: 400 },
      );
    }

    const validTypes = [
      'asset_expired',
      'maintenance_due',
      'warranty_expiring',
      'inventory_completed',
      'system',
      'custom',
    ];

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        {
          error: `Invalid notification type. Must be one of: ${validTypes.join(', ')}`,
        },
        { status: 400 },
      );
    }

    const notification = await db.notification.create({
      data: {
        tenantId,
        type,
        title,
        message,
        userId: userId || null,
        data: data ? JSON.stringify(data) : null,
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ data: notification }, { status: 201 });
  } catch (error) {
    console.error('Create notification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
