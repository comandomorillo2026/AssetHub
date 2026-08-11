import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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
    const format = searchParams.get('format') || 'csv'

    if (format !== 'csv' && format !== 'json') {
      return NextResponse.json(
        { error: 'Invalid format. Use csv or json' },
        { status: 400 }
      )
    }

    // Query all assets with category and location
    const assets = await db.asset.findMany({
      where: { tenantId },
      include: {
        category: { select: { name: true } },
        location: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    })

    // Transform to export rows
    const rows = assets.map((asset) => ({
      'Tag Number': asset.tagNumber,
      Name: asset.name,
      Category: asset.category?.name || '',
      Location: asset.location?.name || '',
      Status: asset.status,
      Condition: asset.condition,
      'Purchase Date': asset.purchaseDate
        ? asset.purchaseDate.toISOString().split('T')[0]
        : '',
      'Purchase Price': asset.purchasePrice ?? '',
      'Current Value': asset.currentValue ?? '',
      'Serial Number': asset.serialNumber || '',
      Brand: asset.brand || '',
      Model: asset.model || '',
      'Assigned To': asset.assignedTo || '',
      'QR Code': asset.qrCode,
    }))

    if (format === 'json') {
      return new NextResponse(JSON.stringify(rows, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="assets-export-${new Date().toISOString().split('T')[0]}.json"`,
        },
      })
    }

    // CSV format
    if (rows.length === 0) {
      const headers = [
        'Tag Number',
        'Name',
        'Category',
        'Location',
        'Status',
        'Condition',
        'Purchase Date',
        'Purchase Price',
        'Current Value',
        'Serial Number',
        'Brand',
        'Model',
        'Assigned To',
        'QR Code',
      ]
      return new NextResponse(headers.join(',') + '\n', {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="assets-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    const headers = Object.keys(rows[0])
    const csvRows = rows.map((row) =>
      headers
        .map((header) => {
          const value = String(row[header as keyof typeof row] ?? '')
          // Escape CSV: wrap in quotes if contains comma, quote, or newline
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return '"' + value.replace(/"/g, '""') + '"'
          }
          return value
        })
        .join(',')
    )

    const csv = [headers.join(','), ...csvRows].join('\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="assets-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error('Export assets error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
