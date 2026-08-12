import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/admin/tenants - List all tenants
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const search = url.searchParams.get('search') || ''
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (search) {
      where.name = { contains: search }
    }

    const [tenants, total] = await Promise.all([
      db.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          country: true,
          currency: true,
          contactName: true,
          contactEmail: true,
          contactPhone: true,
          address: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
              assets: true,
              categories: true,
              locations: true,
            },
          },
          subscription: {
            select: {
              status: true,
              billingCycle: true,
              currentPeriodEnd: true,
              nextBillingDate: true,
              plan: {
                select: {
                  name: true,
                  priceMonthly: true,
                },
              },
            },
          },
        },
      }),
      db.tenant.count({ where }),
    ])

    return NextResponse.json({
      tenants,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('List tenants error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/tenants - Create tenant
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, slug, type, planId, contactName, contactEmail, contactPhone, address } = body

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 })
    }

    // Check slug uniqueness
    const existing = await db.tenant.findUnique({ where: { slug } })
    if (existing) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 })
    }

    const tenant = await db.tenant.create({
      data: {
        name,
        slug,
        type: type || 'private',
        contactName,
        contactEmail,
        contactPhone,
        address,
        ...(planId ? {
          subscription: {
            create: {
              planId,
              status: 'active',
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              billingCycle: 'monthly',
              nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          },
        } : {}),
      },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    })

    return NextResponse.json({ tenant }, { status: 201 })
  } catch (error) {
    console.error('Create tenant error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
