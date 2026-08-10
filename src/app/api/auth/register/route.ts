import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createHash } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tenantName, tenantSlug, tenantType, name, email, password, contactPhone, address, planId, billingCycle } = body

    if (!tenantName || !name || !email || !password) {
      return NextResponse.json(
        { error: 'tenantName, name, email, and password are required' },
        { status: 400 }
      )
    }

    const slug =
      tenantSlug ||
      tenantName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') +
      '-' +
      Date.now().toString(36)

    const existingTenant = await db.tenant.findUnique({ where: { slug } })
    if (existingTenant) {
      return NextResponse.json({ error: 'Tenant slug already exists' }, { status: 409 })
    }

    const existingEmail = await db.user.findFirst({ where: { email: email.toLowerCase() } })
    if (existingEmail) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const passwordHash = createHash('sha256').update(password + 'zeitgeist-salt-2024').digest('hex')

    // Find or create default plan
    let targetPlanId = planId
    if (!targetPlanId) {
      const defaultPlan = await db.plan.findFirst({ where: { slug: 'professional' } })
      if (defaultPlan) targetPlanId = defaultPlan.id
    }

    // Calculate billing period
    const now = new Date()
    const periodEnd = new Date(now)
    if (billingCycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1)
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1)
    }

    const tenant = await db.tenant.create({
      data: {
        name: tenantName,
        slug,
        type: tenantType || 'private',
        contactPhone: contactPhone || null,
        address: address || null,
        contactName: name,
        contactEmail: email.toLowerCase(),
        isActive: true,
        activatedAt: new Date(),
        subscription: targetPlanId
          ? {
              create: {
                planId: targetPlanId,
                status: 'trial', // Starts as trial until payment
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                billingCycle: billingCycle || 'monthly',
                nextBillingDate: periodEnd,
              },
            }
          : undefined,
        users: {
          create: {
            name,
            email: email.toLowerCase(),
            passwordHash,
            role: 'admin',
          },
        },
      },
      include: {
        users: true,
        subscription: {
          include: { plan: true },
        },
      },
    })

    const adminUser = tenant.users[0]
    const { passwordHash: _, ...userWithoutPassword } = adminUser

    return NextResponse.json(
      {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          type: tenant.type,
          plan: tenant.subscription?.plan?.name || 'Free Trial',
        },
        user: {
          ...userWithoutPassword,
          tenantId: tenant.id,
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            type: tenant.type,
            country: tenant.country,
            currency: tenant.currency,
            plan: tenant.subscription?.plan?.name || 'Free Trial',
          },
        },
        token: adminUser.id,
        subscription: tenant.subscription
          ? {
              id: tenant.subscription.id,
              status: tenant.subscription.status,
              plan: tenant.subscription.plan
                ? { id: tenant.subscription.plan.id, name: tenant.subscription.plan.name, priceMonthly: tenant.subscription.plan.priceMonthly }
                : undefined,
            }
          : undefined,
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error('Registration error:', error)
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Email or slug already registered' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
