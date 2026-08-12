import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext } from '@/lib/auth-helpers'
import { verifyTwoFactorToken, isValidTwoFactorToken } from '@/lib/two-factor'

/**
 * POST /api/auth/2fa/disable
 * Disables 2FA for the authenticated user.
 * Requires a valid TOTP token for security (prevent unauthorized disabling).
 * Body: { token: "123456" }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContext(request)
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const { token } = body

    if (!token || !isValidTwoFactorToken(token)) {
      return NextResponse.json(
        { error: 'A valid 6-digit token is required to disable 2FA' },
        { status: 400 },
      )
    }

    const user = await db.user.findUnique({
      where: { id: auth.userId },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    })

    if (!user || !user.twoFactorEnabled) {
      return NextResponse.json(
        { error: '2FA is not enabled for this account' },
        { status: 400 },
      )
    }

    if (!user.twoFactorSecret) {
      return NextResponse.json(
        { error: 'No 2FA secret found' },
        { status: 400 },
      )
    }

    const isValid = await verifyTwoFactorToken(user.twoFactorSecret, token)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid token. 2FA remains enabled.' },
        { status: 401 },
      )
    }

    // Disable 2FA and clear the secret
    await db.user.update({
      where: { id: auth.userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    })

    return NextResponse.json({
      enabled: false,
      message: 'Two-factor authentication has been disabled.',
    })
  } catch (error) {
    console.error('2FA disable error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
