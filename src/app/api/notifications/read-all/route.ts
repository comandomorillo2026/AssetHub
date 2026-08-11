import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id');
    const userId = request.headers.get('x-auth-user-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-auth-tenant-id header is required' },
        { status: 400 },
      );
    }

    const result = await db.notification.updateMany({
      where: {
        tenantId,
        isRead: false,
        OR: [
          { userId: null }, // broadcast
          { userId }, // user-specific
        ],
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'All notifications marked as read',
      updatedCount: result.count,
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
