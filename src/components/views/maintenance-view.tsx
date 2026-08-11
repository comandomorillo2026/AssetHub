'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarClock,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Search,
  QrCode,
  Edit3,
  Check,
  XCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  Wrench,
  ShieldCheck,
  Siren,
  Loader2,
  Filter,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

import { useAppStore, type Asset } from '@/lib/store'
import { maintenanceApi, assetsApi } from '@/lib/api'

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */

interface MaintenanceAsset {
  id: string
  name: string
  qrCode: string
  tagNumber: string
  serialNumber?: string
  status?: string
}

interface MaintenanceRecord {
  id: string
  tenantId: string
  assetId: string
  asset: MaintenanceAsset
  type: 'preventive' | 'corrective' | 'emergency'
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  title: string
  description: string | null
  scheduledDate: string | null
  completedDate: string | null
  cost: number | null
  vendor: string | null
  vendorContact: string | null
  performedBy: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface MaintenanceForm {
  assetId: string
  title: string
  type: string
  description: string
  scheduledDate: string
  cost: string
  vendor: string
  vendorContact: string
  notes: string
}

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

function formatCurrency(value: number | null): string {
  if (value == null) return '—'
  return `TTD $${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const EMPTY_FORM: MaintenanceForm = {
  assetId: '',
  title: '',
  type: 'preventive',
  description: '',
  scheduledDate: '',
  cost: '',
  vendor: '',
  vendorContact: '',
  notes: '',
}

function statusColor(status: string): string {
  switch (status) {
    case 'scheduled': return 'bg-blue-100 text-blue-700'
    case 'in_progress': return 'bg-amber-100 text-amber-700'
    case 'completed': return 'bg-emerald-100 text-emerald-700'
    case 'cancelled': return 'bg-slate-100 text-slate-600'
    default: return 'bg-slate-100 text-slate-600'
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'scheduled': return 'Scheduled'
    case 'in_progress': return 'In Progress'
    case 'completed': return 'Completed'
    case 'cancelled': return 'Cancelled'
    default: return status
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'preventive': return 'Preventive'
    case 'corrective': return 'Corrective'
    case 'emergency': return 'Emergency'
    default: return type
  }
}

function typeIcon(type: string) {
  switch (type) {
    case 'preventive': return <ShieldCheck className="size-3.5" />
    case 'corrective': return <Wrench className="size-3.5" />
    case 'emergency': return <Siren className="size-3.5" />
    default: return <Wrench className="size-3.5" />
  }
}

function typeBadgeColor(type: string): string {
  switch (type) {
    case 'preventive': return 'bg-teal-50 text-teal-700 border-teal-200'
    case 'corrective': return 'bg-orange-50 text-orange-700 border-orange-200'
    case 'emergency': return 'bg-red-50 text-red-700 border-red-200'
    default: return 'bg-slate-50 text-slate-600 border-slate-200'
  }
}

/* ──────────────────────────────────────────────
   Animation variants
   ────────────────────────────────────────────── */

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.25 },
}

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.05 } },
}

/* ──────────────────────────────────────────────
   Main Component
   ────────────────────────────────────────────── */

export default function MaintenanceView() {
  const refreshKey = useAppStore((s) => s.refreshKey)
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)

  // Data state
  const [records, setRecords] = useState<MaintenanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Assets for searchable select
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Dialog state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<MaintenanceForm>(EMPTY_FORM)
  const [formSubmitting, setFormSubmitting] = useState(false)

  // Expand/collapse
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Action loading states
  const [actionLoading, setActionLoading] = useState<Record<string, string | null>>({})

  /* ──────────────────────────────────────────────
     Data fetching
     ────────────────────────────────────────────── */

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params: Record<string, string> = { limit: '200' }
      if (statusFilter !== 'all') params.status = statusFilter
      if (typeFilter !== 'all') params.type = typeFilter
      const res = await maintenanceApi.list(params)
      setRecords(res.data || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load maintenance records')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter])

  const fetchAssets = useCallback(async () => {
    try {
      setAssetsLoading(true)
      const res = await assetsApi.list({ limit: '200' })
      setAssets(res.data || [])
    } catch {
      // Silent fail for asset list
    } finally {
      setAssetsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords, refreshKey])

  useEffect(() => {
    if (showForm || editingId) {
      fetchAssets()
    }
  }, [showForm, editingId, fetchAssets])

  /* ──────────────────────────────────────────────
     Computed values
     ────────────────────────────────────────────── */

  const filteredRecords = useMemo(() => {
    let result = records
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.asset?.name?.toLowerCase().includes(q) ||
          r.vendor?.toLowerCase().includes(q)
      )
    }
    return result
  }, [records, searchQuery])

  const summaryStats = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return {
      scheduled: records.filter((r) => r.status === 'scheduled').length,
      inProgress: records.filter((r) => r.status === 'in_progress').length,
      completedThisMonth: records.filter(
        (r) => r.status === 'completed' && r.completedDate && new Date(r.completedDate) >= monthStart
      ).length,
      overdue: records.filter(
        (r) =>
          r.status === 'scheduled' &&
          r.scheduledDate &&
          new Date(r.scheduledDate) < now
      ).length,
    }
  }, [records])

  /* ──────────────────────────────────────────────
     Form handlers
     ────────────────────────────────────────────── */

  function openCreateForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEditForm(record: MaintenanceRecord) {
    setEditingId(record.id)
    setForm({
      assetId: record.assetId,
      title: record.title,
      type: record.type,
      description: record.description || '',
      scheduledDate: record.scheduledDate
        ? new Date(record.scheduledDate).toISOString().split('T')[0]
        : '',
      cost: record.cost != null ? String(record.cost) : '',
      vendor: record.vendor || '',
      vendorContact: record.vendorContact || '',
      notes: record.notes || '',
    })
    setShowForm(true)
  }

  async function handleSubmit() {
    if (!form.assetId || !form.title.trim()) {
      toast.error('Please select an asset and enter a title.')
      return
    }

    try {
      setFormSubmitting(true)
      const payload: Record<string, unknown> = {
        assetId: form.assetId,
        title: form.title.trim(),
        type: form.type,
        description: form.description.trim() || null,
        scheduledDate: form.scheduledDate || null,
        cost: form.cost ? parseFloat(form.cost) : null,
        vendor: form.vendor.trim() || null,
        vendorContact: form.vendorContact.trim() || null,
        notes: form.notes.trim() || null,
      }

      if (editingId) {
        await maintenanceApi.update(editingId, payload)
        toast.success('Maintenance record updated successfully.')
      } else {
        await maintenanceApi.create(payload)
        toast.success('Maintenance scheduled successfully.')
      }

      setShowForm(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
      triggerRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save maintenance record.')
    } finally {
      setFormSubmitting(false)
    }
  }

  async function handleComplete(record: MaintenanceRecord) {
    try {
      setActionLoading((prev) => ({ ...prev, [record.id]: 'completing' }))
      await maintenanceApi.update(record.id, { status: 'completed' })
      toast.success('Maintenance marked as completed.')
      triggerRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to complete maintenance.')
    } finally {
      setActionLoading((prev) => ({ ...prev, [record.id]: null }))
    }
  }

  async function handleCancel(record: MaintenanceRecord) {
    try {
      setActionLoading((prev) => ({ ...prev, [record.id]: 'cancelling' }))
      await maintenanceApi.update(record.id, { status: 'cancelled' })
      toast.success('Maintenance cancelled.')
      triggerRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel maintenance.')
    } finally {
      setActionLoading((prev) => ({ ...prev, [record.id]: null }))
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      await maintenanceApi.delete(deleteTarget.id)
      toast.success('Maintenance record deleted.')
      setDeleteTarget(null)
      triggerRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete maintenance record.')
    } finally {
      setDeleting(false)
    }
  }

  /* ──────────────────────────────────────────────
     Render
     ────────────────────────────────────────────── */

  const selectedAsset = assets.find((a) => a.id === form.assetId)

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div
          className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          {...fadeIn}
        >
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Maintenance</h1>
            <p className="text-sm text-slate-500">Manage and track asset maintenance schedules.</p>
          </div>
          <Button onClick={openCreateForm} className="bg-[#0f766e] hover:bg-[#0d6961] text-white shrink-0">
            <Plus className="size-4 mr-2" />
            Schedule Maintenance
          </Button>
        </motion.div>

        {/* Summary Cards */}
        <motion.div
          className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <motion.div {...fadeIn}>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50">
                    <CalendarClock className="size-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">
                      {loading ? <Skeleton className="h-7 w-8 inline-block" /> : summaryStats.scheduled}
                    </p>
                    <p className="text-xs text-slate-500">Scheduled</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div {...fadeIn}>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                    <Clock className="size-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">
                      {loading ? <Skeleton className="h-7 w-8 inline-block" /> : summaryStats.inProgress}
                    </p>
                    <p className="text-xs text-slate-500">In Progress</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div {...fadeIn}>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50">
                    <CheckCircle2 className="size-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">
                      {loading ? <Skeleton className="h-7 w-8 inline-block" /> : summaryStats.completedThisMonth}
                    </p>
                    <p className="text-xs text-slate-500">Completed This Month</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div {...fadeIn}>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-red-50">
                    <AlertTriangle className="size-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">
                      {loading ? <Skeleton className="h-7 w-8 inline-block" /> : summaryStats.overdue}
                    </p>
                    <p className="text-xs text-slate-500">Overdue</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Filters Row */}
        <motion.div
          className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center"
          {...fadeIn}
          transition={{ delay: 0.15 }}
        >
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search maintenance records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px] h-9">
              <Filter className="size-3.5 mr-1.5" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[160px] h-9">
              <Wrench className="size-3.5 mr-1.5" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="preventive">Preventive</SelectItem>
              <SelectItem value="corrective">Corrective</SelectItem>
              <SelectItem value="emergency">Emergency</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* Content */}
        {loading ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24 ml-auto" />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertTriangle className="size-10 text-red-400 mb-3" />
              <p className="text-sm text-red-600 font-medium">Failed to load maintenance records</p>
              <p className="text-xs text-slate-500 mt-1">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={fetchRecords}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : filteredRecords.length === 0 ? (
          <motion.div {...fadeIn}>
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="flex size-16 items-center justify-center rounded-full bg-slate-100 mb-4">
                  <Wrench className="size-8 text-slate-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-700">No maintenance records</h3>
                <p className="text-sm text-slate-500 mt-1 text-center max-w-sm">
                  {records.length === 0
                    ? 'Get started by scheduling your first maintenance task for an asset.'
                    : 'No records match your current filters.'}
                </p>
                {records.length === 0 && (
                  <Button onClick={openCreateForm} className="mt-4 bg-[#0f766e] hover:bg-[#0d6961] text-white">
                    <Plus className="size-4 mr-2" />
                    Schedule Maintenance
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <>
            {/* Desktop Table */}
            <motion.div {...fadeIn} transition={{ delay: 0.1 }} className="hidden md:block">
              <Card className="border-0 shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="font-semibold">Title</TableHead>
                      <TableHead className="font-semibold">Asset</TableHead>
                      <TableHead className="font-semibold">Type</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Scheduled Date</TableHead>
                      <TableHead className="font-semibold text-right">Cost</TableHead>
                      <TableHead className="font-semibold w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {filteredRecords.map((record) => (
                        <>
                          <TableRow
                            key={record.id}
                            className="cursor-pointer hover:bg-slate-50/60 transition-colors"
                            onClick={() =>
                              setExpandedId((prev) => (prev === record.id ? null : record.id))
                            }
                          >
                            <TableCell className="font-medium text-slate-900">
                              <div className="flex items-center gap-2">
                                {typeIcon(record.type)}
                                {record.title}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm text-slate-700">
                                  {record.asset?.name || 'Unknown'}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 h-5 font-normal bg-teal-50 text-teal-700 border-teal-200"
                                >
                                  <QrCode className="size-2.5 mr-0.5" />
                                  {record.asset?.tagNumber || '—'}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-xs gap-1 ${typeBadgeColor(record.type)}`}
                              >
                                {typeLabel(record.type)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-xs ${statusColor(record.status)}`}>
                                {statusLabel(record.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {formatDate(record.scheduledDate)}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600 text-right font-medium">
                              {formatCurrency(record.cost)}
                            </TableCell>
                            <TableCell>
                              {expandedId === record.id ? (
                                <ChevronUp className="size-4 text-slate-400" />
                              ) : (
                                <ChevronDown className="size-4 text-slate-400" />
                              )}
                            </TableCell>
                          </TableRow>
                          <TableRow key={`${record.id}-detail`}>
                            <TableCell colSpan={7} className="p-0 border-0">
                              <AnimatePresence>
                                {expandedId === record.id && (
                                  <motion.tr
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="block"
                                  >
                                    <td colSpan={7} className="p-0">
                                      <div className="bg-slate-50/70 px-8 py-4 border-t border-b">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                          <div>
                                            <p className="text-slate-400 text-xs mb-1">Description</p>
                                            <p className="text-slate-700">{record.description || '—'}</p>
                                          </div>
                                          <div>
                                            <p className="text-slate-400 text-xs mb-1">Vendor</p>
                                            <p className="text-slate-700">
                                              {record.vendor || '—'}
                                              {record.vendorContact && (
                                                <span className="text-slate-400 ml-1">({record.vendorContact})</span>
                                              )}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-slate-400 text-xs mb-1">Completed</p>
                                            <p className="text-slate-700">{formatDateTime(record.completedDate)}</p>
                                          </div>
                                          <div>
                                            <p className="text-slate-400 text-xs mb-1">Notes</p>
                                            <p className="text-slate-700">{record.notes || '—'}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-4">
                                          {(record.status === 'scheduled' || record.status === 'in_progress') && (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                openEditForm(record)
                                              }}
                                              disabled={!!actionLoading[record.id]}
                                            >
                                              <Edit3 className="size-3.5 mr-1.5" />
                                              Edit
                                            </Button>
                                          )}
                                          {record.status === 'in_progress' && (
                                            <>
                                              <Button
                                                size="sm"
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  handleComplete(record)
                                                }}
                                                disabled={!!actionLoading[record.id]}
                                              >
                                                {actionLoading[record.id] === 'completing' ? (
                                                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                                                ) : (
                                                  <Check className="size-3.5 mr-1.5" />
                                                )}
                                                Complete
                                              </Button>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-slate-500 hover:text-slate-700"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  handleCancel(record)
                                                }}
                                                disabled={!!actionLoading[record.id]}
                                              >
                                                {actionLoading[record.id] === 'cancelling' ? (
                                                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                                                ) : (
                                                  <XCircle className="size-3.5 mr-1.5" />
                                                )}
                                                Cancel
                                              </Button>
                                            </>
                                          )}
                                          {record.status === 'scheduled' && (
                                            <>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-slate-500 hover:text-slate-700"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  handleCancel(record)
                                                }}
                                                disabled={!!actionLoading[record.id]}
                                              >
                                                {actionLoading[record.id] === 'cancelling' ? (
                                                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                                                ) : (
                                                  <XCircle className="size-3.5 mr-1.5" />
                                                )}
                                                Cancel
                                              </Button>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  setDeleteTarget(record)
                                                }}
                                              >
                                                <Trash2 className="size-3.5 mr-1.5" />
                                                Delete
                                              </Button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  </motion.tr>
                                )}
                              </AnimatePresence>
                            </TableCell>
                          </TableRow>
                        </>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </Card>
            </motion.div>

            {/* Mobile Cards */}
            <motion.div
              {...fadeIn}
              transition={{ delay: 0.1 }}
              className="md:hidden space-y-3"
            >
              <AnimatePresence>
                {filteredRecords.map((record) => (
                  <motion.div
                    key={record.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="border-0 shadow-sm overflow-hidden">
                      <CardContent className="p-4">
                        <div
                          className="flex items-start justify-between cursor-pointer"
                          onClick={() =>
                            setExpandedId((prev) => (prev === record.id ? null : record.id))
                          }
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {typeIcon(record.type)}
                              <h3 className="text-sm font-semibold text-slate-900 truncate">
                                {record.title}
                              </h3>
                            </div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className="text-xs text-slate-500">
                                {record.asset?.name || 'Unknown'}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1 py-0 h-4 font-normal bg-teal-50 text-teal-700 border-teal-200"
                              >
                                {record.asset?.tagNumber || '—'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={`text-[10px] ${statusColor(record.status)}`}>
                                {statusLabel(record.status)}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${typeBadgeColor(record.type)}`}
                              >
                                {typeLabel(record.type)}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 ml-3">
                            <span className="text-xs text-slate-500">
                              {formatDate(record.scheduledDate)}
                            </span>
                            <span className="text-sm font-semibold text-slate-700">
                              {formatCurrency(record.cost)}
                            </span>
                            {expandedId === record.id ? (
                              <ChevronUp className="size-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="size-4 text-slate-400" />
                            )}
                          </div>
                        </div>

                        <AnimatePresence>
                          {expandedId === record.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <Separator className="my-3" />
                              <div className="space-y-2 text-sm">
                                {record.description && (
                                  <div>
                                    <p className="text-slate-400 text-xs">Description</p>
                                    <p className="text-slate-700">{record.description}</p>
                                  </div>
                                )}
                                {record.vendor && (
                                  <div>
                                    <p className="text-slate-400 text-xs">Vendor</p>
                                    <p className="text-slate-700">
                                      {record.vendor}
                                      {record.vendorContact && (
                                        <span className="text-slate-400 ml-1">
                                          ({record.vendorContact})
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                )}
                                {record.completedDate && (
                                  <div>
                                    <p className="text-slate-400 text-xs">Completed</p>
                                    <p className="text-slate-700">
                                      {formatDateTime(record.completedDate)}
                                    </p>
                                  </div>
                                )}
                                {record.notes && (
                                  <div>
                                    <p className="text-slate-400 text-xs">Notes</p>
                                    <p className="text-slate-700">{record.notes}</p>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-3 flex-wrap">
                                {(record.status === 'scheduled' || record.status === 'in_progress') && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={() => openEditForm(record)}
                                    disabled={!!actionLoading[record.id]}
                                  >
                                    <Edit3 className="size-3 mr-1" />
                                    Edit
                                  </Button>
                                )}
                                {record.status === 'in_progress' && (
                                  <>
                                    <Button
                                      size="sm"
                                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                      onClick={() => handleComplete(record)}
                                      disabled={!!actionLoading[record.id]}
                                    >
                                      {actionLoading[record.id] === 'completing' ? (
                                        <Loader2 className="size-3 mr-1 animate-spin" />
                                      ) : (
                                        <Check className="size-3 mr-1" />
                                      )}
                                      Complete
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 text-xs"
                                      onClick={() => handleCancel(record)}
                                      disabled={!!actionLoading[record.id]}
                                    >
                                      {actionLoading[record.id] === 'cancelling' ? (
                                        <Loader2 className="size-3 mr-1 animate-spin" />
                                      ) : (
                                        <XCircle className="size-3 mr-1" />
                                      )}
                                      Cancel
                                    </Button>
                                  </>
                                )}
                                {record.status === 'scheduled' && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 text-xs"
                                      onClick={() => handleCancel(record)}
                                      disabled={!!actionLoading[record.id]}
                                    >
                                      {actionLoading[record.id] === 'cancelling' ? (
                                        <Loader2 className="size-3 mr-1 animate-spin" />
                                      ) : (
                                        <XCircle className="size-3 mr-1" />
                                      )}
                                      Cancel
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => setDeleteTarget(record)}
                                    >
                                      <Trash2 className="size-3 mr-1" />
                                      Delete
                                    </Button>
                                  </>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM) } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {editingId ? 'Edit Maintenance' : 'Schedule Maintenance'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update the details of this maintenance record.'
                : 'Create a new maintenance schedule for an asset.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Asset Searchable Select */}
            <div className="space-y-2">
              <Label htmlFor="asset-select">
                Asset <span className="text-red-500">*</span>
              </Label>
              <Popover open={!!form.assetId || assetsLoading ? undefined : undefined}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between h-9 font-normal"
                    disabled={editingId ? true : false}
                  >
                    {selectedAsset
                      ? `${selectedAsset.name} (${selectedAsset.tagNumber})`
                      : 'Search assets by name or tag...'}
                    <Search className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command className="max-h-56">
                    <CommandInput placeholder="Search assets..." />
                    <CommandList>
                      <CommandEmpty>No assets found.</CommandEmpty>
                      <CommandGroup>
                        {assets.map((asset) => (
                          <CommandItem
                            key={asset.id}
                            value={`${asset.name} ${asset.tagNumber} ${asset.serialNumber || ''}`}
                            onSelect={() => {
                              setForm((f) => ({ ...f, assetId: asset.id }))
                            }}
                          >
                            <Check
                              className={`mr-2 size-4 ${form.assetId === asset.id ? 'opacity-100' : 'opacity-0'}`}
                            />
                            <div className="flex flex-col">
                              <span className="text-sm">{asset.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {asset.tagNumber}{asset.serialNumber ? ` · ${asset.serialNumber}` : ''}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {!form.assetId && (
                <p className="text-xs text-red-500">Please select an asset.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder="e.g., Quarterly HVAC Service"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventive">Preventive</SelectItem>
                    <SelectItem value="corrective">Corrective</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduled-date">Scheduled Date</Label>
                <Input
                  id="scheduled-date"
                  type="date"
                  value={form.scheduledDate}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the maintenance task..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost">Estimated Cost (TTD)</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.cost}
                  onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor</Label>
                <Input
                  id="vendor"
                  placeholder="Company name"
                  value={form.vendor}
                  onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor-contact">Vendor Contact</Label>
              <Input
                id="vendor-contact"
                placeholder="Phone or email"
                value={form.vendorContact}
                onChange={(e) => setForm((f) => ({ ...f, vendorContact: e.target.value }))}
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
                setForm(EMPTY_FORM)
              }}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={formSubmitting || !form.assetId || !form.title.trim()}
              className="bg-[#0f766e] hover:bg-[#0d6961] text-white"
            >
              {formSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
              {editingId ? 'Save Changes' : 'Schedule Maintenance'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Maintenance Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.title}&rdquo;? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
            >
              {deleting && <Loader2 className="size-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
