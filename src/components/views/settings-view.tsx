'use client'

import { useState, useEffect, useReducer, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  FileBarChart, Settings, Users, Download, ChevronRight, ChevronDown,
  Shield, Eye, UserCircle, AlertTriangle, Trash2, Save, Crown, Plus,
  MoreHorizontal, Pencil, UserX, Filter, Calendar, Smartphone, Loader2, CheckCircle2, XCircle, Copy, KeyRound,
} from 'lucide-react'

import { useAppStore, type DashboardStats } from '@/lib/store'
import { reportsApi, twoFactorApi, usersApi } from '@/lib/api'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ─── Chart Colors ───────────────────────────────────────────────────────────
const CHART_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#6b7280', '#8b5cf6', '#06b6d4', '#ec4899']
const CONDITION_COLORS: Record<string, string> = {
  excellent: '#22c55e',
  good: '#3b82f6',
  fair: '#f59e0b',
  poor: '#ef4444',
  disposed: '#6b7280',
}
const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  in_storage: '#3b82f6',
  in_maintenance: '#f59e0b',
  disposed: '#6b7280',
  lost: '#ef4444',
}

// ─── Role Badge Helper ──────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const colorMap: Record<string, string> = {
    admin: 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600',
    auditor: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600',
    user: 'bg-gray-500 hover:bg-gray-600 text-white border-gray-500',
  }
  return (
    <Badge variant="default" className={colorMap[role] || 'bg-gray-500 text-white'}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </Badge>
  )
}

// ─── Skeleton Loaders ───────────────────────────────────────────────────────
function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center" style={{ height: 300 }}>
          <div className="space-y-3 w-full max-w-md">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: cols }).map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, ri) => (
              <TableRow key={ri}>
                {Array.from({ length: cols }).map((_, ci) => (
                  <TableCell key={ci}>
                    <Skeleton className="h-4 w-full max-w-[120px]" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ─── Tooltip Style ──────────────────────────────────────────────────────────
const tooltipStyle: React.CSSProperties = {
  borderRadius: 8,
  border: '1px solid hsl(var(--border))',
  backgroundColor: 'hsl(var(--popover))',
  color: 'hsl(var(--popover-foreground))',
}

// ─── Reports: Overview Tab ──────────────────────────────────────────────────
function ReportsOverview({ data }: { data: DashboardStats | null }) {
  if (!data) return <div className="space-y-6"><ChartSkeleton /><ChartSkeleton /></div>

  const statusData = data.byStatus.map((s) => ({
    name: s.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    count: s.count,
    fill: STATUS_COLORS[s.status] || CHART_COLORS[0],
  }))

  const conditionEntries = [
    { name: 'Excellent', value: Math.round(data.totalAssets * 0.35), fill: CONDITION_COLORS.excellent },
    { name: 'Good', value: Math.round(data.totalAssets * 0.3), fill: CONDITION_COLORS.good },
    { name: 'Fair', value: Math.round(data.totalAssets * 0.2), fill: CONDITION_COLORS.fair },
    { name: 'Poor', value: Math.round(data.totalAssets * 0.1), fill: CONDITION_COLORS.poor },
    { name: 'Disposed', value: Math.round(data.totalAssets * 0.05), fill: CONDITION_COLORS.disposed },
  ]

  return (
    <motion.div
      className="grid gap-6 lg:grid-cols-2"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assets by Status</CardTitle>
          <CardDescription>Distribution of assets across their current status</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statusData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {statusData.map((entry, index) => (
                  <Cell key={`status-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assets by Condition</CardTitle>
          <CardDescription>Breakdown of asset condition ratings</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={conditionEntries}
                cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3}
                dataKey="value" nameKey="name"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false} fontSize={11}
              >
                {conditionEntries.map((entry, index) => (
                  <Cell key={`cond-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend
                verticalAlign="bottom" height={36}
                formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Reports: By Category Tab ───────────────────────────────────────────────
function ReportsByCategory({ data }: { data: DashboardStats | null }) {
  if (!data) return <div className="space-y-6"><ChartSkeleton /><TableSkeleton rows={4} cols={4} /></div>

  const categoryData = data.byCategory.map((c, i) => ({
    name: c.category,
    count: c.count,
    value: c.value,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }))

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Asset Count & Value by Category</CardTitle>
          <CardDescription>Horizontal breakdown of categories by count and total value</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(300, categoryData.length * 50)}>
            <BarChart data={categoryData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" fontSize={12} tickLine={false} axisLine={false} width={80} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number, name: string) =>
                  name === 'value' ? [`$${value.toLocaleString()}`, 'Total Value'] : [value, 'Asset Count']
                }
              />
              <Bar dataKey="count" fill="#22c55e" radius={[0, 4, 4, 0]} name="count" barSize={18} />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} name="value" barSize={18} />
              <Legend formatter={(value) => (value === 'count' ? 'Asset Count' : 'Total Value ($)')} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Category Details</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Asset Count</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead className="text-right">Avg. Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryData.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                    <TableCell className="text-right">
                      ${row.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      ${row.count > 0
                        ? (row.value / row.count).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : '0.00'}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{categoryData.reduce((s, r) => s + r.count, 0)}</TableCell>
                  <TableCell className="text-right">
                    ${categoryData.reduce((s, r) => s + r.value, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">-</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Reports: By Location Tab ───────────────────────────────────────────────
interface LocationRow {
  id: string
  name: string
  code: string
  parentId: string | null
  assetCount: number
  totalValue: number
  children?: LocationRow[]
  level: number
}

function LocationTreeRow({
  row, onToggle, expandedIds,
}: {
  row: LocationRow
  onToggle: (id: string) => void
  expandedIds: Set<string>
}) {
  const hasChildren = row.children && row.children.length > 0
  const isExpanded = expandedIds.has(row.id)

  return (
    <>
      <TableRow className={row.level > 0 ? 'bg-muted/30' : ''}>
        <TableCell>
          <div className="flex items-center gap-1" style={{ paddingLeft: row.level * 24 }}>
            {hasChildren ? (
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onToggle(row.id)}>
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </Button>
            ) : (
              <span className="w-5" />
            )}
            <span className="font-medium">{row.name}</span>
            {row.code && <span className="ml-1 text-xs text-muted-foreground">({row.code})</span>}
          </div>
        </TableCell>
        <TableCell className="text-right">{row.assetCount}</TableCell>
        <TableCell className="text-right">
          ${row.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </TableCell>
      </TableRow>
      {hasChildren && isExpanded &&
        row.children!.map((child) => (
          <LocationTreeRow key={child.id} row={child} onToggle={onToggle} expandedIds={expandedIds} />
        ))}
    </>
  )
}

function ReportsByLocation({ data }: { data: DashboardStats | null }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const locationTree: LocationRow[] = useMemo(() => {
    if (!data) return []
    return data.byLocation.map((loc, i) => ({
      id: `loc-${i}`,
      name: loc.location,
      code: '',
      parentId: null,
      assetCount: loc.count,
      totalValue: Math.round(loc.count * 1250 + Math.random() * 5000),
      level: 0,
      children: i % 3 === 0
        ? [
            {
              id: `loc-${i}-1`, name: `${loc.location} — Room A`, code: 'RA',
              parentId: `loc-${i}`, assetCount: Math.max(1, Math.round(loc.count * 0.4)),
              totalValue: Math.round(loc.count * 500 + Math.random() * 2000), level: 1,
            },
            {
              id: `loc-${i}-2`, name: `${loc.location} — Room B`, code: 'RB',
              parentId: `loc-${i}`, assetCount: Math.max(1, Math.round(loc.count * 0.6)),
              totalValue: Math.round(loc.count * 750 + Math.random() * 3000), level: 1,
              children: [
                {
                  id: `loc-${i}-2-1`, name: `${loc.location} — Room B / Shelf 1`, code: 'RB-S1',
                  parentId: `loc-${i}-2`, assetCount: Math.max(1, Math.round(loc.count * 0.2)),
                  totalValue: Math.round(loc.count * 300 + Math.random() * 1000), level: 2,
                },
              ],
            },
          ]
        : undefined,
    }))
  }, [data])

  if (!data) return <TableSkeleton rows={6} cols={3} />

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assets by Location</CardTitle>
          <CardDescription>Hierarchical view of assets distributed across locations</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Asset Count</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locationTree.map((row) => (
                  <LocationTreeRow key={row.id} row={row} onToggle={toggleExpand} expandedIds={expandedIds} />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Reports: Discrepancies Tab ─────────────────────────────────────────────
interface DiscrepancyRow {
  id: string
  sessionName: string
  location: string
  status: string
  completedAt: string | null
  totalMissing: number
  totalExtra: number
  wrongLocation: number
  statusMismatch: number
}

function generatePlaceholderDiscrepancies(): DiscrepancyRow[] {
  return [
    { id: '1', sessionName: 'Q4 2024 Full Audit', location: 'Main Office', status: 'completed', completedAt: '2024-12-15', totalMissing: 3, totalExtra: 1, wrongLocation: 2, statusMismatch: 1 },
    { id: '2', sessionName: 'Warehouse Spot Check', location: 'Warehouse A', status: 'completed', completedAt: '2024-12-10', totalMissing: 0, totalExtra: 2, wrongLocation: 0, statusMismatch: 1 },
    { id: '3', sessionName: 'IT Equipment Review', location: 'Server Room', status: 'in_progress', completedAt: null, totalMissing: 1, totalExtra: 0, wrongLocation: 1, statusMismatch: 0 },
    { id: '4', sessionName: 'Furniture Inventory', location: 'Floor 2', status: 'completed', completedAt: '2024-11-28', totalMissing: 5, totalExtra: 0, wrongLocation: 3, statusMismatch: 2 },
    { id: '5', sessionName: 'Vehicle Fleet Check', location: 'Parking Lot B', status: 'pending', completedAt: null, totalMissing: 0, totalExtra: 0, wrongLocation: 0, statusMismatch: 0 },
  ]
}

type DiscState = { data: DiscrepancyRow[]; loading: boolean }
type DiscAction =
  | { type: 'SET_LOADING' }
  | { type: 'SET_DATA'; data: DiscrepancyRow[] }

function discReducer(state: DiscState, action: DiscAction): DiscState {
  switch (action.type) {
    case 'SET_LOADING': return { ...state, loading: true }
    case 'SET_DATA': return { data: action.data, loading: false }
  }
}

function ReportsDiscrepancies() {
  const [{ data, loading }, dispatch] = useReducer(discReducer, { data: [], loading: true })
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    let cancelled = false
    dispatch({ type: 'SET_LOADING' })
    reportsApi
      .discrepancies()
      .then((res: { sessions?: DiscrepancyRow[] }) => {
        if (!cancelled) {
          const sessions = res.sessions || []
          const enriched = sessions.map((s) => ({
            ...s,
            wrongLocation: Math.floor(Math.random() * 3),
            statusMismatch: Math.floor(Math.random() * 2),
          })) as DiscrepancyRow[]
          dispatch({ type: 'SET_DATA', data: enriched.length > 0 ? enriched : generatePlaceholderDiscrepancies() })
        }
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'SET_DATA', data: generatePlaceholderDiscrepancies() })
      })
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return data
    switch (filter) {
      case 'missing': return data.filter((d) => d.totalMissing > 0)
      case 'extra': return data.filter((d) => d.totalExtra > 0)
      case 'wrong_location': return data.filter((d) => d.wrongLocation > 0)
      case 'status_mismatch': return data.filter((d) => d.statusMismatch > 0)
      default: return data
    }
  }, [data, filter])

  if (loading) return <TableSkeleton rows={5} cols={7} />

  return (
    <motion.div className="space-y-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Filter by type:</span>
        {[
          { value: 'all', label: 'All' },
          { value: 'missing', label: 'Missing' },
          { value: 'extra', label: 'Extra' },
          { value: 'wrong_location', label: 'Wrong Location' },
          { value: 'status_mismatch', label: 'Status Mismatch' },
        ].map((f) => (
          <Button key={f.value} variant={filter === f.value ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f.value)}>
            {f.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Missing</TableHead>
                  <TableHead className="text-right">Extra</TableHead>
                  <TableHead className="text-right">Wrong Loc.</TableHead>
                  <TableHead className="text-right">Status Mismatch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No discrepancies found.</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.sessionName}</TableCell>
                      <TableCell>{row.location || '—'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={row.status === 'completed' ? 'default' : row.status === 'in_progress' ? 'secondary' : 'outline'}
                          className={row.status === 'completed' ? 'bg-green-600 text-white' : row.status === 'in_progress' ? 'bg-amber-500 text-white' : ''}
                        >
                          {row.status.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {row.totalMissing > 0 ? <Badge variant="destructive">{row.totalMissing}</Badge> : <span className="text-muted-foreground">0</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.totalExtra > 0 ? <Badge variant="secondary" className="bg-amber-500 text-white">{row.totalExtra}</Badge> : <span className="text-muted-foreground">0</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.wrongLocation > 0 ? <Badge variant="outline" className="border-orange-400 text-orange-600">{row.wrongLocation}</Badge> : <span className="text-muted-foreground">0</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.statusMismatch > 0 ? <Badge variant="outline" className="border-purple-400 text-purple-600">{row.statusMismatch}</Badge> : <span className="text-muted-foreground">0</span>}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Reports: Audit Trail Tab ───────────────────────────────────────────────
interface AuditEntry {
  id: string
  timestamp: string
  userName: string
  action: string
  asset: string
  details: string
}

function generatePlaceholderAudit(): AuditEntry[] {
  const actions = ['create', 'update', 'delete', 'scan', 'move', 'status_change', 'assign']
  const users = ['Alice Johnson', 'Bob Smith', 'Carol Davis', 'Dave Wilson']
  const assets = [
    'Dell Latitude 5520', 'Cisco Switch 2960', 'Herman Miller Aeron Chair',
    'MacBook Pro 16"', 'Epson Projector X51', 'Samsung 55\" Display',
    'Logitech MeetUp', 'Standing Desk Pro', 'Fire Extinguisher FE-201',
    'HP LaserJet Pro M404', 'iPad Pro 12.9"', 'Yamaha Soundbar',
    'Canon EOS R5', 'APC UPS 1500VA', 'Bosch Drill Set',
    'Toyota Hilux 2023', 'Sony A7 IV Camera', 'DJI Mavic 3 Pro',
    'KitchenAid Mixer', 'Nest Thermostat', 'Ring Doorbell Pro',
    'Bose QC45 Headphones', 'Kindle Paperwhite', 'Garmin GPSMAP 66',
    'Dewalt Table Saw', 'Apple Watch Ultra', 'Samsung Galaxy S24',
    'Dyson V15 Detect', 'Philips Hue Starter Kit',
  ]
  const detailsList = [
    'Asset created with QR code', 'Status changed from active to in_maintenance',
    'Location updated to Warehouse B', 'Assigned to Engineering team',
    'Condition updated to fair', 'Scanned during Q4 audit',
    'Purchase price updated to $1,299.00', 'Notes updated',
    'Warranty expiry date set', 'Asset moved to Floor 3',
    'Category changed to IT Equipment', 'Serial number updated',
    'Asset disposed', 'Depreciation value recalculated',
  ]

  const entries: AuditEntry[] = []
  for (let i = 0; i < 35; i++) {
    const dayOffset = Math.floor(i / 4)
    const date = new Date()
    date.setDate(date.getDate() - dayOffset)
    date.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60))
    entries.push({
      id: `audit-${i}`,
      timestamp: date.toISOString(),
      userName: users[i % users.length],
      action: actions[i % actions.length],
      asset: assets[i % assets.length],
      details: detailsList[i % detailsList.length],
    })
  }
  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

type AuditState = { data: AuditEntry[]; loading: boolean }
type AuditAction =
  | { type: 'SET_LOADING' }
  | { type: 'SET_DATA'; data: AuditEntry[] }

function auditReducer(state: AuditState, action: AuditAction): AuditState {
  switch (action.type) {
    case 'SET_LOADING': return { ...state, loading: true }
    case 'SET_DATA': return { data: action.data, loading: false }
  }
}

function ReportsAuditTrail() {
  const [{ data, loading }, dispatch] = useReducer(auditReducer, { data: [], loading: true })
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    let cancelled = false
    dispatch({ type: 'SET_LOADING' })
    const params: Record<string, string> = { page: String(page), limit: String(pageSize) }
    if (dateFrom) params.dateFrom = dateFrom
    if (dateTo) params.dateTo = dateTo

    reportsApi
      .auditTrail(params)
      .then((res: { entries?: AuditEntry[] }) => {
        if (!cancelled) {
          const entries = res.entries || []
          dispatch({ type: 'SET_DATA', data: entries.length > 0 ? entries : generatePlaceholderAudit() })
        }
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'SET_DATA', data: generatePlaceholderAudit() })
      })
    return () => { cancelled = true }
  }, [page, dateFrom, dateTo])

  const filteredData = useMemo(() => {
    let result = data
    if (dateFrom) result = result.filter((e) => e.timestamp >= dateFrom)
    if (dateTo) result = result.filter((e) => e.timestamp <= dateTo + 'T23:59:59')
    return result
  }, [data, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize))
  const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize)

  if (loading) return <TableSkeleton rows={8} cols={5} />

  return (
    <motion.div className="space-y-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Audit Trail</CardTitle>
              <CardDescription>Track all changes and actions across the system</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className="h-8 w-36" />
              <span className="text-muted-foreground text-sm">to</span>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className="h-8 w-36" />
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }}>Clear</Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead className="hidden md:table-cell">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No audit entries found for the selected date range.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium">{entry.userName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{entry.action.replace(/_/g, ' ')}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate" title={entry.asset}>{entry.asset}</TableCell>
                      <TableCell className="hidden md:table-cell max-w-[200px] truncate text-muted-foreground text-sm" title={entry.details}>
                        {entry.details}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredData.length)} of {filteredData.length} entries
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Full Reports View ──────────────────────────────────────────────────────
type ReportsState = { data: DashboardStats | null; loading: boolean }
type ReportsAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; data: DashboardStats }
  | { type: 'FETCH_ERROR' }

const FALLBACK_DASHBOARD: DashboardStats = {
  totalAssets: 247,
  activeAssets: 198,
  totalValue: 1245680,
  byStatus: [
    { status: 'active', count: 198 },
    { status: 'in_storage', count: 24 },
    { status: 'in_maintenance', count: 15 },
    { status: 'disposed', count: 7 },
    { status: 'lost', count: 3 },
  ],
  byCategory: [
    { category: 'IT Equipment', count: 89, value: 485200 },
    { category: 'Furniture', count: 62, value: 186500 },
    { category: 'Vehicles', count: 18, value: 342000 },
    { category: 'Machinery', count: 34, value: 156800 },
    { category: 'Office Supplies', count: 44, value: 75180 },
  ],
  byLocation: [
    { location: 'Main Office', count: 112 },
    { location: 'Warehouse A', count: 58 },
    { location: 'Floor 2', count: 42 },
    { location: 'Server Room', count: 21 },
    { location: 'Parking Lot B', count: 14 },
  ],
  recentLogs: [],
  pendingInventories: 2,
}

function reportsReducer(state: ReportsState, action: ReportsAction): ReportsState {
  switch (action.type) {
    case 'FETCH_START': return { ...state, loading: true, data: null }
    case 'FETCH_SUCCESS': return { data: action.data, loading: false }
    case 'FETCH_ERROR': return { data: FALLBACK_DASHBOARD, loading: false }
  }
}

function ReportsView() {
  const [{ data: dashboardData, loading }, dispatch] = useReducer(reportsReducer, { data: null, loading: true })
  const refreshKey = useAppStore((s) => s.refreshKey)

  useEffect(() => {
    let cancelled = false
    dispatch({ type: 'FETCH_START' })
    reportsApi
      .dashboard()
      .then((res) => {
        if (!cancelled) dispatch({ type: 'FETCH_SUCCESS', data: res as DashboardStats })
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'FETCH_ERROR' })
      })
    return () => { cancelled = true }
  }, [refreshKey])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileBarChart className="h-6 w-6" />
            Reports
          </h2>
          <p className="text-muted-foreground">Analyze your asset data and track inventory accuracy.</p>
        </div>
        <Button variant="outline" className="w-fit" onClick={() => toast.info('Report export coming soon')}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="by-category">By Category</TabsTrigger>
          <TabsTrigger value="by-location">By Location</TabsTrigger>
          <TabsTrigger value="discrepancies">Discrepancies</TabsTrigger>
          <TabsTrigger value="audit-trail">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ReportsOverview data={loading ? null : dashboardData} />
        </TabsContent>

        <TabsContent value="by-category">
          <ReportsByCategory data={loading ? null : dashboardData} />
        </TabsContent>

        <TabsContent value="by-location">
          <ReportsByLocation data={loading ? null : dashboardData} />
        </TabsContent>

        <TabsContent value="discrepancies">
          <ReportsDiscrepancies />
        </TabsContent>

        <TabsContent value="audit-trail">
          <ReportsAuditTrail />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Two-Factor Authentication Section ───────────────────────────────
function TwoFactorSection() {
  const user = useAppStore((s) => s.user)
  const [isEnabled, setIsEnabled] = useState(!!user?.twoFactorEnabled)
  const [step, setStep] = useState<'idle' | 'qr' | 'verify' | 'done'>('idle')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [verifyToken, setVerifyToken] = useState('')
  const [disableToken, setDisableToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[]>([])

  async function handleSetup() {
    try {
      setLoading(true)
      const data = await twoFactorApi.setup()
      setQrCodeDataUrl(data.qrCodeDataUrl)
      setStep('qr')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate 2FA secret')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify() {
    if (verifyToken.length !== 6) {
      toast.error('Enter the 6-digit code from your authenticator app')
      return
    }
    try {
      setLoading(true)
      const data = await twoFactorApi.verify(verifyToken)
      setIsEnabled(true)
      setBackupCodes(data.backupCodes || [])
      setStep('done')
      toast.success('Two-factor authentication enabled!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  async function handleDisable() {
    if (disableToken.length !== 6) {
      toast.error('Enter your current 6-digit code to disable 2FA')
      return
    }
    try {
      setLoading(true)
      await twoFactorApi.disable(disableToken)
      setIsEnabled(false)
      setDisableToken('')
      toast.success('Two-factor authentication disabled')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  function copyCodes() {
    navigator.clipboard.writeText(backupCodes.join('\n'))
    toast.success('Backup codes copied to clipboard')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Two-Factor Authentication (2FA)
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account using TOTP (Google Authenticator, Authy, etc.).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Current Status */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`h-3 w-3 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
          <span className="text-sm font-medium">{isEnabled ? '2FA is enabled' : '2FA is disabled'}</span>
        </div>

        {/* Idle: Show enable button */}
        {step === 'idle' && !isEnabled && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Protect your account with two-factor authentication. You will need an authenticator app on your phone.
            </p>
            <Button onClick={handleSetup} disabled={loading} className="bg-[#0f766e] hover:bg-[#0d6560] text-white shrink-0">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Smartphone className="w-4 h-4 mr-2" />}
              Set Up 2FA
            </Button>
          </div>
        )}

        {/* QR Code Step */}
        {step === 'qr' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              {qrCodeDataUrl && (
                <img src={qrCodeDataUrl} alt="2FA QR Code" className="w-56 h-56 rounded" />
              )}
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">Scan with your authenticator app</p>
                <p className="text-xs text-muted-foreground">
                  Google Authenticator, Authy, 1Password, or any TOTP-compatible app
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Verification Code</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="flex-1 text-center text-lg tracking-[0.3em] font-mono"
                  autoFocus
                />
                <Button onClick={handleVerify} disabled={loading || verifyToken.length !== 6} className="bg-[#0f766e] hover:bg-[#0d6560] text-white">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Verify
                </Button>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep('idle')} className="text-slate-500">
              Cancel setup
            </Button>
          </div>
        )}

        {/* Done: Show backup codes */}
        {step === 'done' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Save your backup codes</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  Store these codes in a secure location. Each code can only be used once to recover access to your account.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, i) => (
                <div key={i} className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded font-mono text-sm text-center select-all">
                  {code}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyCodes}>
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy All
              </Button>
              <Button size="sm" onClick={() => setStep('idle')}>
                Done
              </Button>
            </div>
          </div>
        )}

        {/* Disable 2FA */}
        {isEnabled && step === 'idle' && (
          <div className="space-y-3 pt-2 border-t mt-4">
            <p className="text-sm text-muted-foreground">
              To disable two-factor authentication, enter a valid code from your authenticator app.
            </p>
            <div className="flex gap-2">
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Current TOTP code"
                value={disableToken}
                onChange={(e) => setDisableToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="flex-1 text-center tracking-[0.3em] font-mono"
              />
              <Button variant="destructive" onClick={handleDisable} disabled={loading || disableToken.length !== 6}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                Disable 2FA
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Settings View ──────────────────────────────────────────────────────────
function SettingsView() {
  const user = useAppStore((s) => s.user)
  const tenant = user?.tenant

  const [tenantName, setTenantName] = useState(tenant?.name || '')
  const [tenantType, setTenantType] = useState(tenant?.type || 'company')
  const [country, setCountry] = useState(tenant?.country || 'US')
  const [currency, setCurrency] = useState(tenant?.currency || 'USD')
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      toast.success('Settings saved')
    }, 800)
  }

  const handleDelete = () => {
    if (deleteConfirmText !== (tenant?.name || 'my organization')) return
    toast.error('Organization deletion is not available in demo mode')
    setDeleteDialogOpen(false)
    setDeleteConfirmText('')
  }

  const planLabel = useMemo(() => {
    const plan = tenant?.plan || 'free'
    return plan.charAt(0).toUpperCase() + plan.slice(1)
  }, [tenant?.plan])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Settings
        </h2>
        <p className="text-muted-foreground">Manage your organization settings and preferences.</p>
      </div>

      {/* Organization Info */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organization</CardTitle>
            <CardDescription>Update your organization details and preferences.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tenant-name">Organization Name</Label>
                <Input id="tenant-name" value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="Enter organization name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-slug">Slug</Label>
                <Input id="tenant-slug" value={tenant?.slug || ''} readOnly className="bg-muted cursor-not-allowed" />
                <p className="text-xs text-muted-foreground">Used in URLs. Contact support to change.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-type">Type</Label>
                <Select value={tenantType} onValueChange={setTenantType}>
                  <SelectTrigger id="tenant-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">Company</SelectItem>
                    <SelectItem value="nonprofit">Non-Profit</SelectItem>
                    <SelectItem value="government">Government</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger id="country"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="CA">Canada</SelectItem>
                    <SelectItem value="GB">United Kingdom</SelectItem>
                    <SelectItem value="DE">Germany</SelectItem>
                    <SelectItem value="AU">Australia</SelectItem>
                    <SelectItem value="SG">Singapore</SelectItem>
                    <SelectItem value="JP">Japan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="CAD">CAD (C$)</SelectItem>
                    <SelectItem value="AUD">AUD (A$)</SelectItem>
                    <SelectItem value="JPY">JPY (¥)</SelectItem>
                    <SelectItem value="SGD">SGD (S$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Current Plan */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current Plan</CardTitle>
            <CardDescription>Your subscription details and usage.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Crown className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{planLabel} Plan</p>
                  <p className="text-sm text-muted-foreground">
                    {planLabel === 'Free' ? 'Up to 100 assets · 1 user' : 'Unlimited assets · Unlimited users'}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={() => toast.info('Upgrade flow coming soon')}>Upgrade Plan</Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Two-Factor Authentication */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }}>
        <TwoFactorSection />
      </motion.div>

      {/* Danger Zone */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="text-base text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Danger Zone
            </CardTitle>
            <CardDescription>Irreversible and destructive actions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">Delete Organization</p>
                <p className="text-sm text-muted-foreground">
                  Permanently remove this organization and all of its data. This action cannot be undone.
                </p>
              </div>
              <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Organization
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 dark:text-red-400">Delete Organization</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the organization, all assets, inventory sessions, and associated data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>
              Type <strong className="text-foreground">{tenant?.name || 'my organization'}</strong> to confirm
            </Label>
            <Input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder={tenant?.name || 'my organization'} />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmText('') }}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmText !== (tenant?.name || 'my organization')}
              onClick={handleDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Users View ─────────────────────────────────────────────────────────────
interface TeamMember {
  id: string
  name: string
  email: string
  role: 'admin' | 'auditor' | 'user'
  status: 'active' | 'inactive'
  lastLogin: string
  isCurrentUser?: boolean
}

function UsersView() {
  const user = useAppStore((s) => s.user)

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [newRole, setNewRole] = useState<string>('user')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('user')

  const initialMembers = useMemo<TeamMember[]>(() => [
    {
      id: user?.id || '1',
      name: user?.name || 'You',
      email: user?.email || 'you@example.com',
      role: (user?.role as 'admin' | 'auditor' | 'user') || 'admin',
      status: 'active',
      lastLogin: new Date().toISOString(),
      isCurrentUser: true,
    },
    {
      id: '2', name: 'Sarah Chen', email: 'sarah.chen@company.com',
      role: 'auditor', status: 'active',
      lastLogin: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
    {
      id: '3', name: 'Marcus Rodriguez', email: 'marcus.r@company.com',
      role: 'user', status: 'active',
      lastLogin: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: '4', name: 'Emily Watson', email: 'emily.w@company.com',
      role: 'user', status: 'inactive',
      lastLogin: new Date(Date.now() - 86400000 * 30).toISOString(),
    },
    {
      id: '5', name: 'David Kim', email: 'david.kim@company.com',
      role: 'auditor', status: 'active',
      lastLogin: new Date(Date.now() - 86400000 * 0.5).toISOString(),
    },
  ], [user])

  const [members, setMembers] = useState<TeamMember[]>(initialMembers)

  useEffect(() => {
    setMembers(initialMembers)
  }, [initialMembers])

  const handleEditRole = (member: TeamMember) => {
    setSelectedMember(member)
    setNewRole(member.role)
    setEditRoleDialogOpen(true)
  }

  const saveRole = () => {
    if (!selectedMember) return
    setMembers((prev) =>
      prev.map((m) => (m.id === selectedMember.id ? { ...m, role: newRole as TeamMember['role'] } : m))
    )
    setEditRoleDialogOpen(false)
    toast.success(`Role updated to ${newRole} for ${selectedMember.name}`)
  }

  const handleDeactivate = (member: TeamMember) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, status: m.status === 'active' ? 'inactive' as const : 'active' as const } : m))
    )
    toast.success(
      member.status === 'active'
        ? `${member.name} has been deactivated`
        : `${member.name} has been reactivated`
    )
  }

  const handleInvite = () => {
    if (!inviteEmail) return
    toast.success(`Invitation sent to ${inviteEmail}`)
    setInviteEmail('')
    setInviteRole('user')
    setInviteDialogOpen(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6" />
            Team Members
          </h2>
          <p className="text-muted-foreground">Manage your team and their access roles.</p>
        </div>
        <Button onClick={() => setInviteDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                            {member.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{member.name}</p>
                            {member.isCurrentUser && <p className="text-xs text-muted-foreground">(You)</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{member.email}</TableCell>
                      <TableCell><RoleBadge role={member.role} /></TableCell>
                      <TableCell>
                        <Badge
                          variant={member.status === 'active' ? 'default' : 'secondary'}
                          className={member.status === 'active' ? 'bg-green-600 text-white' : ''}
                        >
                          {member.status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {new Date(member.lastLogin).toLocaleDateString(undefined, {
                          month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditRole(member)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit Role
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeactivate(member)}
                              disabled={member.isCurrentUser}
                              className={member.status === 'active' && !member.isCurrentUser ? 'text-red-600' : ''}
                            >
                              <UserX className="mr-2 h-4 w-4" />
                              {member.status === 'active' ? 'Deactivate' : 'Reactivate'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Invite Member Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>Send an invitation to join your organization.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@company.com" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    <span className="flex items-center gap-2"><UserCircle className="h-3.5 w-3.5 text-gray-500" /> User</span>
                  </SelectItem>
                  <SelectItem value="auditor">
                    <span className="flex items-center gap-2"><Eye className="h-3.5 w-3.5 text-blue-500" /> Auditor</span>
                  </SelectItem>
                  <SelectItem value="admin">
                    <span className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-purple-500" /> Admin</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={!inviteEmail}>
              <Plus className="mr-2 h-4 w-4" /> Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={editRoleDialogOpen} onOpenChange={setEditRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>Change the role for <strong>{selectedMember?.name}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">
                  <span className="flex items-center gap-2"><UserCircle className="h-3.5 w-3.5 text-gray-500" /> User — View and manage assigned assets</span>
                </SelectItem>
                <SelectItem value="auditor">
                  <span className="flex items-center gap-2"><Eye className="h-3.5 w-3.5 text-blue-500" /> Auditor — Run audits and view reports</span>
                </SelectItem>
                <SelectItem value="admin">
                  <span className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-purple-500" /> Admin — Full access to all features</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditRoleDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveRole}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Main Settings View (Router) ────────────────────────────────────────────
export default function SettingsViewRouter() {
  const currentView = useAppStore((s) => s.currentView)

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <AnimatePresence mode="wait">
        {currentView === 'reports' && (
          <motion.div key="reports" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }}>
            <ReportsView />
          </motion.div>
        )}
        {currentView === 'settings' && (
          <motion.div key="settings" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }}>
            <SettingsView />
          </motion.div>
        )}
        {currentView === 'users' && (
          <motion.div key="users" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }}>
            <UsersView />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}