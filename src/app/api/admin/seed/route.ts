import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/jwt'

export async function POST() {
  try {
    const results: Record<string, unknown> = {}

    // 1. Seed Super Admin
    const existingAdmin = await db.superAdmin.findUnique({ where: { email: 'admin@zeitgeist.co' } })
    if (!existingAdmin) {
      const admin = await db.superAdmin.create({
        data: {
          email: 'admin@zeitgeist.co',
          passwordHash: await hashPassword('super2024'),
          name: 'Super Administrator',
          isActive: true,
        },
      })
      results.superAdmin = { id: admin.id, email: admin.email }
    } else {
      results.superAdmin = { message: 'Already exists', id: existingAdmin.id }
    }

    // 2. Seed Plans (only if none exist)
    const planCount = await db.plan.count()
    if (planCount === 0) {
      const plans = await Promise.all([
        db.plan.create({
          data: {
            name: 'Starter',
            slug: 'starter',
            priceMonthly: 499,
            priceYearly: 4990,
            maxAssets: 500,
            maxUsers: 5,
            maxLocations: 3,
            features: JSON.stringify(['Basic asset tracking', 'QR code scanning', 'Reports', 'Email support']),
            sortOrder: 0,
          },
        }),
        db.plan.create({
          data: {
            name: 'Professional',
            slug: 'professional',
            priceMonthly: 1299,
            priceYearly: 12990,
            maxAssets: 5000,
            maxUsers: 25,
            maxLocations: 20,
            features: JSON.stringify(['Everything in Starter', 'Inventory management', 'Audit trails', 'Advanced reports', 'API access', 'Priority support']),
            sortOrder: 1,
          },
        }),
        db.plan.create({
          data: {
            name: 'Enterprise',
            slug: 'enterprise',
            priceMonthly: 2999,
            priceYearly: 29990,
            maxAssets: 50000,
            maxUsers: 100,
            maxLocations: 100,
            features: JSON.stringify(['Everything in Professional', 'Multi-tenant', 'Custom integrations', 'Dedicated support', 'SLA guarantee', 'White-label']),
            sortOrder: 2,
          },
        }),
      ])
      results.plans = plans.map(p => ({ id: p.id, name: p.name, priceMonthly: p.priceMonthly }))
    } else {
      results.plans = { message: 'Plans already exist' }
    }

    // 3. Seed T&T Chart of Accounts
    const accountCount = await db.ledgerAccount.count()
    if (accountCount === 0) {
      const accounts = await Promise.all([
        db.ledgerAccount.create({
          data: { code: '1000', name: 'Cash at Bank', accountType: 'asset', description: 'Operating bank account' },
        }),
        db.ledgerAccount.create({
          data: { code: '1200', name: 'Accounts Receivable', accountType: 'asset', description: 'Amounts owed by customers' },
        }),
        db.ledgerAccount.create({
          data: { code: '2000', name: 'Accounts Payable', accountType: 'liability', description: 'Amounts owed to suppliers' },
        }),
        db.ledgerAccount.create({
          data: { code: '3000', name: 'Owners Equity', accountType: 'equity', description: 'Owner investment and retained earnings' },
        }),
        db.ledgerAccount.create({
          data: { code: '4000', name: 'Subscription Revenue', accountType: 'revenue', description: 'SaaS subscription income' },
        }),
        db.ledgerAccount.create({
          data: { code: '4100', name: 'Service Revenue', accountType: 'revenue', description: 'Professional services income' },
        }),
        db.ledgerAccount.create({
          data: { code: '6000', name: 'Bank Charges', accountType: 'expense', description: 'Banking fees and charges' },
        }),
        db.ledgerAccount.create({
          data: { code: '6100', name: 'Software Costs', accountType: 'expense', description: 'Cloud infrastructure and software licenses' },
        }),
      ])
      results.chartOfAccounts = accounts.map(a => ({ id: a.id, code: a.code, name: a.name }))
    } else {
      results.chartOfAccounts = { message: 'Chart of accounts already exists' }
    }

    // 4. Update existing demo tenant with subscription and payment history
    const demoTenant = await db.tenant.findUnique({ where: { slug: 'pos-municipal-corp' } })
    if (demoTenant) {
      // Ensure TenantSettings exists for this tenant
      const existingSettings = await db.tenantSettings.findUnique({ where: { tenantId: demoTenant.id } })
      if (!existingSettings) {
        await db.tenantSettings.create({
          data: {
            tenantId: demoTenant.id,
            primaryColor: '#0f766e',
            secondaryColor: '#14b8a6',
            accentColor: '#f59e0b',
            fontFamily: 'Inter',
            emailNotificationsEnabled: true,
            inAppNotificationsEnabled: true,
            maintenanceAlertsEnabled: true,
            warrantyAlertsEnabled: true,
          },
        })
        results.tenantSettings = { message: 'Created TenantSettings for demo tenant' }
      } else {
        results.tenantSettings = { message: 'Demo tenant already has settings' }
      }

      const existingSub = await db.subscription.findUnique({ where: { tenantId: demoTenant.id } })

      if (!existingSub) {
        const proPlan = await db.plan.findUnique({ where: { slug: 'professional' } })
        if (proPlan) {
          const sub = await db.subscription.create({
            data: {
              tenantId: demoTenant.id,
              planId: proPlan.id,
              status: 'active',
              currentPeriodStart: new Date('2024-06-01'),
              currentPeriodEnd: new Date('2024-07-01'),
              billingCycle: 'monthly',
              nextBillingDate: new Date('2024-07-01'),
            },
          })

          // Create payments
          await Promise.all([
            db.payment.create({
              data: {
                subscriptionId: sub.id,
                tenantId: demoTenant.id,
                amount: 1299,
                method: 'bank_transfer',
                status: 'completed',
                reference: 'BT-2024-06-001',
                paidAt: new Date('2024-06-01'),
                notes: 'June 2024 subscription',
              },
            }),
            db.payment.create({
              data: {
                subscriptionId: sub.id,
                tenantId: demoTenant.id,
                amount: 1299,
                method: 'online',
                status: 'completed',
                reference: 'ON-2024-07-001',
                paidAt: new Date('2024-07-01'),
                notes: 'July 2024 subscription',
              },
            }),
            db.payment.create({
              data: {
                subscriptionId: sub.id,
                tenantId: demoTenant.id,
                amount: 1299,
                method: 'manual',
                status: 'pending',
                reference: 'MN-2024-08-001',
                notes: 'August 2024 subscription - pending',
              },
            }),
          ])

          results.tenantUpdate = {
            message: 'Demo tenant updated with Professional plan subscription',
            subscriptionId: sub.id,
          }
        }
      } else {
        results.tenantUpdate = { message: 'Demo tenant already has a subscription' }
      }
    }

    // 5. Ensure all other tenants have TenantSettings
    const allTenants = await db.tenant.findMany({
      select: { id: true, name: true },
    })
    const settingsCreated: string[] = []
    for (const t of allTenants) {
      const existing = await db.tenantSettings.findUnique({ where: { tenantId: t.id } })
      if (!existing) {
        await db.tenantSettings.create({
          data: { tenantId: t.id },
        })
        settingsCreated.push(t.name)
      }
    }
    if (settingsCreated.length > 0) {
      results.additionalTenantSettings = { created: settingsCreated }
    }

    return NextResponse.json({
      message: 'Admin seed completed successfully',
      ...results,
    })
  } catch (error) {
    console.error('Admin seed error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
