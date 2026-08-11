import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const DEFAULT_SETTINGS = {
  // Branding
  primaryColor: '#0f766e',
  secondaryColor: '#14b8a6',
  accentColor: '#f59e0b',
  fontFamily: 'Inter',
  logoUrl: null,
  faviconUrl: null,
  customDomain: null,
  loginBackground: null,

  // WhatsApp
  whatsappEnabled: false,
  whatsappApiUrl: null,
  whatsappApiToken: null,
  whatsappPhoneNumber: null,
  whatsappTemplateLang: 'en',

  // AI
  aiEnabled: false,
  aiProvider: 'openai',
  aiApiKey: null,
  aiModel: 'gpt-4o-mini',
  aiTemperature: 0.7,
  aiSystemPrompt:
    'You are a helpful asset management assistant for {tenantName}. Help users manage their assets, run inventory checks, and generate reports.',

  // Notifications
  emailNotificationsEnabled: true,
  whatsappNotificationsEnabled: false,
  inAppNotificationsEnabled: true,
  lowStockAlertsEnabled: false,
  maintenanceAlertsEnabled: true,
  warrantyAlertsEnabled: true,

  // Inventory
  defaultDepreciationMethod: 'straight_line',
  defaultUsefulLifeYears: 5,
  autoGenerateQRCodes: true,
  requirePhotoOnCreate: false,

  // Security
  sessionTimeoutMinutes: 60,
  requireTwoFactor: false,
  passwordMinLength: 8,
  passwordRequireUpper: true,
  passwordRequireNumber: true,
  passwordRequireSpecial: false,
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id')
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      )
    }

    let settings = await db.tenantSettings.findUnique({
      where: { tenantId },
    })

    if (!settings) {
      // Return defaults if no settings exist
      return NextResponse.json({ data: DEFAULT_SETTINGS })
    }

    // Mask sensitive fields
    const { aiApiKey, whatsappApiToken, ...rest } = settings
    return NextResponse.json({
      data: {
        ...rest,
        aiApiKey: aiApiKey
          ? '****' + aiApiKey.slice(-4)
          : null,
        whatsappApiToken: whatsappApiToken
          ? '****' + whatsappApiToken.slice(-4)
          : null,
      },
    })
  } catch (error) {
    console.error('Get tenant settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id')
    const role = request.headers.get('x-auth-role')
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      )
    }
    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can update tenant settings' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const allowedFields = [
      // Branding
      'primaryColor',
      'secondaryColor',
      'accentColor',
      'fontFamily',
      'logoUrl',
      'faviconUrl',
      'customDomain',
      'loginBackground',
      // WhatsApp
      'whatsappEnabled',
      'whatsappApiUrl',
      'whatsappApiToken',
      'whatsappPhoneNumber',
      'whatsappTemplateLang',
      // AI
      'aiEnabled',
      'aiProvider',
      'aiApiKey',
      'aiModel',
      'aiTemperature',
      'aiSystemPrompt',
      // Notifications
      'emailNotificationsEnabled',
      'whatsappNotificationsEnabled',
      'inAppNotificationsEnabled',
      'lowStockAlertsEnabled',
      'maintenanceAlertsEnabled',
      'warrantyAlertsEnabled',
      // Inventory
      'defaultDepreciationMethod',
      'defaultUsefulLifeYears',
      'autoGenerateQRCodes',
      'requirePhotoOnCreate',
      // Security
      'sessionTimeoutMinutes',
      'requireTwoFactor',
      'passwordMinLength',
      'passwordRequireUpper',
      'passwordRequireNumber',
      'passwordRequireSpecial',
    ] as const

    // Build update data from allowed fields only
    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        ;(updateData as Record<string, unknown>)[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Upsert: create if doesn't exist, update if it does
    const settings = await db.tenantSettings.upsert({
      where: { tenantId },
      update: updateData,
      create: {
        tenantId,
        ...updateData,
      },
    })

    // Mask sensitive fields in response
    const { aiApiKey, whatsappApiToken, ...rest } = settings
    return NextResponse.json({
      data: {
        ...rest,
        aiApiKey: aiApiKey
          ? '****' + aiApiKey.slice(-4)
          : null,
        whatsappApiToken: whatsappApiToken
          ? '****' + whatsappApiToken.slice(-4)
          : null,
      },
    })
  } catch (error) {
    console.error('Update tenant settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
