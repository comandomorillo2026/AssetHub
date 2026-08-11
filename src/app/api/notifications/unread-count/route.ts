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

    const count = await db.notification.count({
      where: {
        tenantId,
        isRead: false,
        OR: [
          { userId: null }, // broadcast
          { userId }, // user-specific
        ],
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Get unread notification count error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
