import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

// GET /api/admin/tenants/[id] - Single tenant with full details
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const tenant = await db.tenant.findUnique({
      where: { id },
      include: {
        subscription: {
          include: {
            plan: true,
            payments: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
            invoices: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: {
          select: {
            users: true,
            assets: true,
            categories: true,
            locations: true,
          },
        },
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Asset stats by status
    const assetStatsByStatus = await db.asset.groupBy({
      by: ['status'],
      where: { tenantId: id },
      _count: { status: true },
    })

    // Asset stats by category
    const assetStatsByCategory = await db.asset.groupBy({
      by: ['categoryId'],
      where: { tenantId: id },
      _count: { categoryId: true },
    })

    const categories = assetStatsByCategory.length > 0
      ? await db.category.findMany({
          where: { id: { in: assetStatsByCategory.map(a => a.categoryId).filter((id): id is string => id !== null) }, tenantId: id },
        })
      : []

    // Recent audit logs
    const recentLogs = await db.auditLog.findMany({
      where: { tenantId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        user: {
          select: { name: true },
        },
        asset: {
          select: { name: true, tagNumber: true },
        },
      },
    })

    return NextResponse.json({
      tenant,
      assetStats: {
        byStatus: assetStatsByStatus.map(s => ({ status: s.status, count: s._count.status })),
        byCategory: assetStatsByCategory.map(s => {
          const cat = categories.find(c => c.id === s.categoryId)
          return { categoryId: s.categoryId, categoryName: cat?.name || 'Unknown', count: s._count.categoryId }
        }),
      },
      recentLogs,
    })
  } catch (error) {
    console.error('Get tenant detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/admin/tenants/[id] - Update tenant
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const tenant = await db.tenant.update({
      where: { id },
      data: {
        name: body.name,
        slug: body.slug,
        type: body.type,
        contactName: body.contactName,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone,
        address: body.address,
        country: body.country,
        currency: body.currency,
        notes: body.notes,
      },
    })

    return NextResponse.json({ tenant })
  } catch (error) {
    console.error('Update tenant error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/tenants/[id] - Toggle active/deactivate
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const tenant = await db.tenant.findUnique({ where: { id } })
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const newActive = body.isActive !== undefined ? body.isActive : !tenant.isActive

    const updated = await db.tenant.update({
      where: { id },
      data: {
        isActive: newActive,
        ...(newActive
          ? { activatedAt: new Date(), deactivatedAt: null, deactivationReason: null }
          : { deactivatedAt: new Date(), deactivationReason: body.reason || 'Deactivated by admin' }),
      },
    })

    return NextResponse.json({ tenant: updated })
  } catch (error) {
    console.error('Toggle tenant error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
