import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

const WIPAY_WEBHOOK_SECRET = process.env.WIPAY_WEBHOOK_SECRET;
if (!WIPAY_WEBHOOK_SECRET) {
  console.warn('WIPAY_WEBHOOK_SECRET not set — webhook signature verification is disabled. Set this in production.');
}

/*
  WiPay Webhook Handler
  
  WiPay sends a POST to this endpoint when a payment is completed.
  The payload contains the transaction details and a signature for verification.
  
  In production, verify the signature. In dev/demo mode, auto-complete.
*/
export async function POST(req: NextRequest) {
  try {
    const payload = await req.text()
    const signature = req.headers.get('x-wipay-signature') || ''

    // Parse the body
    let data: Record<string, unknown>
    try {
      data = JSON.parse(payload)
    } catch {
      data = Object.fromEntries(new URLSearchParams(payload))
    }

    const isDev = !process.env.WIPAY_MERCHANT_ID || process.env.NODE_ENV !== 'production'
    
    if (!isDev && WIPAY_WEBHOOK_SECRET) {
      // Verify WiPay signature in production
      const crypto = await import('crypto')
      const expected = crypto
        .createHmac('sha256', WIPAY_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex')
      
      if (signature && signature !== expected) {
        console.error('[WiPay] Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    } else if (!isDev && !WIPAY_WEBHOOK_SECRET) {
      console.error('[WiPay] WIPAY_WEBHOOK_SECRET not set in production — rejecting webhook')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    const orderId = data.order_id as string
    const status = data.status as string
    const transactionId = data.transaction_id as string
    const wipayFee = parseFloat(data.fee as string) || 0

    if (!orderId) {
      return NextResponse.json({ error: 'Missing order_id' }, { status: 400 })
    }

    // Find the payment
    const payment = await db.payment.findFirst({ where: { reference: orderId } })
    if (!payment) {
      console.error(`[WiPay] Payment not found for order: ${orderId}`)
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Map WiPay status to our status
    const isSuccessful = status === 'success' || status === 'completed' || isDev
    const isFailed = status === 'failed' || status === 'cancelled'

    if (isSuccessful) {
      // Update payment to completed
      await db.payment.update({
        where: { id: payment.id },
        data: {
          status: 'completed',
          paidAt: new Date(),
          reference: transactionId || payment.reference,
          notes: `${payment.notes || ''} | WiPay TX: ${transactionId || 'demo'} | Fee: TTD ${wipayFee.toFixed(2)}`,
        },
      })

      // Update subscription
      if (payment.subscriptionId) {
        const subscription = await db.subscription.findUnique({
          where: { id: payment.subscriptionId },
        })
        if (subscription) {
          const nextBilling = new Date()
          if (subscription.billingCycle === 'yearly') {
            nextBilling.setFullYear(nextBilling.getFullYear() + 1)
          } else {
            nextBilling.setMonth(nextBilling.getMonth() + 1)
          }

          await db.subscription.update({
            where: { id: subscription.id },
            data: {
              status: 'active',
              nextBillingDate: nextBilling,
              currentPeriodStart: new Date(),
              currentPeriodEnd: nextBilling,
            },
          })
        }
      }

      // Activate tenant if not active
      const tenant = await db.tenant.findUnique({ where: { id: payment.tenantId } })
      if (tenant && !tenant.isActive) {
        await db.tenant.update({
          where: { id: tenant.id },
          data: { isActive: true, activatedAt: new Date() },
        })
      }

      // Create journal entry for the payment (accounting)
      const jeCount = await db.journalEntry.count()
      const jeNumber = `JE-${new Date().getFullYear()}-${String(jeCount + 1).padStart(4, '0')}`

      // Find or create cash and revenue accounts
      let cashAccount = await db.ledgerAccount.findFirst({ where: { code: '1000' } })
      let revenueAccount = await db.ledgerAccount.findFirst({ where: { code: '4000' } })
      let wipayFeesAccount = await db.ledgerAccount.findFirst({ where: { code: '5200' } })

      if (!cashAccount) {
        cashAccount = await db.ledgerAccount.create({ data: { code: '1000', name: 'Cash at Bank — WiPay', accountType: 'asset' } })
      }
      if (!revenueAccount) {
        revenueAccount = await db.ledgerAccount.create({ data: { code: '4000', name: 'Subscription Revenue', accountType: 'revenue' } })
      }
      if (!wipayFeesAccount) {
        wipayFeesAccount = await db.ledgerAccount.create({ data: { code: '5200', name: 'Bank Charges & Fees', accountType: 'expense' } })
      }

      const netAmount = payment.amount - wipayFee

      await db.journalEntry.create({
        data: {
          number: jeNumber,
          description: `Payment received — ${payment.notes || 'Subscription'} (WiPay TX: ${transactionId || 'demo'})`,
          date: new Date(),
          status: 'posted',
          tenantId: payment.tenantId,
          entries: {
            create: [
              { ledgerAccountId: cashAccount.id, debit: netAmount, credit: 0, description: 'Net amount received via WiPay' },
              ...(wipayFee > 0 ? [{ ledgerAccountId: wipayFeesAccount.id, debit: wipayFee, credit: 0, description: 'WiPay processing fee' }] : []),
              { ledgerAccountId: revenueAccount.id, debit: 0, credit: payment.amount, description: 'Subscription revenue recognized' },
            ],
          },
        },
      })

    } else if (isFailed) {
      await db.payment.update({
        where: { id: payment.id },
        data: { status: 'failed', notes: `${payment.notes || ''} | Failed: ${status}` },
      })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
