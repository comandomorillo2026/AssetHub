import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext } from '@/lib/auth-helpers'
import { verifyTwoFactorToken, isValidTwoFactorToken } from '@/lib/two-factor'

/**
 * POST /api/auth/2fa/verify
 * Verifies a TOTP token. If correct, enables 2FA for the user.
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
        { error: 'A valid 6-digit token is required' },
        { status: 400 },
      )
    }

    // Get user's stored secret
    const user = await db.user.findUnique({
      where: { id: auth.userId },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.twoFactorSecret) {
      return NextResponse.json(
        { error: 'No 2FA secret found. Please set up 2FA first.' },
        { status: 400 },
      )
    }

    const isValid = await verifyTwoFactorToken(user.twoFactorSecret, token)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid token. Please try again.' },
        { status: 401 },
      )
    }

    // Token is valid — enable 2FA
    await db.user.update({
      where: { id: auth.userId },
      data: { twoFactorEnabled: true },
    })

    // Generate backup codes (10 codes)
    const backupCodes = Array.from({ length: 10 }, () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      let code = ''
      for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)]
        if (i === 3) code += '-'
      }
      return code
    })

    return NextResponse.json({
      enabled: true,
      backupCodes,
      message: 'Two-factor authentication is now enabled. Save your backup codes in a secure location.',
    })
  } catch (error) {
    console.error('2FA verify error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
