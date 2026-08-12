import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requirePermission } from '@/lib/auth-helpers'

const VALID_TYPES = ['assets', 'inventory', 'depreciation', 'audit', 'maintenance', 'work_orders'] as const

type ReportType = (typeof VALID_TYPES)[number]

function formatCurrency(value: number | null | undefined, currency: string): string {
  if (value == null) return '—'
  try {
    return new Intl.NumberFormat('en-TT', {
      style: 'currency',
      currency: currency || 'TTD',
      minimumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${currency || 'TTD'} ${value.toFixed(2)}`
  }
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-TT', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function buildHtmlShell(
  tenantName: string,
  reportTitle: string,
  currency: string,
  generatedBy: string,
  bodyContent: string,
  summaryHtml?: string,
): string {
  const now = new Date()
  const dateGenerated = now.toLocaleDateString('en-TT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(reportTitle)} — ${escapeHtml(tenantName)}</title>
  <style>
    /* ── Reset & Base ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1e293b;
      background: #ffffff;
      padding: 0;
      margin: 0;
    }

    /* ── Page Layout ── */
    .page {
      padding: 48px 56px;
      min-height: 100vh;
      position: relative;
    }

    /* ── Header ── */
    .report-header {
      background: #0c2340;
      color: #ffffff;
      padding: 28px 36px;
      margin: -48px -56px 32px -56px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .report-header .org-name {
      font-size: 18pt;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .report-header .report-type-label {
      font-size: 10pt;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      opacity: 0.8;
      margin-top: 4px;
    }
    .report-header .header-right {
      text-align: right;
      font-size: 9pt;
      opacity: 0.9;
    }
    .report-header .header-right .date-line { margin-bottom: 2px; }

    /* ── Title Bar ── */
    .title-bar {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 2px solid #0c2340;
    }
    .title-bar h1 {
      font-size: 16pt;
      font-weight: 700;
      color: #0c2340;
    }
    .title-bar .generated-by {
      font-size: 9pt;
      color: #64748b;
    }

    /* ── Summary Cards ── */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #0c2340;
      border-radius: 6px;
      padding: 14px 18px;
    }
    .summary-card .card-value {
      font-size: 20pt;
      font-weight: 700;
      color: #0c2340;
    }
    .summary-card .card-label {
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #64748b;
      margin-top: 2px;
    }

    /* ── Table ── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
      margin-bottom: 24px;
    }
    thead th {
      background: #0c2340;
      color: #ffffff;
      font-weight: 600;
      text-align: left;
      padding: 10px 12px;
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: 1px solid #0a1d35;
    }
    tbody td {
      padding: 8px 12px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    tbody tr:hover {
      background: #eef2ff;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-muted { color: #64748b; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 8pt;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-active { background: #dcfce7; color: #166534; }
    .badge-disposed { background: #fef3c7; color: #92400e; }
    .badge-missing { background: #fee2e2; color: #991b1b; }
    .badge-in_repair { background: #dbeafe; color: #1e40af; }
    .badge-retired { background: #f1f5f9; color: #475569; }
    .badge-scheduled { background: #e0e7ff; color: #3730a3; }
    .badge-completed { background: #dcfce7; color: #166534; }
    .badge-in_progress { background: #fef3c7; color: #92400e; }
    .badge-cancelled { background: #f1f5f9; color: #475569; }
    .badge-pending { background: #fef3c7; color: #92400e; }
    .badge-approved { background: #dbeafe; color: #1e40af; }
    .badge-rejected { background: #fee2e2; color: #991b1b; }
    .badge-closed { background: #f1f5f9; color: #475569; }
    .badge-checked_out { background: #fef3c7; color: #92400e; }
    .badge-returned { background: #dcfce7; color: #166534; }
    .badge-overdue { background: #fee2e2; color: #991b1b; }
    .badge-calculated { background: #dbeafe; color: #1e40af; }
    .badge-posted { background: #dcfce7; color: #166534; }
    .badge-reversed { background: #fee2e2; color: #991b1b; }
    .priority-low { color: #16a34a; }
    .priority-medium { color: #d97706; }
    .priority-high { color: #dc2626; }
    .priority-critical { color: #7c3aed; }

    /* ── Page Breaks ── */
    .page-break { page-break-after: always; }
    .no-break { page-break-inside: avoid; }

    /* ── Footer ── */
    .report-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 8px 56px;
      font-size: 8pt;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
    }
    .report-footer::after {
      counter-increment: page;
      content: 'Page ' counter(page) ' of ' counter(pages);
    }

    /* ── Empty State ── */
    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: #94a3b8;
    }
    .empty-state .empty-icon { font-size: 36pt; margin-bottom: 12px; }
    .empty-state p { font-size: 11pt; }

    /* ── Print Rules ── */
    @page {
      size: A4;
      margin: 20mm 16mm;
      @bottom-center {
        content: 'Page ' counter(page) ' of ' counter(pages);
        font-size: 8pt;
        color: #94a3b8;
      }
      @bottom-left {
        content: '${escapeHtml(tenantName)} — ${escapeHtml(reportTitle)}';
        font-size: 8pt;
        color: #94a3b8;
      }
    }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 0; min-height: auto; }
      .report-header { margin: -20mm -16mm 24px -16mm; }
      .report-footer { display: none; }
      .no-print { display: none; }
    }

    @media screen {
      .report-footer { display: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="report-header no-break">
      <div>
        <div class="org-name">${escapeHtml(tenantName)}</div>
        <div class="report-type-label">${escapeHtml(reportTitle)}</div>
      </div>
      <div class="header-right">
        <div class="date-line">${dateGenerated}</div>
        <div>Generated by: ${escapeHtml(generatedBy)}</div>
      </div>
    </div>

    <!-- Title -->
    <div class="title-bar no-break">
      <h1>${escapeHtml(reportTitle)}</h1>
      <span class="generated-by">${dateGenerated}</span>
    </div>

    ${summaryHtml ? `<div class="summary-grid no-break">${summaryHtml}</div>` : ''}

    <!-- Data Table -->
    ${bodyContent}
  </div>

  <!-- Footer (screen only, print uses @page) -->
  <div class="report-footer no-print">
    <span>${escapeHtml(tenantName)} — ${escapeHtml(reportTitle)}</span>
    <span></span>
  </div>
</body>
</html>`
}

function badgeClass(value: string): string {
  return `badge badge-${value}`
}

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContext(request)
    if (auth instanceof NextResponse) return auth

    const permCheck = requirePermission(auth, 'canExport')
    if (permCheck) return permCheck

    const { tenantId, userId } = auth

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as ReportType | null
    const format = searchParams.get('format') || 'html'

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid report type. Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 },
      )
    }

    if (format !== 'html') {
      return NextResponse.json(
        { error: 'Only html format is supported for PDF export' },
        { status: 400 },
      )
    }

    // Fetch tenant info for branding and currency
    const [tenant, user] = await Promise.all([
      db.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, currency: true },
      }),
      userId ? db.user.findUnique({
        where: { id: userId },
        select: { name: true },
      }) : null,
    ])

    const tenantName = tenant?.name || 'AssetHub'
    const currency = tenant?.currency || 'TTD'
    const generatedBy = user?.name || 'System'

    // Date filters
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const dateFilter: Record<string, unknown> = {}
    if (from || to) {
      dateFilter.createdAt = {}
      if (from) (dateFilter.createdAt as Record<string, Date>).gte = new Date(from)
      if (to) (dateFilter.createdAt as Record<string, Date>).lte = new Date(to)
    }

    const reportTitles: Record<ReportType, string> = {
      assets: 'Asset Register Report',
      inventory: 'Inventory Session Report',
      depreciation: 'Depreciation Schedule Report',
      audit: 'Audit Trail Report',
      maintenance: 'Maintenance Records Report',
      work_orders: 'Work Orders Report',
    }

    const reportTitle = reportTitles[type]
    let summaryHtml = ''
    let tableHtml = ''

    switch (type) {
      case 'assets': {
        const assets = await db.asset.findMany({
          where: { tenantId },
          include: {
            category: { select: { name: true } },
            location: { select: { name: true } },
          },
          orderBy: { name: 'asc' },
          take: 10000,
        })

        const totalValue = assets.reduce((sum, a) => sum + (a.currentValue || a.purchasePrice || 0), 0)
        const activeCount = assets.filter(a => a.status === 'active').length

        summaryHtml = `
          <div class="summary-card">
            <div class="card-value">${assets.length.toLocaleString()}</div>
            <div class="card-label">Total Assets</div>
          </div>
          <div class="summary-card">
            <div class="card-value">${activeCount.toLocaleString()}</div>
            <div class="card-label">Active Assets</div>
          </div>
          <div class="summary-card">
            <div class="card-value">${formatCurrency(totalValue, currency)}</div>
            <div class="card-label">Total Current Value</div>
          </div>
        `

        if (assets.length === 0) {
          tableHtml = `<div class="empty-state"><div class="empty-icon">📦</div><p>No assets found for this organization.</p></div>`
        } else {
          const rows = assets.map((a, i) => `
            <tr class="${i > 0 && i % 40 === 0 ? 'page-break' : ''}">
              <td>${escapeHtml(a.tagNumber)}</td>
              <td>${escapeHtml(a.name)}</td>
              <td>${escapeHtml(a.category?.name)}</td>
              <td>${escapeHtml(a.location?.name)}</td>
              <td><span class="${badgeClass(a.status)}">${escapeHtml(a.status)}</span></td>
              <td>${escapeHtml(a.condition)}</td>
              <td class="text-right">${formatCurrency(a.purchasePrice, currency)}</td>
              <td class="text-right">${formatCurrency(a.currentValue, currency)}</td>
              <td>${escapeHtml(a.serialNumber)}</td>
              <td>${escapeHtml(a.assignedTo)}</td>
            </tr>
          `).join('')

          tableHtml = `
            <table>
              <thead>
                <tr>
                  <th>Tag #</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Condition</th>
                  <th class="text-right">Purchase Price</th>
                  <th class="text-right">Current Value</th>
                  <th>Serial #</th>
                  <th>Assigned To</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          `
        }
        break
      }

      case 'inventory': {
        const sessions = await db.inventorySession.findMany({
          where: { tenantId, status: 'completed', ...(Object.keys(dateFilter).length > 0 ? dateFilter : {}) },
          include: {
            location: { select: { name: true } },
            user: { select: { name: true } },
            items: { where: { discrepancyType: { not: null } } },
          },
          orderBy: { completedAt: 'desc' },
          take: 10000,
        })

        const totalScanned = sessions.reduce((s, sess) => s + sess.totalScanned, 0)
        const totalDiscrepancies = sessions.reduce((s, sess) => s + sess.items.length, 0)

        summaryHtml = `
          <div class="summary-card">
            <div class="card-value">${sessions.length.toLocaleString()}</div>
            <div class="card-label">Completed Sessions</div>
          </div>
          <div class="summary-card">
            <div class="card-value">${totalScanned.toLocaleString()}</div>
            <div class="card-label">Total Items Scanned</div>
          </div>
          <div class="summary-card">
            <div class="card-value">${totalDiscrepancies.toLocaleString()}</div>
            <div class="card-label">Discrepancies Found</div>
          </div>
        `

        if (sessions.length === 0) {
          tableHtml = `<div class="empty-state"><div class="empty-icon">📋</div><p>No completed inventory sessions found.</p></div>`
        } else {
          const rows = sessions.map((s, i) => `
            <tr class="${i > 0 && i % 40 === 0 ? 'page-break' : ''}">
              <td>${escapeHtml(s.name)}</td>
              <td>${escapeHtml(s.location?.name || 'All Locations')}</td>
              <td>${escapeHtml(s.user?.name || '—')}</td>
              <td class="text-right">${s.totalScanned}</td>
              <td class="text-right">${s.totalMissing}</td>
              <td class="text-right">${s.totalExtra}</td>
              <td class="text-right"><strong>${s.items.length}</strong></td>
              <td>${formatDate(s.startedAt)}</td>
              <td>${formatDate(s.completedAt)}</td>
            </tr>
          `).join('')

          tableHtml = `
            <table>
              <thead>
                <tr>
                  <th>Session Name</th>
                  <th>Location</th>
                  <th>Performed By</th>
                  <th class="text-right">Scanned</th>
                  <th class="text-right">Missing</th>
                  <th class="text-right">Extra</th>
                  <th class="text-right">Discrepancies</th>
                  <th>Started</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          `
        }
        break
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

        const totalBookValue = depreciations.reduce((s, d) => s + d.bookValue, 0)
        const totalAccDep = depreciations.reduce((s, d) => s + d.accumulatedDepreciation, 0)

        summaryHtml = `
          <div class="summary-card">
            <div class="card-value">FY ${fiscalYear}</div>
            <div class="card-label">Fiscal Year</div>
          </div>
          <div class="summary-card">
            <div class="card-value">${depreciations.length.toLocaleString()}</div>
            <div class="card-label">Depreciation Records</div>
          </div>
          <div class="summary-card">
            <div class="card-value">${formatCurrency(totalBookValue, currency)}</div>
            <div class="card-label">Total Book Value</div>
          </div>
          <div class="summary-card">
            <div class="card-value">${formatCurrency(totalAccDep, currency)}</div>
            <div class="card-label">Total Accumulated Depreciation</div>
          </div>
        `

        if (depreciations.length === 0) {
          tableHtml = `<div class="empty-state"><div class="empty-icon">📉</div><p>No depreciation records found for FY ${fiscalYear}.</p></div>`
        } else {
          const rows = depreciations.map((d, i) => `
            <tr class="${i > 0 && i % 40 === 0 ? 'page-break' : ''}">
              <td>${d.periodNumber}</td>
              <td>${escapeHtml(d.asset.tagNumber)}</td>
              <td>${escapeHtml(d.asset.name)}</td>
              <td>${escapeHtml(d.asset.category?.name)}</td>
              <td>${escapeHtml(d.method.replace('_', ' '))}</td>
              <td class="text-right">${formatCurrency(d.purchasePrice, currency)}</td>
              <td class="text-right">${formatCurrency(d.residualValue, currency)}</td>
              <td class="text-right">${(d.depreciationRate * 100).toFixed(1)}%</td>
              <td class="text-right">${formatCurrency(d.periodDepreciation, currency)}</td>
              <td class="text-right">${formatCurrency(d.accumulatedDepreciation, currency)}</td>
              <td class="text-right"><strong>${formatCurrency(d.bookValue, currency)}</strong></td>
              <td><span class="${badgeClass(d.status)}">${escapeHtml(d.status)}</span></td>
            </tr>
          `).join('')

          tableHtml = `
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Tag #</th>
                  <th>Asset</th>
                  <th>Category</th>
                  <th>Method</th>
                  <th class="text-right">Purchase Price</th>
                  <th class="text-right">Residual</th>
                  <th class="text-right">Rate</th>
                  <th class="text-right">Period Dep.</th>
                  <th class="text-right">Accum. Dep.</th>
                  <th class="text-right">Book Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          `
        }
        break
      }

      case 'audit': {
        const action = searchParams.get('action')
        const where: Record<string, unknown> = { tenantId }
        if (action) where.action = action
        if (Object.keys(dateFilter).length > 0) Object.assign(where, dateFilter)

        const logs = await db.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { name: true, email: true } },
            asset: { select: { name: true, tagNumber: true } },
          },
          take: 10000,
        })

        summaryHtml = `
          <div class="summary-card">
            <div class="card-value">${logs.length.toLocaleString()}</div>
            <div class="card-label">Audit Log Entries</div>
          </div>
        `

        if (logs.length === 0) {
          tableHtml = `<div class="empty-state"><div class="empty-icon">🔍</div><p>No audit log entries found for the given filters.</p></div>`
        } else {
          const rows = logs.map((log, i) => `
            <tr class="${i > 0 && i % 40 === 0 ? 'page-break' : ''}">
              <td>${log.createdAt.toISOString().replace('T', ' ').slice(0, 19)}</td>
              <td>${escapeHtml(log.action)}</td>
              <td>${escapeHtml(log.user?.name || '—')}</td>
              <td>${escapeHtml(log.asset?.name || '—')}</td>
              <td>${escapeHtml(log.asset?.tagNumber || '—')}</td>
              <td>${escapeHtml(log.details || '—')}</td>
              <td class="text-muted text-right" style="font-size:8pt;">${escapeHtml(log.ipAddress || '—')}</td>
            </tr>
          `).join('')

          tableHtml = `
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>User</th>
                  <th>Asset</th>
                  <th>Tag #</th>
                  <th>Details</th>
                  <th class="text-right">IP Address</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          `
        }
        break
      }

      case 'maintenance': {
        const records = await db.maintenance.findMany({
          where: { tenantId },
          include: {
            asset: { select: { name: true, tagNumber: true, serialNumber: true } },
          },
          orderBy: { scheduledDate: 'desc' },
          take: 10000,
        })

        const totalCost = records.reduce((s, r) => s + (r.cost || 0), 0)
        const completedCount = records.filter(r => r.status === 'completed').length

        summaryHtml = `
          <div class="summary-card">
            <div class="card-value">${records.length.toLocaleString()}</div>
            <div class="card-label">Maintenance Records</div>
          </div>
          <div class="summary-card">
            <div class="card-value">${completedCount.toLocaleString()}</div>
            <div class="card-label">Completed</div>
          </div>
          <div class="summary-card">
            <div class="card-value">${formatCurrency(totalCost, currency)}</div>
            <div class="card-label">Total Cost</div>
          </div>
        `

        if (records.length === 0) {
          tableHtml = `<div class="empty-state"><div class="empty-icon">🔧</div><p>No maintenance records found.</p></div>`
        } else {
          const rows = records.map((r, i) => `
            <tr class="${i > 0 && i % 40 === 0 ? 'page-break' : ''}">
              <td>${escapeHtml(r.title)}</td>
              <td>${escapeHtml(r.asset?.tagNumber || '—')}</td>
              <td>${escapeHtml(r.asset?.name || '—')}</td>
              <td><span class="${badgeClass(r.type)}">${escapeHtml(r.type)}</span></td>
              <td><span class="${badgeClass(r.status)}">${escapeHtml(r.status)}</span></td>
              <td>${formatDate(r.scheduledDate)}</td>
              <td>${formatDate(r.completedDate)}</td>
              <td class="text-right">${formatCurrency(r.cost, currency)}</td>
              <td>${escapeHtml(r.vendor || '—')}</td>
              <td>${escapeHtml(r.performedBy || '—')}</td>
            </tr>
          `).join('')

          tableHtml = `
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Tag #</th>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Scheduled</th>
                  <th>Completed</th>
                  <th class="text-right">Cost</th>
                  <th>Vendor</th>
                  <th>Performed By</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          `
        }
        break
      }

      case 'work_orders': {
        const records = await db.workOrder.findMany({
          where: { tenantId },
          include: {
            asset: { select: { name: true, tagNumber: true } },
            location: { select: { name: true } },
            requester: { select: { name: true } },
            assignee: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10000,
        })

        const totalEstCost = records.reduce((s, r) => s + (r.estimatedCost ? parseFloat(r.estimatedCost.toString()) : 0), 0)
        const pendingCount = records.filter(r => r.status === 'pending' || r.status === 'approved').length

        summaryHtml = `
          <div class="summary-card">
            <div class="card-value">${records.length.toLocaleString()}</div>
            <div class="card-label">Total Work Orders</div>
          </div>
          <div class="summary-card">
            <div class="card-value">${pendingCount.toLocaleString()}</div>
            <div class="card-label">Pending / Approved</div>
          </div>
          <div class="summary-card">
            <div class="card-value">${formatCurrency(totalEstCost, currency)}</div>
            <div class="card-label">Total Estimated Cost</div>
          </div>
        `

        if (records.length === 0) {
          tableHtml = `<div class="empty-state"><div class="empty-icon">📋</div><p>No work orders found.</p></div>`
        } else {
          const rows = records.map((r, i) => `
            <tr class="${i > 0 && i % 40 === 0 ? 'page-break' : ''}">
              <td>${escapeHtml(r.title)}</td>
              <td><span class="priority-${r.priority}">${escapeHtml(r.priority)}</span></td>
              <td><span class="${badgeClass(r.status)}">${escapeHtml(r.status.replace('_', ' '))}</span></td>
              <td>${escapeHtml(r.asset?.tagNumber || '—')}</td>
              <td>${escapeHtml(r.asset?.name || '—')}</td>
              <td>${escapeHtml(r.location?.name || '—')}</td>
              <td>${escapeHtml(r.requester?.name || '—')}</td>
              <td>${escapeHtml(r.assignee?.name || '—')}</td>
              <td>${formatDate(r.dueDate)}</td>
              <td class="text-right">${r.estimatedCost ? formatCurrency(parseFloat(r.estimatedCost.toString()), currency) : '—'}</td>
              <td>${formatDate(r.createdAt)}</td>
            </tr>
          `).join('')

          tableHtml = `
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Tag #</th>
                  <th>Asset</th>
                  <th>Location</th>
                  <th>Requested By</th>
                  <th>Assigned To</th>
                  <th>Due Date</th>
                  <th class="text-right">Est. Cost</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          `
        }
        break
      }
    }

    const html = buildHtmlShell(tenantName, reportTitle, currency, generatedBy, tableHtml, summaryHtml)
    const dateStr = new Date().toISOString().split('T')[0]

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="report-${type}-${dateStr}.html"`,
      },
    })
  } catch (error) {
    console.error('PDF export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
