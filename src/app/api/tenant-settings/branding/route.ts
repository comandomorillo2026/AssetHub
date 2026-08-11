import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const BRANDING_FIELDS = [
  'primaryColor',
  'secondaryColor',
  'accentColor',
  'fontFamily',
  'logoUrl',
  'faviconUrl',
  'customDomain',
  'loginBackground',
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
        { error: 'Only admins can update branding settings' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Only allow branding fields
    const updateData: Record<string, unknown> = {}
    for (const field of BRANDING_FIELDS) {
      if (field in body) {
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid branding fields provided. Allowed fields: ' + BRANDING_FIELDS.join(', ') },
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

    // Return only branding fields in response
    const branding = BRANDING_FIELDS.reduce(
      (acc, field) => {
        acc[field] = settings[field]
        return acc
      },
      {} as Record<string, unknown>
    )

    return NextResponse.json({ data: branding })
  } catch (error) {
    console.error('Update branding settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
