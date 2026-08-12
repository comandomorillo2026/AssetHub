'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Package,
  CheckCircle,
  DollarSign,
  ClipboardCheck,
  FileBarChart,
  Filter,
  RefreshCw,
  AlertTriangle,
  SearchX,
  Activity,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination'

import { reportsApi } from '@/lib/api'

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */

interface DashboardData {
  totalAssets: number
  activeAssets: number
  totalValue: number
  pendingInventories: number
  byStatus: { status: string; count: number }[]
  byCategory: { category: string; count: number; value: number }[]
  byLocation: { location: string; count: number }[]
  recentLogs: {
    id: string
    action: string
    details: string
    createdAt: string
    user?: { name: string }
  }[]
}

interface CategoryRow {
  id: string
  name: string
  code: string
  color: string
  assetCount: number
}

interface LocationRow {
  id: string
  name: string
  code: string
  assetCount: number
}

interface DiscrepancyRow {
  id: string
  qrCode: string | null
  assetId: string | null
  sessionId: string
  discrepancyType: string | null
  discrepancyNote: string | null
  scannedAt: string
  synced: boolean
  sessionName: string
  sessionDate: string
  locationName: string
  asset?: { name: string; tagNumber: string } | null
}

interface AuditLogRow {
  id: string
  action: string
  details: string | null
  ipAddress: string | null
  userAgent: string | null
  assetId: string | null
  userId: string | null
  createdAt: string
  user?: { id: string; name: string; email: string } | null
  asset?: { id: string; name: string; tagNumber: string; qrCode: string } | null
}

/* ──────────────────────────────────────────────
   Constants
   ────────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  active: '#0f766e',
  inactive: '#94a3b8',
  maintenance: '#f59e0b',
  disposed: '#ef4444',
  lost: '#6b7280',
  stolen: '#dc2626',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  maintenance: 'Maintenance',
  disposed: 'Disposed',
  lost: 'Lost',
  stolen: 'Stolen',
}

const DISCREPANCY_VARIANTS: Record<string, 'destructive' | 'default' | 'secondary' | 'outline'> = {
  missing: 'destructive',
  extra: 'default',
  moved: 'secondary',
  damaged: 'outline',
}

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'create_asset', label: 'Create Asset' },
  { value: 'update_asset', label: 'Update Asset' },
  { value: 'delete_asset', label: 'Delete Asset' },
  { value: 'scan', label: 'Scan' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'discrepancy', label: 'Discrepancy' },
  { value: 'status_change', label: 'Status Change' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'export', label: 'Export' },
  { value: 'import', label: 'Import' },
  { value: 'login', label: 'Login' },
  { value: 'maintenance', label: 'Maintenance' },
]

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

function formatCurrency(value: number): string {
  return `TTD $${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  if (weeks < 5) return `${weeks}w ago`
  if (months < 12) return `${months}mo ago`
  return `${years}y ago`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/* ──────────────────────────────────────────────
   Chart Tooltips
   ────────────────────────────────────────────── */

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { fill: string } }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <div className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: d.payload.fill }} />
        <span className="font-medium text-popover-foreground">{d.name}</span>
      </div>
      <p className="text-muted-foreground">{d.value} assets</p>
    </div>
  )
}

function BarTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-popover-foreground">{label}</p>
      <p className="text-muted-foreground">{payload[0].value} assets</p>
    </div>
  )
}

/* ──────────────────────────────────────────────
   Animation variants
   ────────────────────────────────────────────── */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
}

/* ──────────────────────────────────────────────
   Skeleton loaders
   ────────────────────────────────────────────── */

function StatCardSkeleton() {
  return (
    <Card className="gap-4 py-5">
      <CardContent className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-36" />
        </div>
      </CardContent>
    </Card>
  )
}

function ChartSkeleton() {
  return (
    <Card className="gap-0 py-0">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="flex h-[300px] items-center justify-center">
        <Skeleton className="h-full w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/* ──────────────────────────────────────────────
   Empty state
   ────────────────────────────────────────────── */

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────
   Error banner
   ────────────────────────────────────────────── */

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="flex items-center gap-3 p-4">
        <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
        <p className="text-sm text-destructive">{message}</p>
        <Button variant="outline" size="sm" className="ml-auto" onClick={onRetry}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Retry
        </Button>
      </CardContent>
    </Card>
  )
}

/* ──────────────────────────────────────────────
   KPI Card configs for Dashboard Summary
   ────────────────────────────────────────────── */

interface KpiCardConfig {
  title: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  gradientFrom: string
  gradientTo: string
  getValue: (d: DashboardData) => string
  getSub: (d: DashboardData) => string
}

const KPI_CARDS: KpiCardConfig[] = [
  {
    title: 'Total Assets',
    icon: Package,
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-700',
    gradientFrom: 'from-teal-500/10',
    gradientTo: 'to-emerald-500/5',
    getValue: (d) => d.totalAssets.toLocaleString(),
    getSub: () => 'All registered assets',
  },
  {
    title: 'Active Assets',
    icon: CheckCircle,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    gradientFrom: 'from-emerald-500/10',
    gradientTo: 'to-green-500/5',
    getValue: (d) => d.activeAssets.toLocaleString(),
    getSub: (d) => (d.totalAssets > 0 ? `${((d.activeAssets / d.totalAssets) * 100).toFixed(1)}% of total` : '0% of total'),
  },
  {
    title: 'Total Value',
    icon: DollarSign,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    gradientFrom: 'from-amber-500/10',
    gradientTo: 'to-yellow-500/5',
    getValue: (d) => formatCurrency(d.totalValue),
    getSub: () => 'Combined asset value',
  },
  {
    title: 'Pending Inventories',
    icon: ClipboardCheck,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    gradientFrom: 'from-rose-500/10',
    gradientTo: 'to-orange-500/5',
    getValue: (d) => d.pendingInventories.toLocaleString(),
    getSub: () => 'Awaiting completion',
  },
]

/* ═══════════════════════════════════════════════════
   Tab 1: Dashboard Summary
   ═══════════════════════════════════════════════════ */

function DashboardSummaryTab() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await reportsApi.dashboard()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const statusData = (data?.byStatus ?? []).map((s) => ({
    name: STATUS_LABELS[s.status] || s.status,
    value: s.count,
    fill: STATUS_COLORS[s.status] || '#94a3b8',
  }))

  const recentLogs = (data?.recentLogs ?? []).slice(0, 10)

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} onRetry={fetchData} />}

      {/* KPI Cards */}
      <motion.div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : data
            ? KPI_CARDS.map((cfg) => {
                const Icon = cfg.icon
                return (
                  <motion.div key={cfg.title} variants={cardVariants}>
                    <Card className={`group relative overflow-hidden border bg-gradient-to-br ${cfg.gradientFrom} ${cfg.gradientTo} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg`}>
                      <CardContent className="flex items-center gap-4 p-5">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${cfg.iconBg} transition-transform duration-200 group-hover:scale-110`}>
                          <Icon className={`h-6 w-6 ${cfg.iconColor}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-2xl font-bold tracking-tight">{cfg.getValue(data)}</p>
                          <p className="mt-0.5 truncate text-sm text-muted-foreground">{cfg.getSub(data)}</p>
                        </div>
                      </CardContent>
                      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-white/10 to-transparent blur-2xl transition-opacity group-hover:opacity-80" />
                    </Card>
                  </motion.div>
                )
              })
            : null}
      </motion.div>

      {/* Charts + Activity Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Asset Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-6">
            {loading ? (
              <div className="flex h-[300px] items-center justify-center">
                <Skeleton className="h-full w-full rounded-lg" />
              </div>
            ) : statusData.length > 0 ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
                <div className="flex flex-col items-center gap-4 lg:flex-row lg:gap-8">
                  <div className="h-[260px] w-[260px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={2} dataKey="value" stroke="none">
                          {statusData.map((entry, i) => (<Cell key={`cell-${i}`} fill={entry.fill} />))}
                        </Pie>
                        <Tooltip content={<PieTooltip />} cursor={false} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid w-full grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
                    {statusData.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-2 text-sm">
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: entry.fill }} />
                        <span className="truncate text-muted-foreground">{entry.name}</span>
                        <span className="ml-auto font-semibold tabular-nums">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <EmptyState icon={Package} title="No status data" description="Asset status distribution will appear here once assets are registered." />
            )}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Recent Audit Logs</CardTitle>
            <CardDescription>Latest 10 actions recorded in the system</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : recentLogs.length > 0 ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead className="text-right">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="max-w-[160px] truncate font-medium">
                          <Badge variant="secondary" className="font-normal">{log.action}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate text-muted-foreground">{log.details || '\u2014'}</TableCell>
                        <TableCell className="text-muted-foreground">{log.user?.name || 'System'}</TableCell>
                        <TableCell className="text-right text-muted-foreground whitespace-nowrap">{relativeTime(log.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </motion.div>
            ) : (
              <EmptyState icon={Activity} title="No activity yet" description="Audit logs will appear here once actions are performed." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Tab 2: Assets by Category
   ═══════════════════════════════════════════════════ */

function AssetsByCategoryTab() {
  const [data, setData] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await reportsApi.byCategory()
      setData(result.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load category data')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const chartData = data.map((c) => ({ name: c.name, count: c.assetCount }))
  const totalAssets = data.reduce((sum, c) => sum + c.assetCount, 0)

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} onRetry={fetchData} />}

      {loading ? (
        <ChartSkeleton />
      ) : chartData.length > 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Assets by Category</CardTitle>
              <CardDescription>Distribution of {totalAssets} assets across {data.length} categories</CardDescription>
            </CardHeader>
            <CardContent className="px-2 pb-6">
              <ResponsiveContainer width="100%" height={Math.max(300, data.length * 45)}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: 'hsl(var(--accent))' }} />
                  <Bar dataKey="count" fill="#0f766e" radius={[0, 6, 6, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <EmptyState icon={Package} title="No categories found" description="Create categories and assign assets to see distribution data here." />
      )}

      {loading ? null : data.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Color</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Assets</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell><span className="inline-block h-4 w-4 rounded-full border" style={{ backgroundColor: cat.color }} /></TableCell>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{cat.code}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{cat.assetCount.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{totalAssets > 0 ? `${((cat.assetCount / totalAssets) * 100).toFixed(1)}%` : '0%'}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30 font-semibold">
                    <TableCell />
                    <TableCell>Total</TableCell>
                    <TableCell />
                    <TableCell className="text-right tabular-nums">{totalAssets.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Tab 3: Assets by Location
   ═══════════════════════════════════════════════════ */

function AssetsByLocationTab() {
  const [data, setData] = useState<LocationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await reportsApi.byLocation()
      setData(result.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load location data')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const totalAssets = data.reduce((sum, l) => sum + l.assetCount, 0)

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} onRetry={fetchData} />}

      {loading ? (
        <TableSkeleton />
      ) : data.length > 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Assets by Location</CardTitle>
              <CardDescription>Distribution of {totalAssets} assets across {data.length} locations</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Asset Count</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((loc) => (
                    <TableRow key={loc.id}>
                      <TableCell className="font-medium">{loc.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{loc.code}</TableCell>
                      <TableCell className="text-right"><Badge variant="secondary" className="tabular-nums">{loc.assetCount.toLocaleString()}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{totalAssets > 0 ? `${((loc.assetCount / totalAssets) * 100).toFixed(1)}%` : '0%'}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell />
                    <TableCell className="text-right tabular-nums">{totalAssets.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <EmptyState icon={SearchX} title="No locations found" description="Create locations and assign assets to see distribution data here." />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Tab 4: Inventory Discrepancies
   ═══════════════════════════════════════════════════ */

function InventoryDiscrepanciesTab() {
  const [data, setData] = useState<DiscrepancyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await reportsApi.discrepancies()
      setData(result.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load discrepancy data')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const missingCount = data.filter((d) => d.discrepancyType === 'missing').length
  const extraCount = data.filter((d) => d.discrepancyType === 'extra').length

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} onRetry={fetchData} />}

      {!loading && data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/40">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums text-red-700 dark:text-red-400">{missingCount}</p>
                <p className="text-sm text-red-600/80 dark:text-red-500/80">Missing Items</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
                <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-400">{extraCount}</p>
                <p className="text-sm text-blue-600/80 dark:text-blue-500/80">Extra (Unregistered) Items</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                <FileBarChart className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">{data.length}</p>
                <p className="text-sm text-amber-600/80 dark:text-amber-500/80">Total Discrepancies</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={8} />
      ) : data.length > 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Discrepancy Details</CardTitle>
              <CardDescription>Items flagged during completed inventory sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead>QR Code</TableHead>
                    <TableHead>Session</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right">Session Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Badge variant={DISCREPANCY_VARIANTS[item.discrepancyType || ''] || 'outline'}>
                          {item.discrepancyType ? item.discrepancyType.charAt(0).toUpperCase() + item.discrepancyType.slice(1) : 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate font-medium">{item.asset?.name || 'Unregistered'}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{item.qrCode || '\u2014'}</TableCell>
                      <TableCell className="max-w-[160px] truncate">{item.sessionName}</TableCell>
                      <TableCell className="text-muted-foreground">{item.locationName}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">{item.discrepancyNote || '\u2014'}</TableCell>
                      <TableCell className="text-right whitespace-nowrap text-muted-foreground">{item.sessionDate ? formatDate(item.sessionDate) : '\u2014'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <EmptyState icon={CheckCircle} title="No discrepancies found" description="All completed inventory sessions are clean. Discrepancies will appear here when items don't match expected records." />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Tab 5: Audit Trail
   ═══════════════════════════════════════════════════ */

function AuditTrailTab() {
  const [data, setData] = useState<AuditLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [actionFilter, setActionFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params: Record<string, string> = { page: String(page) }
      if (actionFilter) params.action = actionFilter
      if (dateFrom) params.from = dateFrom
      if (dateTo) params.to = dateTo
      const result = await reportsApi.auditTrail(params)
      setData(result.data ?? [])
      setTotalPages(result.pagination?.totalPages ?? 1)
      setTotal(result.pagination?.total ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit trail')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [page, actionFilter, dateFrom, dateTo])

  useEffect(() => { fetchData() }, [fetchData])

  const hasFilters = !!(actionFilter || dateFrom || dateTo)

  const handleActionChange = (value: string) => { setActionFilter(value); setPage(1) }
  const handleDateFromChange = (value: string) => { setDateFrom(value); setPage(1) }
  const handleDateToChange = (value: string) => { setDateTo(value); setPage(1) }
  const handleClearFilters = () => { setActionFilter(''); setDateFrom(''); setDateTo(''); setPage(1) }

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (page > 3) pages.push('ellipsis')
      const start = Math.max(2, page - 1)
      const end = Math.min(totalPages - 1, page + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (page < totalPages - 2) pages.push('ellipsis')
      pages.push(totalPages)
    }
    return pages
  }

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} onRetry={fetchData} />}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Action</label>
              <Select value={actionFilter} onValueChange={handleActionChange}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">From</label>
              <Input type="date" value={dateFrom} onChange={(e) => handleDateFromChange(e.target.value)} className="w-[160px]" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">To</label>
              <Input type="date" value={dateTo} onChange={(e) => handleDateToChange(e.target.value)} className="w-[160px]" />
            </div>
            {hasFilters && (
              <Button variant="ghost" size="default" className="h-9 text-muted-foreground" onClick={handleClearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <TableSkeleton rows={10} />
      ) : data.length > 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Audit Trail</CardTitle>
              <CardDescription>Showing {total} log {total === 1 ? 'entry' : 'entries'}{hasFilters ? ' (filtered)' : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date / Time</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(log.createdAt)}</TableCell>
                      <TableCell><Badge variant="secondary" className="font-normal">{log.action}</Badge></TableCell>
                      <TableCell className="max-w-[240px] truncate text-muted-foreground">{log.details || '\u2014'}</TableCell>
                      <TableCell className="text-muted-foreground">{log.user?.name || '\u2014'}</TableCell>
                      <TableCell className="max-w-[160px] truncate text-muted-foreground">{log.asset?.name || '\u2014'}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{log.ipAddress || '\u2014'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      {getPageNumbers().map((p, idx) =>
                        p === 'ellipsis' ? (
                          <PaginationItem key={`ellipsis-${idx}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={p}>
                            <PaginationLink
                              isActive={p === page}
                              onClick={() => setPage(p)}
                              className="cursor-pointer"
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        ),
                      )}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <EmptyState
          icon={Activity}
          title={hasFilters ? 'No matching logs' : 'No audit logs yet'}
          description={hasFilters ? 'Try adjusting your filters to find what you are looking for.' : 'Audit logs will appear here once actions are performed in the system.'}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Main ReportsView Component
   ═══════════════════════════════════════════════════ */

export default function ReportsView() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:space-y-8 lg:py-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">Detailed analytics, inventory discrepancies, and audit trails for your asset portfolio.</p>
      </motion.div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="flex-wrap">
          <TabsTrigger value="dashboard">Dashboard Summary</TabsTrigger>
          <TabsTrigger value="category">Assets by Category</TabsTrigger>
          <TabsTrigger value="location">Assets by Location</TabsTrigger>
          <TabsTrigger value="discrepancies">Inventory Discrepancies</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <DashboardSummaryTab />
        </TabsContent>
        <TabsContent value="category" className="mt-6">
          <AssetsByCategoryTab />
        </TabsContent>
        <TabsContent value="location" className="mt-6">
          <AssetsByLocationTab />
        </TabsContent>
        <TabsContent value="discrepancies" className="mt-6">
          <InventoryDiscrepanciesTab />
        </TabsContent>
        <TabsContent value="audit" className="mt-6">
          <AuditTrailTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
