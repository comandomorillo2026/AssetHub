import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/admin/tenants/[id]/history - Full tenant history
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const type = url.searchParams.get('type') || 'all'
    const skip = (page - 1) * limit

    const tenant = await db.tenant.findUnique({ where: { id } })
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const [payments, invoices, auditLogs] = await Promise.all([
      type === 'all' || type === 'payments'
        ? db.payment.findMany({
            where: { tenantId: id },
            orderBy: { createdAt: 'desc' },
            skip: type === 'payments' ? skip : 0,
            take: type === 'payments' ? limit : 50,
          })
        : Promise.resolve([]),
      type === 'all' || type === 'invoices'
        ? db.invoice.findMany({
            where: { tenantId: id },
            orderBy: { createdAt: 'desc' },
            skip: type === 'invoices' ? skip : 0,
            take: type === 'invoices' ? limit : 50,
          })
        : Promise.resolve([]),
      type === 'all' || type === 'audit'
        ? db.auditLog.findMany({
            where: { tenantId: id },
            orderBy: { createdAt: 'desc' },
            skip: type === 'audit' ? skip : 0,
            take: type === 'audit' ? limit : 50,
            include: {
              user: { select: { name: true } },
              asset: { select: { name: true, tagNumber: true } },
            },
          })
        : Promise.resolve([]),
    ])

    return NextResponse.json({
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      payments,
      invoices,
      auditLogs,
      pagination: {
        page,
        limit,
        type,
      },
    })
  } catch (error) {
    console.error('Get tenant history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
