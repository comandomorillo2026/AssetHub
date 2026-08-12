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
  Legend,
} from 'recharts'
import {
  Package,
  CheckCircle,
  DollarSign,
  ClipboardCheck,
  Plus,
  Trash2,
  Edit3,
  ScanLine,
  Move,
  AlertTriangle,
  Download,
  Upload,
  Settings,
  Activity,
  ArrowRightLeft,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'

import { useAppStore, type DashboardStats } from '@/lib/store'
import { reportsApi, settingsApi } from '@/lib/api'

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

const CURRENCY_LOCALE_MAP: Record<string, string> = {
  TTD: 'en-TT',
  USD: 'en-US',
  JMD: 'en-JM',
  BBD: 'en-BB',
  ECS: 'en-EC',
}

function formatCurrency(value: number, currency?: string): string {
  const cur = currency || 'TTD'
  const locale = CURRENCY_LOCALE_MAP[cur] || 'en-TT'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
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
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
  if (weeks < 5) return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`
  return `${years} year${years > 1 ? 's' : ''} ago`
}

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

function getActionIcon(action: string) {
  const a = action.toLowerCase()
  if (a.includes('create') || a.includes('add')) return Plus
  if (a.includes('delete') || a.includes('remove')) return Trash2
  if (a.includes('update') || a.includes('edit')) return Edit3
  if (a.includes('scan')) return ScanLine
  if (a.includes('transfer') || a.includes('move')) return Move
  if (a.includes('discrepancy') || a.includes('missing') || a.includes('alert'))
    return AlertTriangle
  if (a.includes('export') || a.includes('download')) return Download
  if (a.includes('import') || a.includes('upload')) return Upload
  if (a.includes('inventory') || a.includes('audit')) return ClipboardCheck
  if (a.includes('login') || a.includes('logout')) return Settings
  if (a.includes('status')) return ArrowRightLeft
  return Activity
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
   Custom tooltip for charts
   ────────────────────────────────────────────── */

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { fill: string } }>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ backgroundColor: d.payload.fill }}
        />
        <span className="font-medium text-popover-foreground">{d.name}</span>
      </div>
      <p className="text-muted-foreground">{d.value} assets</p>
    </div>
  )
}

function BarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-popover-foreground">{label}</p>
      <p className="text-muted-foreground">{payload[0].value} assets</p>
    </div>
  )
}

/* ──────────────────────────────────────────────
   Stat Card definitions
   ────────────────────────────────────────────── */

interface StatCardConfig {
  title: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  gradientFrom: string
  gradientTo: string
  getValue: (s: DashboardStats, currency?: string) => string
  getSub: (s: DashboardStats) => string
}

const STAT_CARDS: StatCardConfig[] = [
  {
    title: 'Total Assets',
    icon: Package,
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-700',
    gradientFrom: 'from-teal-500/10',
    gradientTo: 'to-emerald-500/5',
    getValue: (s, _c) => s.totalAssets.toLocaleString(),
    getSub: () => 'All registered assets',
  },
  {
    title: 'Active Assets',
    icon: CheckCircle,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    gradientFrom: 'from-emerald-500/10',
    gradientTo: 'to-green-500/5',
    getValue: (s, _c) => s.activeAssets.toLocaleString(),
    getSub: (s) =>
      s.totalAssets > 0
        ? `${((s.activeAssets / s.totalAssets) * 100).toFixed(1)}% of total`
        : '0% of total',
  },
  {
    title: 'Total Value',
    icon: DollarSign,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    gradientFrom: 'from-amber-500/10',
    gradientTo: 'to-yellow-500/5',
    getValue: (s, currency) => formatCurrency(s.totalValue, currency),
    getSub: () => 'Combined asset value',
  },
  {
    title: 'Pending Inventories',
    icon: ClipboardCheck,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    gradientFrom: 'from-rose-500/10',
    gradientTo: 'to-orange-500/5',
    getValue: (s, _c) => s.pendingInventories.toLocaleString(),
    getSub: () => 'Awaiting completion',
  },
]

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

function ListSkeleton() {
  return (
    <Card className="gap-0 py-0">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/* ──────────────────────────────────────────────
   Main component
   ────────────────────────────────────────────── */

export default function DashboardView() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState<string>('TTD')
  const refreshKey = useAppStore((s) => s.refreshKey)
  const userTenantCurrency = useAppStore((s) => s.user?.tenant?.currency)

  useEffect(() => {
    if (userTenantCurrency) {
      setCurrency(userTenantCurrency)
      return
    }
    settingsApi.get()
      .then((res: any) => {
        if (res?.data?.currency) setCurrency(res.data.currency)
      })
      .catch(() => {})
  }, [userTenantCurrency])

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      const data = await reportsApi.dashboard()
      setStats(data)
      if ((data as any)?.currency) {
        setCurrency((data as any).currency)
      }
    } catch {
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard, refreshKey])

  // Prepare chart data
  const statusData = (stats?.byStatus ?? []).map((s) => ({
    name: STATUS_LABELS[s.status] || s.status,
    value: s.count,
    fill: STATUS_COLORS[s.status] || '#94a3b8',
  }))

  const categoryData = (stats?.byCategory ?? []).map((c) => ({
    name: c.category,
    count: c.count,
  }))

  const locationData = stats?.byLocation ?? []
  const maxLocationCount = Math.max(...locationData.map((l) => l.count), 1)

  const recentLogs = (stats?.recentLogs ?? []).slice(0, 8)

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:space-y-8 lg:py-8">
      {/* ─── Page heading ─── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of your asset portfolio and recent activity.
        </p>
      </motion.div>

      {/* ─── Stats Row ─── */}
      <motion.div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : stats &&
            STAT_CARDS.map((cfg) => {
              const Icon = cfg.icon
              return (
                <motion.div key={cfg.title} variants={cardVariants}>
                  <Card
                    className={`group relative overflow-hidden border bg-gradient-to-br ${cfg.gradientFrom} ${cfg.gradientTo} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg`}
                  >
                    <CardContent className="flex items-center gap-4 p-5">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${cfg.iconBg} transition-transform duration-200 group-hover:scale-110`}
                      >
                        <Icon className={`h-6 w-6 ${cfg.iconColor}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-2xl font-bold tracking-tight">
                          {cfg.getValue(stats, currency)}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {cfg.getSub(stats)}
                        </p>
                      </div>
                    </CardContent>
                    {/* Decorative corner glow */}
                    <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-white/10 to-transparent blur-2xl transition-opacity group-hover:opacity-80" />
                  </Card>
                </motion.div>
              )
            })}
      </motion.div>

      {/* ─── Charts Row ─── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {/* Asset Status Distribution */}
        {loading ? (
          <ChartSkeleton />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Asset Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-6">
                {statusData.length > 0 ? (
                  <div className="flex flex-col items-center gap-4 lg:flex-row lg:gap-8">
                    <div className="h-[260px] w-[260px] shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={110}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                          >
                            {statusData.map((entry, i) => (
                              <Cell key={`cell-${i}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={<PieTooltip />}
                            cursor={false}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid w-full grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
                      {statusData.map((entry) => (
                        <div
                          key={entry.name}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: entry.fill }}
                          />
                          <span className="truncate text-muted-foreground">
                            {entry.name}
                          </span>
                          <span className="ml-auto font-semibold tabular-nums">
                            {entry.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-[260px] items-center justify-center text-muted-foreground">
                    No status data available
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Assets by Category */}
        {loading ? (
          <ChartSkeleton />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Assets by Category
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-6">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={categoryData}
                      layout="vertical"
                      margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<BarTooltip />} cursor={{ fill: 'hsl(var(--accent))' }} />
                      <Bar
                        dataKey="count"
                        fill="#0f766e"
                        radius={[0, 6, 6, 0]}
                        maxBarSize={28}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[260px] items-center justify-center text-muted-foreground">
                    No category data available
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* ─── Bottom Row ─── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {/* Assets by Location */}
        {loading ? (
          <ListSkeleton />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Assets by Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                {locationData.length > 0 ? (
                  <div className="space-y-4">
                    <ScrollArea className="max-h-[320px]">
                      <div className="space-y-3 pr-3">
                        {locationData.map((loc) => {
                          const pct = (loc.count / maxLocationCount) * 100
                          return (
                            <div key={loc.location}>
                              <div className="mb-1.5 flex items-center justify-between">
                                <span className="truncate text-sm font-medium">
                                  {loc.location}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className="ml-2 shrink-0 tabular-nums"
                                >
                                  {loc.count}
                                </Badge>
                              </div>
                              <Progress
                                value={pct}
                                className="h-2 [&>[data-slot=progress-indicator]]:bg-teal-600"
                              />
                            </div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                    <div className="mt-2 border-t pt-3">
                      <p className="text-xs text-muted-foreground">
                        {locationData.reduce((acc, l) => acc + l.count, 0)} assets
                        across {locationData.length} location
                        {locationData.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center text-muted-foreground">
                    No location data available
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Recent Activity */}
        {loading ? (
          <ListSkeleton />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentLogs.length > 0 ? (
                  <ScrollArea className="max-h-[320px]">
                    <div className="relative space-y-0 pr-3">
                      {/* Timeline line */}
                      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

                      {recentLogs.map((log, idx) => {
                        const Icon = getActionIcon(log.action)
                        return (
                          <div
                            key={log.id}
                            className="relative flex gap-3 py-3"
                          >
                            {/* Icon node */}
                            <div className="relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border bg-background shadow-sm">
                              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>

                            {/* Content */}
                            <div className="min-w-0 flex-1 pt-0.5">
                              <p className="truncate text-sm font-medium leading-tight">
                                {log.action}
                              </p>
                              {log.details && (
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                  {log.details}
                                </p>
                              )}
                              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{relativeTime(log.createdAt)}</span>
                                {log.user?.name && (
                                  <>
                                    <span className="text-border">·</span>
                                    <span className="font-medium text-foreground/70">
                                      {log.user.name}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex h-40 items-center justify-center text-muted-foreground">
                    No recent activity
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  )
}
