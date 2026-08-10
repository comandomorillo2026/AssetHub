import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

function verifyAdmin(req: NextRequest): boolean {
  return req.headers.get('x-super-admin-token') === 'zeitgeist-super-admin-2024'
}

// GET /api/admin/billing - All subscriptions with tenant info
export async function GET(req: NextRequest) {
  try {
    if (!verifyAdmin(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const status = url.searchParams.get('status') || ''

    const where: Record<string, unknown> = {}
    if (status) {
      where.status = status
    }

    const subscriptions = await db.subscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true, type: true, contactEmail: true },
        },
        plan: true,
        _count: {
          select: { payments: true, invoices: true },
        },
      },
    })

    return NextResponse.json({ subscriptions })
  } catch (error) {
    console.error('List billing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/billing - Record payment or generate invoice
export async function POST(req: NextRequest) {
  try {
    if (!verifyAdmin(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action } = body

    if (action === 'record_payment') {
      const { subscriptionId, tenantId, amount, method, reference, notes } = body

      if (!tenantId || !amount) {
        return NextResponse.json({ error: 'Tenant ID and amount are required' }, { status: 400 })
      }

      let subscription = await db.subscription.findUnique({ where: { tenantId } })
      if (!subscription && subscriptionId) {
        subscription = await db.subscription.findUnique({ where: { id: subscriptionId } })
      }

      const payment = await db.payment.create({
        data: {
          subscriptionId: subscription?.id || subscriptionId,
          tenantId,
          amount,
          method: method || 'manual',
          status: 'completed',
          reference,
          notes,
          paidAt: new Date(),
        },
      })

      return NextResponse.json({ payment }, { status: 201 })
    }

    if (action === 'generate_invoice') {
      const { subscriptionId, tenantId, amount, dueDays } = body

      if (!tenantId || !amount) {
        return NextResponse.json({ error: 'Tenant ID and amount are required' }, { status: 400 })
      }

      let subscription = await db.subscription.findUnique({ where: { tenantId } })
      if (!subscription && subscriptionId) {
        subscription = await db.subscription.findUnique({ where: { id: subscriptionId } })
      }

      // Generate invoice number
      const count = await db.invoice.count()
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`

      const invoice = await db.invoice.create({
        data: {
          invoiceNumber,
          subscriptionId: subscription?.id || subscriptionId,
          tenantId,
          amount,
          status: 'pending',
          issuedAt: new Date(),
          dueAt: new Date(Date.now() + (dueDays || 30) * 24 * 60 * 60 * 1000),
        },
      })

      return NextResponse.json({ invoice }, { status: 201 })
    }

    return NextResponse.json({ error: 'Invalid action. Use "record_payment" or "generate_invoice"' }, { status: 400 })
  } catch (error) {
    console.error('Billing action error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
