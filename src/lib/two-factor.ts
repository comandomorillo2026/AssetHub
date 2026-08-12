import { generateSecret, verify } from 'otplib'
import QRCode from 'qrcode'

const APP_NAME = 'AssetHub'

/**
 * Generate a new TOTP secret for a user.
 * Returns the secret (to be stored in DB) and a data URL for the QR code.
 */
export async function generateTwoFactorSecret(userEmail: string): Promise<{
  secret: string
  qrCodeDataUrl: string
}> {
  const secret = generateSecret()
  const encodedEmail = encodeURIComponent(userEmail)
  const encodedIssuer = encodeURIComponent(APP_NAME)
  const otpauth = `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&digits=6&period=30`
  const qrCodeDataUrl = await QRCode.toDataURL(otpauth, {
    width: 280,
    margin: 2,
    color: { dark: '#0f766e', light: '#ffffff' },
  })
  return { secret, qrCodeDataUrl }
}

/**
 * Verify a TOTP token against a secret.
 * otplib v14 returns { valid: boolean }.
 */
export async function verifyTwoFactorToken(secret: string, token: string): Promise<boolean> {
  try {
    const result = await verify({ secret, token })
    return result.valid === true
  } catch {
    return false
  }
}

/**
 * Validate a TOTP token format (6 digits).
 */
export function isValidTwoFactorToken(token: string): boolean {
  return /^\d{6}$/.test(token)
}
