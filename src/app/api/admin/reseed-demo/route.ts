import { NextResponse } from 'next/server'
import { hashPassword } from '@/lib/jwt'

export async function POST() {
  try {
    // Only allow in non-production environments
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Reseed is disabled in production' }, { status: 403 })
    }

    const { db } = await import('@/lib/db')

    // Delete demo data only (scoped by known demo slug)
    const demoTenant = await db.tenant.findUnique({ where: { slug: 'pos-municipal-corp' } })
    if (demoTenant) {
      // Delete in reverse dependency order for this tenant only
      await db.ledgerEntry.deleteMany({ where: { journalEntry: { tenantId: demoTenant.id } } })
      await db.journalEntry.deleteMany({ where: { tenantId: demoTenant.id } })
      await db.ledgerAccount.deleteMany({ where: { tenantId: demoTenant.id } })
      await db.invoice.deleteMany({ where: { tenantId: demoTenant.id } })
      await db.payment.deleteMany({ where: { tenantId: demoTenant.id } })
      await db.subscription.deleteMany({ where: { tenantId: demoTenant.id } })
      await db.inventoryItem.deleteMany({ where: { session: { tenantId: demoTenant.id } } })
      await db.inventorySession.deleteMany({ where: { tenantId: demoTenant.id } })
      await db.syncQueue.deleteMany({ where: { tenantId: demoTenant.id } })
      await db.auditLog.deleteMany({ where: { tenantId: demoTenant.id } })
      await db.asset.deleteMany({ where: { tenantId: demoTenant.id } })
      await db.location.deleteMany({ where: { tenantId: demoTenant.id } })
      await db.category.deleteMany({ where: { tenantId: demoTenant.id } })
      await db.notification.deleteMany({ where: { tenantId: demoTenant.id } })
      await db.document.deleteMany({ where: { asset: { tenantId: demoTenant.id } } })
      await db.maintenance.deleteMany({ where: { asset: { tenantId: demoTenant.id } } })
      await db.depreciation.deleteMany({ where: { asset: { tenantId: demoTenant.id } } })
      await db.user.deleteMany({ where: { tenantId: demoTenant.id } })
      await db.tenantSettings.deleteMany({ where: { tenantId: demoTenant.id } })
      await db.tenant.delete({ where: { id: demoTenant.id } })
    }

    const now = Date.now()
    let assetCounter = 1000
    function makeQR() {
      const random4 = Math.floor(1000 + Math.random() * 9000)
      assetCounter++
      return `AST-${now + assetCounter}-${random4}`
    }

    // 1. Demo Tenant
    const tenant = await db.tenant.create({
      data: {
        name: 'Port of Spain Municipal Corporation',
        slug: 'pos-municipal-corp',
        type: 'government',
        country: 'Trinidad and Tobago',
        currency: 'TTD',
        contactName: 'Anisa Mohammed',
        contactEmail: 'admin@posmunicipal.gov.tt',
        contactPhone: '+1-868-623-5271',
        address: '1 Knox Street, Port of Spain, Trinidad and Tobago',
        isActive: true,
        activatedAt: new Date(),
      },
    })

    await db.tenantSettings.create({ data: { tenantId: tenant.id } })

    // 2. Plans (upsert to avoid duplicate errors if they exist)
    const [starterPlan, proPlan, enterprisePlan] = await Promise.all([
      db.plan.upsert({ where: { slug: 'starter' }, update: {}, create: {
        name: 'Starter', slug: 'starter', priceMonthly: 499, priceYearly: 4990,
        maxAssets: 500, maxUsers: 5, maxLocations: 3,
        features: JSON.stringify(['Basic asset tracking', 'QR code scanning', 'Reports', 'Email support']),
        sortOrder: 0,
      }}),
      db.plan.upsert({ where: { slug: 'professional' }, update: {}, create: {
        name: 'Professional', slug: 'professional', priceMonthly: 1299, priceYearly: 12990,
        maxAssets: 5000, maxUsers: 25, maxLocations: 20,
        features: JSON.stringify(['Everything in Starter', 'Inventory management', 'Audit trails', 'Advanced reports', 'API access', 'Priority support']),
        sortOrder: 1,
      }}),
      db.plan.upsert({ where: { slug: 'enterprise' }, update: {}, create: {
        name: 'Enterprise', slug: 'enterprise', priceMonthly: 2999, priceYearly: 29990,
        maxAssets: 50000, maxUsers: 100, maxLocations: 100,
        features: JSON.stringify(['Everything in Professional', 'Multi-tenant', 'Custom integrations', 'Dedicated support', 'SLA guarantee', 'White-label']),
        sortOrder: 2,
      }}),
    ])

    // 3. Demo Users (using bcrypt via hashPassword)
    const demoPasswordHash = await hashPassword('Demo@2024!')
    const adminUser = await db.user.create({
      data: {
        name: 'Anisa Mohammed', email: 'admin@demo.com',
        passwordHash: demoPasswordHash, role: 'admin', tenantId: tenant.id,
      },
    })
    await db.user.create({
      data: {
        name: 'Rajesh Maharaj', email: 'auditor@demo.com',
        passwordHash: demoPasswordHash, role: 'auditor', tenantId: tenant.id,
      },
    })

    // 4. Subscription
    const subscription = await db.subscription.create({
      data: {
        tenantId: tenant.id, planId: proPlan.id, status: 'active',
        currentPeriodStart: new Date('2024-06-01'), currentPeriodEnd: new Date('2024-08-01'),
        billingCycle: 'monthly', nextBillingDate: new Date('2024-08-01'),
      },
    })

    // 5. Payments
    await Promise.all([
      db.payment.create({ data: { subscriptionId: subscription.id, tenantId: tenant.id, amount: 1299, method: 'bank_transfer', status: 'completed', reference: 'BT-2024-06-001', paidAt: new Date('2024-06-01'), notes: 'June 2024 subscription payment' } }),
      db.payment.create({ data: { subscriptionId: subscription.id, tenantId: tenant.id, amount: 1299, method: 'online', status: 'completed', reference: 'ON-2024-07-001', paidAt: new Date('2024-07-01'), notes: 'July 2024 subscription payment' } }),
      db.payment.create({ data: { subscriptionId: subscription.id, tenantId: tenant.id, amount: 1299, method: 'manual', status: 'pending', reference: 'MN-2024-08-001', notes: 'August 2024 - awaiting payment' } }),
    ])

    // 6. Invoices
    await Promise.all([
      db.invoice.create({ data: { invoiceNumber: 'INV-2024-0001', subscriptionId: subscription.id, tenantId: tenant.id, amount: 1299, status: 'paid', issuedAt: new Date('2024-06-01'), dueAt: new Date('2024-06-30'), paidAt: new Date('2024-06-01') } }),
      db.invoice.create({ data: { invoiceNumber: 'INV-2024-0002', subscriptionId: subscription.id, tenantId: tenant.id, amount: 1299, status: 'pending', issuedAt: new Date('2024-07-01'), dueAt: new Date('2024-07-31') } }),
    ])

    // 7. Chart of Accounts
    const [cashBank, acctRecv, acctPay, ownersEq, subRevenue, bankCharges] = await Promise.all([
      db.ledgerAccount.create({ data: { code: '1000', name: 'Cash at Bank', accountType: 'asset', description: 'Operating bank account', tenantId: tenant.id } }),
      db.ledgerAccount.create({ data: { code: '1200', name: 'Accounts Receivable', accountType: 'asset', description: 'Amounts owed by customers', tenantId: tenant.id } }),
      db.ledgerAccount.create({ data: { code: '2000', name: 'Accounts Payable', accountType: 'liability', description: 'Amounts owed to suppliers', tenantId: tenant.id } }),
      db.ledgerAccount.create({ data: { code: '3000', name: 'Owners Equity', accountType: 'equity', description: 'Owner investment and retained earnings', tenantId: tenant.id } }),
      db.ledgerAccount.create({ data: { code: '4000', name: 'Subscription Revenue', accountType: 'revenue', description: 'SaaS subscription income', tenantId: tenant.id } }),
      db.ledgerAccount.create({ data: { code: '6000', name: 'Bank Charges', accountType: 'expense', description: 'Banking fees and charges', tenantId: tenant.id } }),
    ])

    // 8. Journal Entries
    await Promise.all([
      db.journalEntry.create({ data: { number: 'JE-2024-0001', description: 'June subscription revenue received', date: new Date('2024-06-01'), status: 'posted', tenantId: tenant.id, entries: { create: [
        { ledgerAccountId: cashBank.id, debit: 1299, credit: 0, description: 'Cash received for June subscription' },
        { ledgerAccountId: subRevenue.id, debit: 0, credit: 1299, description: 'June subscription revenue recognized' },
      ]}}}),
      db.journalEntry.create({ data: { number: 'JE-2024-0002', description: 'Bank charges for June 2024', date: new Date('2024-06-30'), status: 'posted', tenantId: tenant.id, entries: { create: [
        { ledgerAccountId: bankCharges.id, debit: 25, credit: 0, description: 'Monthly bank service charges' },
        { ledgerAccountId: cashBank.id, debit: 0, credit: 25, description: 'Bank charges deducted from account' },
      ]}}}),
    ])

    // 9. Categories
    const categories = await Promise.all([
      db.category.create({ data: { name: 'IT Equipment', code: 'ITEQ', color: '#10b981', icon: 'Monitor', tenantId: tenant.id } }),
      db.category.create({ data: { name: 'Furniture', code: 'FURN', color: '#f59e0b', icon: 'Armchair', tenantId: tenant.id } }),
      db.category.create({ data: { name: 'Vehicles', code: 'VEH', color: '#ef4444', icon: 'Car', tenantId: tenant.id } }),
      db.category.create({ data: { name: 'Office Equipment', code: 'OFFEQ', color: '#8b5cf6', icon: 'Printer', tenantId: tenant.id } }),
      db.category.create({ data: { name: 'Maintenance Tools', code: 'MAINT', color: '#06b6d4', icon: 'Wrench', tenantId: tenant.id } }),
      db.category.create({ data: { name: 'Safety Equipment', code: 'SAFE', color: '#ec4899', icon: 'Shield', tenantId: tenant.id } }),
      db.category.create({ data: { name: 'Kitchen Appliances', code: 'KITCH', color: '#84cc16', icon: 'CookingPot', tenantId: tenant.id } }),
      db.category.create({ data: { name: 'Audio/Visual', code: 'AV', color: '#f97316', icon: 'Projector', tenantId: tenant.id } }),
    ])

    // 10. Locations
    const mainOffice = await db.location.create({ data: { name: 'City Hall Main Office', code: 'CHM', address: '1 Knox Street, Port of Spain', tenantId: tenant.id } })
    const itDept = await db.location.create({ data: { name: 'IT Department', code: 'CHM-IT', address: '3rd Floor, City Hall', parentId: mainOffice.id, tenantId: tenant.id } })
    const financeDept = await db.location.create({ data: { name: 'Finance Department', code: 'CHM-FIN', address: '2nd Floor, City Hall', parentId: mainOffice.id, tenantId: tenant.id } })
    const publicWorks = await db.location.create({ data: { name: 'Public Works Depot', code: 'PWD', address: '100 Wrightson Road, Port of Spain', tenantId: tenant.id } })

    // 11. Sample Assets
    await Promise.all([
      db.asset.create({ data: { qrCode: makeQR(), tagNumber: 'IT-2024-001', name: 'Dell OptiPlex 7090 Desktop', description: 'Core i7, 16GB RAM, 512GB SSD', serialNumber: 'DL7090-TT-84721', brand: 'Dell', model: 'OptiPlex 7090', purchaseDate: new Date('2024-01-15'), purchasePrice: 8500, currentValue: 7200, warrantyExpiry: new Date('2027-01-15'), status: 'active', condition: 'good', assignedTo: 'Anisa Mohammed', categoryId: categories[0].id, locationId: itDept.id, tenantId: tenant.id } }),
      db.asset.create({ data: { qrCode: makeQR(), tagNumber: 'IT-2024-002', name: 'HP LaserJet Pro M404dn', description: 'Monochrome laser printer', serialNumber: 'HPM404-TT-33921', brand: 'HP', model: 'LaserJet Pro M404dn', purchaseDate: new Date('2023-06-10'), purchasePrice: 4200, currentValue: 3100, warrantyExpiry: new Date('2026-06-10'), status: 'active', condition: 'good', categoryId: categories[0].id, locationId: financeDept.id, tenantId: tenant.id } }),
      db.asset.create({ data: { qrCode: makeQR(), tagNumber: 'VEH-2021-001', name: 'Toyota Hilux 4x4 Pickup', description: 'Municipal works pickup truck', serialNumber: 'TOY-HILUX-TT-8821MN', brand: 'Toyota', model: 'Hilux 2.8L 4x4', purchaseDate: new Date('2021-11-10'), purchasePrice: 385000, currentValue: 310000, status: 'active', condition: 'fair', assignedTo: 'Public Works Division', categoryId: categories[2].id, locationId: publicWorks.id, tenantId: tenant.id } }),
    ])

    // 12. Audit Logs
    await Promise.all([
      db.auditLog.create({ data: { action: 'system_initialized', details: 'Tenant setup completed via admin reseed', userId: adminUser.id, tenantId: tenant.id } }),
      db.auditLog.create({ data: { action: 'subscription_created', details: 'Professional plan activated', userId: adminUser.id, tenantId: tenant.id } }),
    ])

    return NextResponse.json({
      message: 'Demo data reseeded successfully',
      data: {
        plans: [
          { name: starterPlan.name, price: starterPlan.priceMonthly },
          { name: proPlan.name, price: proPlan.priceMonthly },
          { name: enterprisePlan.name, price: enterprisePlan.priceMonthly },
        ],
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        subscription: { id: subscription.id, status: subscription.status },
        payments: 3, invoices: 2, ledgerAccounts: 6, journalEntries: 2,
        users: 2, categories: 8, locations: 4, assets: 3,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Reseed error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
