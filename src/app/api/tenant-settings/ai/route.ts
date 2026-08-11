import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const AI_FIELDS = [
  'aiEnabled',
  'aiProvider',
  'aiApiKey',
  'aiModel',
  'aiTemperature',
  'aiSystemPrompt',
] as const

function maskApiKey(key: string | null): string | null {
  if (!key) return null
  return '****' + key.slice(-4)
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
        { error: 'Only admins can update AI settings' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const updateData: Record<string, unknown> = {}
    for (const field of AI_FIELDS) {
      if (field in body) {
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid AI fields provided. Allowed fields: ' + AI_FIELDS.join(', ') },
        { status: 400 }
      )
    }

    // If apiKey is being updated as a masked value (starts with ****), skip it
    // to avoid overwriting the real key with the masked one
    if (updateData.aiApiKey && typeof updateData.aiApiKey === 'string' && updateData.aiApiKey.startsWith('****')) {
      delete updateData.aiApiKey
    }

    // Re-check after potential deletion
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
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

    // Return AI fields with masked API key
    const aiSettings = {
      aiEnabled: settings.aiEnabled,
      aiProvider: settings.aiProvider,
      aiApiKey: maskApiKey(settings.aiApiKey),
      aiModel: settings.aiModel,
      aiTemperature: settings.aiTemperature,
      aiSystemPrompt: settings.aiSystemPrompt,
    }

    return NextResponse.json({ data: aiSettings })
  } catch (error) {
    console.error('Update AI settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
