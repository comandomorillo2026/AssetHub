import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const WHATSAPP_FIELDS = [
  'whatsappEnabled',
  'whatsappApiUrl',
  'whatsappApiToken',
  'whatsappPhoneNumber',
  'whatsappTemplateLang',
] as const

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
        { error: 'Only admins can update WhatsApp settings' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const updateData: Record<string, unknown> = {}
    for (const field of WHATSAPP_FIELDS) {
      if (field in body) {
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid WhatsApp fields provided. Allowed fields: ' + WHATSAPP_FIELDS.join(', ') },
        { status: 400 }
      )
    }

    const settings = await db.tenantSettings.upsert({
      where: { tenantId },
      update: updateData,
      create: {
        tenantId,
        ...updateData,
      },
    })

    // Return only WhatsApp fields, mask the token
    const whatsapp = WHATSAPP_FIELDS.reduce(
      (acc, field) => {
        if (field === 'whatsappApiToken') {
          acc[field] = settings.whatsappApiToken
            ? '****' + settings.whatsappApiToken.slice(-4)
            : null
        } else {
          acc[field] = settings[field]
        }
        return acc
      },
      {} as Record<string, unknown>
    )

    return NextResponse.json({ data: whatsapp })
  } catch (error) {
    console.error('Update WhatsApp settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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
        { error: 'Only admins can send test messages' },
        { status: 403 }
      )
    }

    // Fetch tenant's WhatsApp configuration
    const settings = await db.tenantSettings.findUnique({
      where: { tenantId },
    })

    if (!settings || !settings.whatsappEnabled) {
      return NextResponse.json(
        { error: 'WhatsApp is not enabled for this tenant' },
        { status: 400 }
      )
    }

    if (!settings.whatsappApiUrl || !settings.whatsappApiToken || !settings.whatsappPhoneNumber) {
      return NextResponse.json(
        { error: 'WhatsApp API URL, token, and phone number are required' },
        { status: 400 }
      )
    }

    // Normalize API URL (remove trailing slash)
    const apiUrl = settings.whatsappApiUrl.replace(/\/+$/, '')
    const templateLang = settings.whatsappTemplateLang || 'en'

    // Build WhatsApp Business API request body
    const whatsappPayload = {
      messaging_product: 'whatsapp',
      to: settings.whatsappPhoneNumber,
      type: 'template',
      template: {
        name: 'test_message',
        language: {
          code: templateLang,
        },
      },
    }

    const response = await fetch(`${apiUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.whatsappApiToken}`,
      },
      body: JSON.stringify(whatsappPayload),
    })

    const responseData = await response.json()

    if (!response.ok) {
      console.error('WhatsApp API error:', responseData)
      return NextResponse.json(
        {
          error: 'Failed to send WhatsApp test message',
          details: responseData,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      data: {
        success: true,
        messageId: responseData.messages?.[0]?.id || null,
        details: responseData,
      },
    })
  } catch (error) {
    console.error('Send WhatsApp test error:', error)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Failed to connect to WhatsApp API' },
        { status: 502 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
