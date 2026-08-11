import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

// GET /api/admin/plans - List plans
export async function GET() {
  try {
    const plans = await db.plan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    })

    return NextResponse.json({ plans })
  } catch (error) {
    console.error('List plans error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/plans - Create plan
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, slug, priceMonthly, priceYearly, maxAssets, maxUsers, maxLocations, features, sortOrder } = body

    if (!name || !slug || priceMonthly === undefined) {
      return NextResponse.json({ error: 'Name, slug, and priceMonthly are required' }, { status: 400 })
    }

    const existing = await db.plan.findUnique({ where: { slug } })
    if (existing) {
      return NextResponse.json({ error: 'Plan slug already exists' }, { status: 409 })
    }

    const plan = await db.plan.create({
      data: {
        name,
        slug,
        priceMonthly,
        priceYearly: priceYearly || null,
        maxAssets: maxUsers || 100,
        maxUsers: maxUsers || 10,
        maxLocations: maxLocations || 5,
        features: JSON.stringify(features || []),
        sortOrder: sortOrder || 0,
      },
    })

    return NextResponse.json({ plan }, { status: 201 })
  } catch (error) {
    console.error('Create plan error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
