import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'

/*
  WiPay Integration for AssetHub
  WiPay is the leading Caribbean payment gateway.
  
  Flow:
  1. Client calls POST /api/payments/initiate with plan + tenant info
  2. Server creates an order record and returns WiPay checkout URL
  3. Client redirects user to WiPay checkout
  4. WiPay sends webhook to POST /api/payments/webhook on completion
  5. Server verifies signature, updates payment/subscription status
*/

// WiPay configuration — set these in .env for production
const WIPAY_MERCHANT_ID = process.env.WIPAY_MERCHANT_ID
const WIPAY_API_KEY = process.env.WIPAY_API_KEY
const WIPAY_BASE_URL = process.env.WIPAY_BASE_URL || 'https://checkout.wipay.tt'

function assertWipayApiKey(): string {
  if (!WIPAY_API_KEY) throw new Error('WIPAY_API_KEY is required')
  return WIPAY_API_KEY
}

interface WiPayOrderRequest {
  total: number        // Amount in TTD (e.g., 499.00)
  name: string         // Customer name
  email: string        // Customer email
  phone?: string       // Customer phone
  order_id: string     // Our internal order reference
  description: string  // Order description
  return_url: string   // URL to redirect after payment
  webhook_url?: string // URL for WiPay to send webhook
}

function generateWipayHash(data: Record<string, string>): string {
  // WiPay uses HMAC-SHA256 for request signing
  const sortedKeys = Object.keys(data).sort()
  const queryString = sortedKeys
    .map((key) => `${key}=${data[key]}`)
    .join('&')
  return crypto
    .createHmac('sha256', assertWipayApiKey())
    .update(queryString)
    .digest('hex')
}

function verifyWipaySignature(payload: string, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', assertWipayApiKey())
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  )
}

// POST /api/payments/initiate — Create a WiPay checkout session
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, ...data } = body

    if (action === 'initiate') {
      return handleInitiate(data)
    }

    if (action === 'verify') {
      return handleVerify(data)
    }

    if (action === 'plans') {
      return handleGetPlans()
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Payment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleGetPlans() {
  const plans = await db.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
  return NextResponse.json({ plans })
}

async function handleInitiate(data: Record<string, unknown>) {
  const { planId, tenantId, tenantName, contactName, contactEmail, contactPhone, billingCycle } = data

  if (!planId || !tenantId) {
    return NextResponse.json({ error: 'planId and tenantId are required' }, { status: 400 })
  }

  // Get the plan
  const plan = await db.plan.findUnique({ where: { id: planId as string } })
  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  // Calculate amount based on billing cycle
  const isYearly = billingCycle === 'yearly'
  const amount = isYearly && plan.priceYearly ? plan.priceYearly : plan.priceMonthly

  // Generate our internal order ID
  const orderId = `AH-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

  // Create a pending payment record
  const payment = await db.payment.create({
    data: {
      subscriptionId: (await db.subscription.findUnique({ where: { tenantId: tenantId as string } }))?.id || '',
      tenantId: tenantId as string,
      amount,
      currency: 'TTD',
      method: 'online',
      status: 'pending',
      reference: orderId,
      notes: `Plan: ${plan.name} | Cycle: ${billingCycle || 'monthly'}`,
    },
  })

  // Build WiPay order request
  const wipayData: Record<string, string> = {
    merchant_id: WIPAY_MERCHANT_ID ?? '',
    total: amount.toFixed(2),
    name: (contactName as string) || (tenantName as string) || 'AssetHub Customer',
    email: (contactEmail as string) || '',
    phone: (contactPhone as string) || '',
    order_id: orderId,
    description: `AssetHub ${plan.name} Plan — ${(billingCycle || 'monthly')}`,
    return_url: `${process.env.NEXT_PUBLIC_BASE_URL || ''}/?payment=complete`,
    webhook_url: `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/payments/webhook`,
  }

  // In development/demo mode, return a simulated checkout
  const isDev = process.env.NODE_ENV !== 'production' || !process.env.WIPAY_MERCHANT_ID

  if (isDev) {
    // Development mode: simulate successful payment directly
    await db.payment.update({
      where: { id: payment.id },
      data: { status: 'completed', paidAt: new Date() },
    })
    const sub = await db.subscription.findUnique({ where: { tenantId: tenantId as string } })
    if (sub) {
      const periodEnd = new Date()
      periodEnd.setMonth(periodEnd.getMonth() + (isYearly ? 12 : 1))
      await db.subscription.update({
        where: { id: sub.id },
        data: { status: 'active', currentPeriodStart: new Date(), currentPeriodEnd: periodEnd, nextBillingDate: new Date(periodEnd) },
      })
    }
    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      orderId,
      amount,
      currency: 'TTD',
      plan: { id: plan.id, name: plan.name },
      isDemo: true,
      demoPaymentCompleted: true,
    })
  }

  // Production: Generate hash and create real WiPay order
  const hash = generateWipayHash(wipayData)
  wipayData.hash = hash

  // Make API call to WiPay to create order
  const wipayResponse = await fetch(`${WIPAY_BASE_URL}/api/v1/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(wipayData),
  })

  const wipayResult = await wipayResponse.json()

  const checkoutUrl = wipayResult.url as string | undefined
  if (!checkoutUrl) {
    return NextResponse.json({ error: 'Failed to create WiPay order' }, { status: 500 })
  }

  // Update payment with WiPay transaction ID
  await db.payment.update({
    where: { id: payment.id },
    data: { reference: wipayResult.transaction_id || orderId },
  })

  return NextResponse.json({
    success: true,
    paymentId: payment.id,
    orderId,
    amount,
    currency: 'TTD',
    plan: { id: plan.id, name: plan.name },
    checkoutUrl,
    isDemo: false,
  })
}

async function handleVerify(data: Record<string, unknown>) {
  const { orderId } = data
  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
  }

  const payment = await db.payment.findFirst({ where: { reference: orderId } })
  if (!payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  return NextResponse.json({
    orderId: payment.reference,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method,
  })
}

// GET /api/payments — Check payment status
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const orderId = url.searchParams.get('order_id')

    if (!orderId) {
      return NextResponse.json({ error: 'order_id is required' }, { status: 400 })
    }

    const payment = await db.payment.findFirst({ where: { reference: orderId } })
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    return NextResponse.json({
      orderId: payment.reference,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      paidAt: payment.paidAt,
    })
  } catch (error) {
    console.error('Payment GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
