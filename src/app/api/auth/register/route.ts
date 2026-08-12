import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, signAccessToken, signRefreshToken, type JwtPayload } from '@/lib/jwt'
import { registerSchema, validateBody } from '@/lib/validations'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const validation = validateBody(registerSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const {
      tenantName, tenantType, contactName, contactEmail,
      contactPhone, country, name, email, password, planSlug,
    } = validation.data

    // Pull extra fields from the raw body that aren't in the schema
    const { tenantSlug, address, planId, billingCycle } = body

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

    const passwordHash = await hashPassword(password)

    // Find or create default plan
    let targetPlanId = planId
    if (!targetPlanId && planSlug) {
      const planBySlug = await db.plan.findFirst({ where: { slug: planSlug } })
      if (planBySlug) targetPlanId = planBySlug.id
    }
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

    // Build tenant data without conditional subscription to preserve Prisma type inference
    const tenantCreateData: Parameters<typeof db.tenant.create>[0]['data'] = {
      name: tenantName,
      slug,
      type: tenantType || 'private',
      contactPhone: contactPhone || undefined,
      address: address || undefined,
      contactName: name,
      contactEmail: email.toLowerCase(),
      country: country || undefined,
      isActive: true,
      activatedAt: new Date(),
      users: {
        create: {
          name,
          email: email.toLowerCase(),
          passwordHash,
          role: 'admin',
        },
      },
      settings: { create: {} },
    }

    // Add subscription only if we have a plan
    if (targetPlanId) {
      (tenantCreateData as Record<string, unknown>).subscription = {
        create: {
          planId: targetPlanId,
          status: 'trial',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          billingCycle: billingCycle || 'monthly',
          nextBillingDate: periodEnd,
        },
      }
    }

    const tenant = await db.tenant.create({
      data: tenantCreateData,
      include: {
        users: true,
        subscription: {
          include: { plan: true },
        },
        settings: true,
      },
    })

    const adminUser = tenant.users[0]
    const { passwordHash: _, ...userWithoutPassword } = adminUser

    // Issue JWT tokens
    const refreshToken = await signRefreshToken(adminUser.id, tenant.id)
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await db.refreshToken.create({
      data: { token: refreshToken, userId: adminUser.id, tenantId: tenant.id, expiresAt: refreshExpiry },
    })

    const jwtPayload: JwtPayload = { userId: adminUser.id, tenantId: tenant.id, email: adminUser.email, role: adminUser.role }
    const accessToken = await signAccessToken(jwtPayload)

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
        accessToken,
        refreshToken,
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
