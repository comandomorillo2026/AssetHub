import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext } from '@/lib/auth-helpers'

interface TimelineEntry {
  id: string
  timestamp: Date
  type: 'created' | 'updated' | 'maintenance' | 'inventory' | 'depreciation' | 'document' | 'checkout' | 'checkin' | 'work_order'
  title: string
  description: string
  user?: string
  metadata?: Record<string, unknown>
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = getAuthContext(request)
    if (auth instanceof NextResponse) return auth

    const { tenantId } = auth
    const { id } = await params

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Verify asset exists and belongs to tenant
    const asset = await db.asset.findFirst({
      where: { id, tenantId },
      select: { id: true, name: true, tagNumber: true, createdAt: true },
    })

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Query all related tables in parallel
    const [
      auditLogs,
      maintenanceRecords,
      inventoryItems,
      depreciations,
      documents,
      checkouts,
      workOrders,
    ] = await Promise.all([
      // 1. Audit logs for this asset
      db.auditLog.findMany({
        where: { tenantId, assetId: id },
        include: {
          user: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // 2. Maintenance records
      db.maintenance.findMany({
        where: { tenantId, assetId: id },
        orderBy: { createdAt: 'desc' },
      }),

      // 3. Inventory items (scans involving this asset)
      db.inventoryItem.findMany({
        where: { assetId: id },
        include: {
          session: {
            select: {
              name: true,
              location: { select: { name: true } },
              user: { select: { name: true } },
            },
          },
        },
        orderBy: { scannedAt: 'desc' },
      }),

      // 4. Depreciation records
      db.depreciation.findMany({
        where: { tenantId, assetId: id },
        orderBy: { calculatedAt: 'desc' },
      }),

      // 5. Document uploads
      db.document.findMany({
        where: { tenantId, assetId: id },
        orderBy: { createdAt: 'desc' },
      }),

      // 6. Checkout/checkin records
      db.assetCheckout.findMany({
        where: { tenantId, assetId: id },
        include: {
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // 7. Work orders
      db.workOrder.findMany({
        where: { tenantId, assetId: id },
        include: {
          requester: { select: { name: true } },
          assignee: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const entries: TimelineEntry[] = []

    // --- Asset creation event ---
    entries.push({
      id: `asset-created-${asset.id}`,
      timestamp: asset.createdAt,
      type: 'created',
      title: 'Asset Created',
      description: `Asset "${asset.name}" (${asset.tagNumber}) was added to the register.`,
    })

    // --- Audit log entries ---
    for (const log of auditLogs) {
      // Skip creation audit logs (already covered by the asset creation event)
      if (log.action === 'asset_created') continue

      let entryType: TimelineEntry['type'] = 'updated'
      if (log.action.includes('maintenance')) entryType = 'maintenance'
      else if (log.action.includes('work_order')) entryType = 'work_order'
      else if (log.action.includes('checkout') || log.action.includes('checkin')) {
        entryType = log.action.includes('checkin') || log.action.includes('return') ? 'checkin' : 'checkout'
      }
      else if (log.action.includes('document') || log.action.includes('upload')) entryType = 'document'
      else if (log.action.includes('depreciation')) entryType = 'depreciation'
      else if (log.action.includes('inventory')) entryType = 'inventory'

      const friendlyAction = log.action
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())

      entries.push({
        id: `audit-${log.id}`,
        timestamp: log.createdAt,
        type: entryType,
        title: friendlyAction,
        description: log.details || log.action,
        user: log.user?.name || undefined,
        metadata: {
          action: log.action,
          ipAddress: log.ipAddress || undefined,
        },
      })
    }

    // --- Maintenance records ---
    for (const m of maintenanceRecords) {
      const ts = m.completedDate || m.scheduledDate || m.createdAt
      entries.push({
        id: `maintenance-${m.id}`,
        timestamp: new Date(ts),
        type: 'maintenance',
        title: `${m.type.charAt(0).toUpperCase() + m.type.slice(1)} Maintenance — ${m.status.replace(/_/g, ' ')}`,
        description: m.title + (m.description ? `: ${m.description}` : ''),
        user: m.performedBy || undefined,
        metadata: {
          maintenanceId: m.id,
          type: m.type,
          status: m.status,
          scheduledDate: m.scheduledDate?.toISOString(),
          completedDate: m.completedDate?.toISOString(),
          cost: m.cost ?? undefined,
          vendor: m.vendor || undefined,
        },
      })
    }

    // --- Inventory scans ---
    for (const item of inventoryItems) {
      entries.push({
        id: `inventory-${item.id}`,
        timestamp: item.scannedAt,
        type: 'inventory',
        title: item.discrepancyType
          ? `Inventory Scan — ${item.discrepancyType.replace(/_/g, ' ').toUpperCase()}`
          : 'Inventory Scan — Matched',
        description: item.discrepancyNote
          ? `Session: "${item.session.name}" at ${item.session.location?.name || 'All Locations'}. ${item.discrepancyNote}`
          : `Scanned during session "${item.session.name}" at ${item.session.location?.name || 'All Locations'}.`,
        user: item.session.user?.name || undefined,
        metadata: {
          inventoryItemId: item.id,
          sessionName: item.session.name,
          location: item.session.location?.name || undefined,
          discrepancyType: item.discrepancyType || undefined,
        },
      })
    }

    // --- Depreciation records ---
    for (const d of depreciations) {
      entries.push({
        id: `depreciation-${d.id}`,
        timestamp: d.calculatedAt,
        type: 'depreciation',
        title: `Depreciation — FY${d.fiscalYear} Period ${d.periodNumber}`,
        description: `${d.method.replace(/_/g, ' ')} method. Period depreciation: ${d.periodDepreciation.toFixed(2)}. Book value: ${d.bookValue.toFixed(2)}. Status: ${d.status}.`,
        metadata: {
          depreciationId: d.id,
          fiscalYear: d.fiscalYear,
          periodNumber: d.periodNumber,
          method: d.method,
          purchasePrice: d.purchasePrice,
          residualValue: d.residualValue,
          depreciationRate: d.depreciationRate,
          periodDepreciation: d.periodDepreciation,
          accumulatedDepreciation: d.accumulatedDepreciation,
          bookValue: d.bookValue,
          status: d.status,
        },
      })
    }

    // --- Document uploads ---
    for (const doc of documents) {
      entries.push({
        id: `document-${doc.id}`,
        timestamp: doc.createdAt,
        type: 'document',
        title: `Document Uploaded — ${doc.category.replace(/_/g, ' ')}`,
        description: `"${doc.originalName}" (${(doc.fileSize / 1024).toFixed(1)} KB)${doc.description ? ` — ${doc.description}` : ''}`,
        user: doc.uploadedBy || undefined,
        metadata: {
          documentId: doc.id,
          fileName: doc.originalName,
          fileSize: doc.fileSize,
          mimeType: doc.mimeType,
          category: doc.category,
          version: doc.version,
        },
      })
    }

    // --- Checkout / checkin records ---
    for (const co of checkouts) {
      // Checkout event
      entries.push({
        id: `checkout-${co.id}`,
        timestamp: co.checkedOutAt,
        type: 'checkout',
        title: 'Asset Checked Out',
        description: `Checked out to ${co.user.name}${co.expectedReturnAt ? `. Expected return: ${new Date(co.expectedReturnAt).toLocaleDateString('en-TT')}` : ''}${co.notes ? `. Note: ${co.notes}` : ''}`,
        user: co.user.name,
        metadata: {
          checkoutId: co.id,
          status: co.status,
          expectedReturnAt: co.expectedReturnAt?.toISOString(),
          conditionAtCheckout: co.conditionAtCheckout || undefined,
        },
      })

      // Return event (if returned)
      if (co.returnedAt) {
        entries.push({
          id: `checkin-${co.id}`,
          timestamp: co.returnedAt,
          type: 'checkin',
          title: 'Asset Returned',
          description: `Returned by ${co.user.name}.${co.conditionAtReturn ? ` Condition at return: ${co.conditionAtReturn}` : ''}`,
          user: co.user.name,
          metadata: {
            checkoutId: co.id,
            conditionAtReturn: co.conditionAtReturn || undefined,
          },
        })
      }
    }

    // --- Work orders ---
    for (const wo of workOrders) {
      entries.push({
        id: `workorder-${wo.id}`,
        timestamp: wo.createdAt,
        type: 'work_order',
        title: `Work Order — ${wo.status.replace(/_/g, ' ')}`,
        description: wo.description
          ? `"${wo.title}": ${wo.description}`
          : `"${wo.title}"`
          + (wo.requester?.name ? ` (requested by ${wo.requester.name})` : '')
          + (wo.assignee?.name ? `, assigned to ${wo.assignee.name}` : ''),
        user: wo.requester?.name || undefined,
        metadata: {
          workOrderId: wo.id,
          priority: wo.priority,
          status: wo.status,
          assignee: wo.assignee?.name || undefined,
          dueDate: wo.dueDate?.toISOString(),
          estimatedCost: wo.estimatedCost ? parseFloat(wo.estimatedCost.toString()) : undefined,
          actualCost: wo.actualCost ? parseFloat(wo.actualCost.toString()) : undefined,
          startedAt: wo.startedAt?.toISOString(),
          completedAt: wo.completedAt?.toISOString(),
          closedAt: wo.closedAt?.toISOString(),
        },
      })
    }

    // Sort all entries by timestamp descending (most recent first)
    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    const total = entries.length
    const paginatedEntries = entries.slice(offset, offset + limit)

    return NextResponse.json({
      data: paginatedEntries.map((e) => ({
        ...e,
        timestamp: e.timestamp.toISOString(),
      })),
      pagination: {
        limit,
        offset,
        total,
      },
    })
  } catch (error) {
    console.error('Asset timeline error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
