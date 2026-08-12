import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { signAccessToken, signRefreshToken, type JwtPayload } from '@/lib/jwt'
import { verifyTwoFactorToken, isValidTwoFactorToken } from '@/lib/two-factor'

/**
 * POST /api/auth/2fa/login
 * Second step of login when 2FA is enabled.
 * Body: { userId: string, tenantId: string, token: string }
 * Returns JWT tokens on success.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, tenantId, token } = body

    if (!userId || !tenantId) {
      return NextResponse.json({ error: 'Missing userId or tenantId' }, { status: 400 })
    }

    if (!token || !isValidTwoFactorToken(token)) {
      return NextResponse.json({ error: 'A valid 6-digit token is required' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { id: userId, tenantId },
      include: {
        tenant: {
          select: {
            id: true, name: true, slug: true, type: true, currency: true,
            subscription: { include: { plan: { select: { name: true, maxAssets: true, maxUsers: true } } } },
          },
        },
      },
    })

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 404 })
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json({ error: '2FA is not enabled for this account' }, { status: 400 })
    }

    const isValid = await verifyTwoFactorToken(user.twoFactorSecret, token)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid authentication code' }, { status: 401 })
    }

    // Success — issue tokens
    await db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } })

    const refreshToken = await signRefreshToken(user.id, tenantId)
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await db.refreshToken.create({
      data: { token: refreshToken, userId: user.id, tenantId, expiresAt: refreshExpiry },
    })

    const jwtPayload: JwtPayload = { userId: user.id, tenantId, email: user.email, role: user.role }
    const accessToken = await signAccessToken(jwtPayload)

    const { passwordHash: _, twoFactorSecret: __, ...userWithoutSensitive } = user

    return NextResponse.json({
      user: userWithoutSensitive,
      accessToken,
      refreshToken,
    })
  } catch (error) {
    console.error('2FA login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
