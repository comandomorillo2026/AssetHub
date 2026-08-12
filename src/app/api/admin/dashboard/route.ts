import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/admin/dashboard - Super admin dashboard stats
export async function GET() {
  try {
    const [
      totalTenants,
      activeTenants,
      inactiveTenants,
      subscriptions,
      plans,
      payments,
      overdueInvoices,
      recentTenants,
    ] = await Promise.all([
      db.tenant.count(),
      db.tenant.count({ where: { isActive: true } }),
      db.tenant.count({ where: { isActive: false } }),
      db.subscription.findMany({
        where: { status: 'active' },
        include: { plan: true, tenant: { select: { name: true } } },
      }),
      db.plan.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { subscriptions: true } } } }),
      db.payment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { tenant: { select: { name: true } } },
      }),
      db.invoice.findMany({
        where: { status: { in: ['overdue', 'pending'] } },
        orderBy: { dueAt: 'asc' },
        take: 20,
        include: { tenant: { select: { name: true } } },
      }),
      db.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          isActive: true,
          createdAt: true,
          subscription: {
            select: { plan: { select: { name: true } } },
          },
        },
      }),
    ])

    // Calculate MRR (Monthly Recurring Revenue)
    const mrr = subscriptions.reduce(
      (sum, sub) => sum + (sub.billingCycle === 'yearly' ? sub.plan.priceYearly! / 12 : sub.plan.priceMonthly),
      0
    )

    // Calculate total revenue from completed payments
    const totalRevenue = await db.payment.aggregate({
      where: { status: 'completed' },
      _sum: { amount: true },
    })

    // Plan distribution
    const planDistribution = plans.map(p => ({
      planId: p.id,
      name: p.name,
      priceMonthly: p.priceMonthly,
      subscriberCount: p._count.subscriptions,
    }))

    // Revenue chart data (last 6 months placeholder)
    const now = new Date()
    const revenueChart: { month: string; revenue: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      // Get payments for that month
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1)
      const monthPayments = await db.payment.aggregate({
        where: {
          status: 'completed',
          paidAt: { gte: monthStart, lt: monthEnd },
        },
        _sum: { amount: true },
      })
      revenueChart.push({
        month: monthName,
        revenue: monthPayments._sum.amount || 0,
      })
    }

    return NextResponse.json({
      stats: {
        totalTenants,
        activeTenants,
        inactiveTenants,
        mrr,
        totalRevenue: totalRevenue._sum.amount || 0,
        overdueCount: overdueInvoices.length,
      },
      planDistribution,
      revenueChart,
      recentSignups: recentTenants,
      overduePayments: overdueInvoices,
      recentPayments: payments,
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
