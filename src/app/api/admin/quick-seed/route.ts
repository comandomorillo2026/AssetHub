import { NextRequest, NextResponse } from 'next/server'
import { hashPassword } from '@/lib/jwt'

// This route is now protected by middleware (requires super admin JWT via /api/admin/* path)
// No hardcoded token check needed — the middleware handles authentication

export async function POST(req: NextRequest) {
  // Only allow in non-production environments
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Quick-seed is disabled in production' }, { status: 403 })
  }

  const { db } = await import('@/lib/db')
  try {
    const superHash = await hashPassword('SuperAdmin2024!')
    await db.superAdmin.upsert({
      where: { email: 'admin@zeitgeist.co' },
      update: {},
      create: { email: 'admin@zeitgeist.co', passwordHash: superHash, name: 'ZBS Super Admin', isActive: true }
    })
    const planData = [
      { name: 'Starter', slug: 'starter', priceMonthly: 499, maxAssets: 500, maxUsers: 10, maxLocations: 5, features: '[]', sortOrder: 0 },
      { name: 'Professional', slug: 'professional', priceMonthly: 1299, maxAssets: 5000, maxUsers: 25, maxLocations: 20, features: '[]', sortOrder: 1 },
      { name: 'Enterprise', slug: 'enterprise', priceMonthly: 2999, maxAssets: 99999, maxUsers: 999, maxLocations: 999, features: '[]', sortOrder: 2 },
    ]
    for (const p of planData) {
      await db.plan.upsert({ where: { slug: p.slug }, update: {}, create: p })
    }
    const tenant = await db.tenant.upsert({
      where: { slug: 'pos-municipal-corp' },
      update: {},
      create: { name: 'Port of Spain Municipal Corporation', slug: 'pos-municipal-corp', type: 'government', contactName: 'Anisa Mohammed', contactEmail: 'anisa@posmc.gov.tt', contactPhone: '+1-868-627-2246', address: 'City Hall, Knox Street, Port of Spain', country: 'Trinidad and Tobago', currency: 'TTD', isActive: true, activatedAt: new Date() }
    })
    await db.tenantSettings.upsert({
      where: { tenantId: tenant.id },
      update: {},
      create: { tenantId: tenant.id }
    })
    const userHash = await hashPassword('Demo@2024!')
    await db.user.upsert({
      where: { email_tenantId: { email: 'admin@demo.com', tenantId: tenant.id } },
      update: {},
      create: { email: 'admin@demo.com', passwordHash: userHash, name: 'Anisa Mohammed', role: 'admin', tenantId: tenant.id }
    })
    const profPlan = await db.plan.findUnique({ where: { slug: 'professional' } })
    if (profPlan) {
      const periodEnd = new Date(); periodEnd.setMonth(periodEnd.getMonth() + 1)
      await db.subscription.upsert({
        where: { tenantId: tenant.id },
        update: {},
        create: { tenantId: tenant.id, planId: profPlan.id, status: 'active', currentPeriodStart: new Date(), currentPeriodEnd: periodEnd, nextBillingDate: new Date(periodEnd), billingCycle: 'monthly' }
      })
    }
    const cats = ['IT Equipment|ITEQ', 'Furniture|FURN', 'Vehicles|VEH', 'Safety Equipment|SAF', 'Audio/Visual|AV', 'Kitchen Appliances|KITCH', 'Office Supplies|OFFSUP', 'Cleaning Equipment|CLEAN']
    for (const c of cats) {
      const [name, code] = c.split('|')
      await db.category.upsert({ where: { code_tenantId: { code, tenantId: tenant.id } }, update: {}, create: { name, code, color: '#0f766e', tenantId: tenant.id } })
    }
    const locs = ['City Hall|CHQ', 'Public Works Depot|PWD', 'San Juan Office|SJO', 'Laventille Office|LVO', 'St. James Office|SJO2', 'Diego Martin Office|DMO']
    for (const l of locs) {
      const [name, code] = l.split('|')
      await db.location.upsert({ where: { name_tenantId: { name, tenantId: tenant.id } }, update: {}, create: { name, code, tenantId: tenant.id } })
    }
    return NextResponse.json({ success: true, message: 'Demo data seeded', tenantId: tenant.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
