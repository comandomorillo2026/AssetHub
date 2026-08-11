import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyRefreshToken, signAccessToken, signRefreshToken } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json();
    if (!refreshToken) {
      return NextResponse.json({ error: 'Refresh token required' }, { status: 400 });
    }

    // Verify the JWT is valid
    const payload = verifyRefreshToken(refreshToken);

    // Check it exists in DB and not expired
    const stored = await db.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { select: { id: true, email: true, role: true, isActive: true, tenantId: true } } },
    });

    if (!stored || stored.expiresAt < new Date()) {
      // Delete expired/invalid tokens
      if (stored) await db.refreshToken.delete({ where: { id: stored.id } });
      return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
    }

    if (!stored.user.isActive) {
      await db.refreshToken.delete({ where: { id: stored.id } });
      return NextResponse.json({ error: 'User is inactive' }, { status: 403 });
    }

    // Rotate: delete old refresh token, issue new pair
    await db.refreshToken.delete({ where: { id: stored.id } });

    const newRefreshToken = signRefreshToken(stored.userId, stored.tenantId);
    const newRefreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.refreshToken.create({
      data: { token: newRefreshToken, userId: stored.userId, tenantId: stored.tenantId, expiresAt: newRefreshExpiry },
    });

    const newAccessToken = signAccessToken({
      userId: stored.user.id,
      tenantId: stored.tenantId,
      email: stored.user.email,
      role: stored.user.role,
    });

    return NextResponse.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    console.error('Refresh error:', error);
    return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
  }
}
