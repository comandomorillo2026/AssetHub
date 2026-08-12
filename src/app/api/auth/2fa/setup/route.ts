import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext } from '@/lib/auth-helpers'
import { generateTwoFactorSecret } from '@/lib/two-factor'

/**
 * POST /api/auth/2fa/setup
 * Generates a new TOTP secret and QR code for the authenticated user.
 * Does NOT enable 2FA yet — user must verify a token first via /api/auth/2fa/verify.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContext(request)
    if (auth instanceof NextResponse) return auth

    const tenantId = request.headers.get('x-auth-tenant-id')!

    // Check if tenant requires 2FA
    const tenantSettings = await db.tenantSettings.findUnique({ where: { tenantId } })
    // 2FA is always available, but tenant admin can require it

    // Generate new secret + QR code
    const user = await db.user.findUnique({
      where: { id: auth.userId },
      select: { email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { secret, qrCodeDataUrl } = await generateTwoFactorSecret(user.email)

    // Store the secret temporarily (2FA not enabled until verified)
    await db.user.update({
      where: { id: auth.userId },
      data: { twoFactorSecret: secret },
    })

    return NextResponse.json({
      qrCodeDataUrl,
      message: 'Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then verify a token to enable 2FA.',
    })
  } catch (error) {
    console.error('2FA setup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
