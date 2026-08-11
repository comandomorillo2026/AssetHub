import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

function buildCsvResponse(headers: string[], rows: string[][], filename: string): NextResponse {
  if (rows.length === 0) {
    return new NextResponse(headers.join(',') + '\n', {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }
  const csv = [headers.join(','), ...rows.map((row) => row.map(escapeCsv).join(','))].join('\n')
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id')
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'dashboard'
    const format = searchParams.get('format') || 'csv'

    if (format !== 'csv' && format !== 'json') {
      return NextResponse.json(
        { error: 'Invalid format. Use csv or json' },
        { status: 400 }
      )
    }

    const dateStr = new Date().toISOString().split('T')[0]
    const baseFilename = `report-${type}-${dateStr}`

    switch (type) {
      case 'dashboard': {
        const [totalAssets, assetsByStatus, totalValueResult, categories, locations] =
          await Promise.all([
            db.asset.count({ where: { tenantId } }),
            db.asset.groupBy({
              by: ['status'],
              where: { tenantId },
              _count: { status: true },
            }),
            db.asset.aggregate({
              where: { tenantId, currentValue: { not: null } },
              _sum: { currentValue: true },
            }),
            db.category.findMany({
              where: { tenantId },
              include: { _count: { select: { assets: true } } },
            }),
            db.location.findMany({
              where: { tenantId },
              include: { _count: { select: { assets: true } } },
            }),
          ])

        const data = {
          summary: {
            totalAssets,
            totalValue: totalValueResult._sum.currentValue || 0,
            activeAssets: assetsByStatus.find((s) => s.status === 'active')?._count.status || 0,
            byStatus: assetsByStatus.map((s) => ({
              status: s.status,
              count: s._count.status,
            })),
          },
          byCategory: categories.map((c) => ({
            category: c.name,
            code: c.code,
            assetCount: c._count.assets,
          })),
          byLocation: locations.map((l) => ({
            location: l.name,
            code: l.code,
            assetCount: l._count.assets,
          })),
        }

        if (format === 'json') {
          return new NextResponse(JSON.stringify(data, null, 2), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Content-Disposition': `attachment; filename="${baseFilename}.json"`,
            },
          })
        }

        // CSV: flatten dashboard data into rows
        const headers = ['Metric', 'Value']
        const rows: string[][] = [
          ['Total Assets', String(totalAssets)],
          ['Total Current Value', String(totalValueResult._sum.currentValue || 0)],
          ['', ''],
          ...assetsByStatus.map((s) => [`Assets - ${s.status}`, String(s._count.status)]),
          ['', ''],
          ...categories.map((c) => [`Category - ${c.name}`, String(c._count.assets)]),
          ['', ''],
          ...locations.map((l) => [`Location - ${l.name}`, String(l._count.assets)]),
        ]

        return buildCsvResponse(headers, rows, `${baseFilename}.csv`)
      }

      case 'audit_trail': {
        const from = searchParams.get('from')
        const to = searchParams.get('to')

        const where: Record<string, unknown> = { tenantId }
        const dateFilter: Record<string, unknown> = {}
        if (from || to) {
          dateFilter.createdAt = {}
          if (from) (dateFilter.createdAt as Record<string, Date>).gte = new Date(from)
          if (to) (dateFilter.createdAt as Record<string, Date>).lte = new Date(to)
        }
        if (Object.keys(dateFilter).length > 0) {
          Object.assign(where, dateFilter)
        }

        const logs = await db.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { name: true, email: true } },
            asset: { select: { name: true, tagNumber: true } },
          },
          take: 10000,
        })

        const data = logs.map((log) => ({
          'Timestamp': log.createdAt.toISOString(),
          'Action': log.action,
          'User': log.user?.name || '',
          'User Email': log.user?.email || '',
          'Asset': log.asset?.name || '',
          'Tag Number': log.asset?.tagNumber || '',
          'Details': log.details || '',
          'IP Address': log.ipAddress || '',
        }))

        if (format === 'json') {
          return new NextResponse(JSON.stringify(data, null, 2), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Content-Disposition': `attachment; filename="${baseFilename}.json"`,
            },
          })
        }

        const headers = [
          'Timestamp',
          'Action',
          'User',
          'User Email',
          'Asset',
          'Tag Number',
          'Details',
          'IP Address',
        ]
        const rows = data.map((row) => headers.map((h) => String(row[h as keyof typeof row] ?? '')))

        return buildCsvResponse(headers, rows, `${baseFilename}.csv`)
      }

      case 'depreciation': {
        const fiscalYear = searchParams.get('fiscalYear')
          ? parseInt(searchParams.get('fiscalYear')!, 10)
          : new Date().getFullYear()

        const depreciations = await db.depreciation.findMany({
          where: { tenantId, fiscalYear },
          include: {
            asset: {
              select: {
                name: true,
                tagNumber: true,
                category: { select: { name: true } },
              },
            },
          },
          orderBy: [
            { asset: { name: 'asc' } },
            { periodNumber: 'asc' },
          ],
          take: 10000,
        })

        const data = depreciations.map((d) => ({
          'Fiscal Year': d.fiscalYear,
          'Period': d.periodNumber,
          'Tag Number': d.asset.tagNumber,
          'Asset Name': d.asset.name,
          'Category': d.asset.category?.name || '',
          'Method': d.method,
          'Purchase Price': d.purchasePrice,
          'Residual Value': d.residualValue,
          'Useful Life (Years)': d.usefulLifeYears,
          'Depreciation Rate': d.depreciationRate,
          'Period Depreciation': d.periodDepreciation,
          'Accumulated Depreciation': d.accumulatedDepreciation,
          'Book Value': d.bookValue,
          'Status': d.status,
          'Calculated At': d.calculatedAt.toISOString(),
        }))

        if (format === 'json') {
          return new NextResponse(JSON.stringify(data, null, 2), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Content-Disposition': `attachment; filename="${baseFilename}.json"`,
            },
          })
        }

        const headers = [
          'Fiscal Year',
          'Period',
          'Tag Number',
          'Asset Name',
          'Category',
          'Method',
          'Purchase Price',
          'Residual Value',
          'Useful Life (Years)',
          'Depreciation Rate',
          'Period Depreciation',
          'Accumulated Depreciation',
          'Book Value',
          'Status',
          'Calculated At',
        ]
        const rows = data.map((row) =>
          headers.map((h) => String(row[h as keyof typeof row] ?? ''))
        )

        return buildCsvResponse(headers, rows, `${baseFilename}.csv`)
      }

      default:
        return NextResponse.json(
          {
            error:
              'Unknown report type. Use dashboard, audit_trail, or depreciation',
          },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Export report error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
