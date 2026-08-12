'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Search,
  Check,
  XCircle,
  Trash2,
  Loader2,
  Filter,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserPlus,
  Ban,
  MoreHorizontal,
  Edit3,
  ArrowRightLeft,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
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
import { workOrdersApi, assetsApi, locationsApi, usersApi } from '@/lib/api'

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */

interface WorkOrderAsset {
  id: string
  name: string
  tagNumber: string
  serialNumber?: string
  status?: string
}

interface WorkOrderUser {
  id: string
  name: string
  email: string
}

interface WorkOrderLocation {
  id: string
  name: string
  code: string
}

interface WorkOrder {
  id: string
  tenantId: string
  title: string
  description: string | null
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'approved' | 'in_progress' | 'completed' | 'closed' | 'cancelled'
  assetId?: string
  asset?: WorkOrderAsset
  locationId?: string
  location?: WorkOrderLocation
  assignedToId?: string
  assignedTo?: WorkOrderUser
  requestedById: string
  requestedBy?: WorkOrderUser
  dueDate?: string
  estimatedCost?: number
  actualCost?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

interface WorkOrderForm {
  title: string
  description: string
  priority: string
  assetId: string
  locationId: string
  dueDate: string
  estimatedCost: string
}

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatRelativeDate(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  const diffWeeks = Math.floor(diffDays / 7)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffWeeks < 4) return `${diffWeeks}w ago`
  return formatDate(dateStr)
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  return `TTD $${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

const EMPTY_FORM: WorkOrderForm = {
  title: '',
  description: '',
  priority: 'medium',
  assetId: '',
  locationId: '',
  dueDate: '',
  estimatedCost: '',
}

function priorityColor(priority: string): string {
  switch (priority) {
    case 'low': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
    case 'medium': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    case 'high': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
    case 'critical': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
    case 'approved': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    case 'in_progress': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
    case 'completed': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    case 'closed': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
    case 'cancelled': return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
    default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'pending': return 'Pending'
    case 'approved': return 'Approved'
    case 'in_progress': return 'In Progress'
    case 'completed': return 'Completed'
    case 'closed': return 'Closed'
    case 'cancelled': return 'Cancelled'
    default: return status
  }
}

function priorityLabel(priority: string): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1)
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

export default function WorkOrdersView() {
  const refreshKey = useAppStore((s) => s.refreshKey)
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)

  // Data state
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Reference data
  const [assets, setAssets] = useState<Asset[]>([])
  const [locations, setLocations] = useState<WorkOrderLocation[]>([])
  const [users, setUsers] = useState<WorkOrderUser[]>([])
  const [refLoading, setRefLoading] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Dialog state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<WorkOrderForm>(EMPTY_FORM)
  const [formSubmitting, setFormSubmitting] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<WorkOrder | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Action dialogs
  const [rejectTarget, setRejectTarget] = useState<WorkOrder | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const [assignTarget, setAssignTarget] = useState<WorkOrder | null>(null)
  const [assignUserId, setAssignUserId] = useState('')
  const [assigning, setAssigning] = useState(false)

  const [closeTarget, setCloseTarget] = useState<WorkOrder | null>(null)
  const [closeNotes, setCloseNotes] = useState('')
  const [closeActualCost, setCloseActualCost] = useState('')
  const [closing, setClosing] = useState(false)

  // Action loading states
  const [actionLoading, setActionLoading] = useState<Record<string, string | null>>({})

  /* ──────────────────────────────────────────────
     Data fetching
     ────────────────────────────────────────────── */

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params: Record<string, string> = { limit: '200' }
      if (statusFilter !== 'all') params.status = statusFilter
      if (priorityFilter !== 'all') params.priority = priorityFilter
      const res = await workOrdersApi.list(params)
      setOrders(res.data || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load work orders')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, priorityFilter])

  const fetchRefData = useCallback(async () => {
    try {
      setRefLoading(true)
      const [assetsRes, locationsRes, usersRes] = await Promise.allSettled([
        assetsApi.list({ limit: '200' }),
        locationsApi.list(),
        usersApi.list({ limit: '200' }),
      ])
      if (assetsRes.status === 'fulfilled') setAssets(assetsRes.value.data || [])
      if (locationsRes.status === 'fulfilled') setLocations(locationsRes.value.data || [])
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data || [])
    } catch {
      // Silent fail
    } finally {
      setRefLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders, refreshKey])

  useEffect(() => {
    if (showForm || assignTarget) {
      fetchRefData()
    }
  }, [showForm, assignTarget, fetchRefData])

  /* ──────────────────────────────────────────────
     Computed values
     ────────────────────────────────────────────── */

  const filteredOrders = useMemo(() => {
    let result = orders
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.asset?.name?.toLowerCase().includes(q) ||
          o.assignedTo?.name?.toLowerCase().includes(q) ||
          o.requestedBy?.name?.toLowerCase().includes(q)
      )
    }
    return result
  }, [orders, searchQuery])

  const summaryStats = useMemo(() => {
    return {
      pending: orders.filter((o) => o.status === 'pending').length,
      inProgress: orders.filter((o) => o.status === 'in_progress').length,
      completed: orders.filter((o) => o.status === 'completed').length,
      critical: orders.filter((o) => o.priority === 'critical' && o.status !== 'closed' && o.status !== 'cancelled').length,
    }
  }, [orders])

  /* ──────────────────────────────────────────────
     Form handlers
     ────────────────────────────────────────────── */

  function openCreateForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEditForm(order: WorkOrder) {
    setEditingId(order.id)
    setForm({
      title: order.title,
      description: order.description || '',
      priority: order.priority,
      assetId: order.assetId || '',
      locationId: order.locationId || '',
      dueDate: order.dueDate ? new Date(order.dueDate).toISOString().split('T')[0] : '',
      estimatedCost: order.estimatedCost != null ? String(order.estimatedCost) : '',
    })
    setShowForm(true)
  }

  async function handleSubmit() {
    if (!form.title.trim()) {
      toast.error('Please enter a title.')
      return
    }

    try {
      setFormSubmitting(true)
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        assetId: form.assetId || null,
        locationId: form.locationId || null,
        dueDate: form.dueDate || null,
        estimatedCost: form.estimatedCost ? parseFloat(form.estimatedCost) : null,
      }

      if (editingId) {
        await workOrdersApi.update(editingId, payload)
        toast.success('Work order updated successfully.')
      } else {
        await workOrdersApi.create(payload)
        toast.success('Work order created successfully.')
      }

      setShowForm(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
      triggerRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save work order.')
    } finally {
      setFormSubmitting(false)
    }
  }

  async function handleAction(order: WorkOrder, action: string, extra?: Record<string, unknown>) {
    try {
      setActionLoading((prev) => ({ ...prev, [order.id]: action }))
      switch (action) {
        case 'approve':
          await workOrdersApi.approve(order.id)
          toast.success('Work order approved.')
          break
        case 'complete':
          await workOrdersApi.complete(order.id)
          toast.success('Work order marked as completed.')
          break
        case 'cancel':
          await workOrdersApi.cancel(order.id)
          toast.success('Work order cancelled.')
          break
      }
      triggerRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} work order.`)
    } finally {
      setActionLoading((prev) => ({ ...prev, [order.id]: null }))
    }
  }

  async function handleReject() {
    if (!rejectTarget) return
    try {
      setRejecting(true)
      await workOrdersApi.reject(rejectTarget.id, { reason: rejectReason.trim() || null })
      toast.success('Work order rejected.')
      setRejectTarget(null)
      setRejectReason('')
      triggerRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject work order.')
    } finally {
      setRejecting(false)
    }
  }

  async function handleAssign() {
    if (!assignTarget || !assignUserId) {
      toast.error('Please select a user to assign.')
      return
    }
    try {
      setAssigning(true)
      await workOrdersApi.assign(assignTarget.id, { assignedToId: assignUserId })
      toast.success('Work order assigned successfully.')
      setAssignTarget(null)
      setAssignUserId('')
      triggerRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign work order.')
    } finally {
      setAssigning(false)
    }
  }

  async function handleClose() {
    if (!closeTarget) return
    try {
      setClosing(true)
      await workOrdersApi.close(closeTarget.id, {
        notes: closeNotes.trim() || null,
        actualCost: closeActualCost ? parseFloat(closeActualCost) : null,
      })
      toast.success('Work order closed.')
      setCloseTarget(null)
      setCloseNotes('')
      setCloseActualCost('')
      triggerRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to close work order.')
    } finally {
      setClosing(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      await workOrdersApi.delete(deleteTarget.id)
      toast.success('Work order deleted.')
      setDeleteTarget(null)
      triggerRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete work order.')
    } finally {
      setDeleting(false)
    }
  }

  /* ──────────────────────────────────────────────
     Render
     ────────────────────────────────────────────── */

  const selectedAsset = assets.find((a) => a.id === form.assetId)

  const statusFilters = ['all', 'pending', 'approved', 'in_progress', 'completed', 'closed', 'cancelled']
  const priorityFilters = ['all', 'low', 'medium', 'high', 'critical']

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div
          className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          {...fadeIn}
        >
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Work Orders</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Track and manage work orders across your organization.</p>
          </div>
          <Button onClick={openCreateForm} className="bg-[#0f766e] hover:bg-[#0d6961] text-white shrink-0">
            <Plus className="size-4 mr-2" />
            New Work Order
          </Button>
        </motion.div>

        {/* Summary Cards */}
        <motion.div
          className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {[
            { label: 'Pending', value: summaryStats.pending, icon: Clock, bg: 'bg-amber-50 dark:bg-amber-900/20', color: 'text-amber-600 dark:text-amber-400' },
            { label: 'In Progress', value: summaryStats.inProgress, icon: Loader2, bg: 'bg-indigo-50 dark:bg-indigo-900/20', color: 'text-indigo-600 dark:text-indigo-400' },
            { label: 'Completed', value: summaryStats.completed, icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-900/20', color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Critical', value: summaryStats.critical, icon: AlertTriangle, bg: 'bg-red-50 dark:bg-red-900/20', color: 'text-red-600 dark:text-red-400' },
          ].map((stat) => (
            <motion.div key={stat.label} {...fadeIn}>
              <Card className="border-0 shadow-sm dark:border dark:border-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex size-10 items-center justify-center rounded-lg ${stat.bg}`}>
                      <stat.icon className={`size-5 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {loading ? <Skeleton className="h-7 w-8 inline-block" /> : stat.value}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Filter Bar */}
        <motion.div className="mb-6 space-y-3" {...fadeIn} transition={{ delay: 0.15 }}>
          {/* Status pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="size-4 text-slate-400" />
            {statusFilters.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  statusFilter === s
                    ? 'bg-[#0f766e] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {s === 'all' ? 'All' : statusLabel(s)}
              </button>
            ))}
          </div>

          {/* Priority + Search row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search work orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full sm:w-[160px] h-9">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                {priorityFilters.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p === 'all' ? 'All Priority' : priorityLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Content */}
        {loading ? (
          <Card className="border-0 shadow-sm dark:border dark:border-slate-800">
            <CardContent className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24 ml-auto" />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-0 shadow-sm dark:border dark:border-slate-800">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertTriangle className="size-10 text-red-400 mb-3" />
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">Failed to load work orders</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={fetchOrders}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : filteredOrders.length === 0 ? (
          <motion.div {...fadeIn}>
            <Card className="border-0 shadow-sm dark:border dark:border-slate-800">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="flex size-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                  <ClipboardList className="size-8 text-slate-400 dark:text-slate-500" />
                </div>
                <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200">No work orders</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-sm">
                  {orders.length === 0
                    ? 'Get started by creating your first work order.'
                    : 'No work orders match your current filters.'}
                </p>
                {orders.length === 0 && (
                  <Button onClick={openCreateForm} className="mt-4 bg-[#0f766e] hover:bg-[#0d6961] text-white">
                    <Plus className="size-4 mr-2" />
                    New Work Order
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <>
            {/* Desktop Table */}
            <motion.div {...fadeIn} transition={{ delay: 0.1 }} className="hidden md:block">
              <Card className="border-0 shadow-sm overflow-hidden dark:border dark:border-slate-800">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 dark:bg-slate-900/50 dark:hover:bg-slate-900/50">
                      <TableHead className="font-semibold">Title</TableHead>
                      <TableHead className="font-semibold">Priority</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Asset</TableHead>
                      <TableHead className="font-semibold">Assigned To</TableHead>
                      <TableHead className="font-semibold">Requested By</TableHead>
                      <TableHead className="font-semibold">Due Date</TableHead>
                      <TableHead className="font-semibold">Created</TableHead>
                      <TableHead className="font-semibold w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                        <TableCell className="font-semibold text-slate-900 dark:text-white">{order.title}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${priorityColor(order.priority)}`}>
                            {priorityLabel(order.priority)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${statusColor(order.status)}`}>
                            {statusLabel(order.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                          {order.asset?.name || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                          {order.assignedTo?.name || <span className="text-slate-400 italic">Unassigned</span>}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                          {order.requestedBy?.name || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                          {formatDate(order.dueDate)}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500 dark:text-slate-400">
                          {formatRelativeDate(order.createdAt)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!!actionLoading[order.id]}>
                                {actionLoading[order.id] ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="size-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {order.status === 'pending' && (
                                <>
                                  <DropdownMenuItem onClick={() => handleAction(order, 'approve')}>
                                    <Check className="size-4 mr-2" /> Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setRejectTarget(order); setRejectReason('') }}>
                                    <XCircle className="size-4 mr-2" /> Reject
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleAction(order, 'cancel')}>
                                    <Ban className="size-4 mr-2" /> Cancel
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openEditForm(order)}>
                                    <Edit3 className="size-4 mr-2" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-red-600 focus:text-red-600"
                                    onClick={() => setDeleteTarget(order)}
                                  >
                                    <Trash2 className="size-4 mr-2" /> Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                              {order.status === 'approved' && (
                                <>
                                  <DropdownMenuItem onClick={() => { setAssignTarget(order); setAssignUserId(''); fetchRefData() }}>
                                    <UserPlus className="size-4 mr-2" /> Assign
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleAction(order, 'cancel')}>
                                    <Ban className="size-4 mr-2" /> Cancel
                                  </DropdownMenuItem>
                                </>
                              )}
                              {order.status === 'in_progress' && (
                                <>
                                  <DropdownMenuItem onClick={() => handleAction(order, 'complete')}>
                                    <CheckCircle2 className="size-4 mr-2" /> Complete
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleAction(order, 'cancel')}>
                                    <Ban className="size-4 mr-2" /> Cancel
                                  </DropdownMenuItem>
                                </>
                              )}
                              {order.status === 'completed' && (
                                <DropdownMenuItem onClick={() => { setCloseTarget(order); setCloseNotes(''); setCloseActualCost('') }}>
                                  <ArrowRightLeft className="size-4 mr-2" /> Close
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </motion.div>

            {/* Mobile Cards */}
            <motion.div {...fadeIn} transition={{ delay: 0.1 }} className="md:hidden space-y-3">
              {filteredOrders.map((order) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="border-0 shadow-sm overflow-hidden dark:border dark:border-slate-800">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate flex-1 mr-2">
                          {order.title}
                        </h3>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={!!actionLoading[order.id]}>
                              {actionLoading[order.id] ? <Loader2 className="size-3.5 animate-spin" /> : <MoreHorizontal className="size-3.5" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {order.status === 'pending' && (
                              <>
                                <DropdownMenuItem onClick={() => handleAction(order, 'approve')}><Check className="size-4 mr-2" /> Approve</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setRejectTarget(order); setRejectReason('') }}><XCircle className="size-4 mr-2" /> Reject</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleAction(order, 'cancel')}><Ban className="size-4 mr-2" /> Cancel</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEditForm(order)}><Edit3 className="size-4 mr-2" /> Edit</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleteTarget(order)}><Trash2 className="size-4 mr-2" /> Delete</DropdownMenuItem>
                              </>
                            )}
                            {order.status === 'approved' && (
                              <>
                                <DropdownMenuItem onClick={() => { setAssignTarget(order); setAssignUserId(''); fetchRefData() }}><UserPlus className="size-4 mr-2" /> Assign</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleAction(order, 'cancel')}><Ban className="size-4 mr-2" /> Cancel</DropdownMenuItem>
                              </>
                            )}
                            {order.status === 'in_progress' && (
                              <>
                                <DropdownMenuItem onClick={() => handleAction(order, 'complete')}><CheckCircle2 className="size-4 mr-2" /> Complete</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleAction(order, 'cancel')}><Ban className="size-4 mr-2" /> Cancel</DropdownMenuItem>
                              </>
                            )}
                            {order.status === 'completed' && (
                              <DropdownMenuItem onClick={() => { setCloseTarget(order); setCloseNotes(''); setCloseActualCost('') }}><ArrowRightLeft className="size-4 mr-2" /> Close</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge className={`text-[10px] ${priorityColor(order.priority)}`}>{priorityLabel(order.priority)}</Badge>
                        <Badge className={`text-[10px] ${statusColor(order.status)}`}>{statusLabel(order.status)}</Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {order.asset && (
                          <div>
                            <span className="text-slate-400">Asset:</span> {order.asset.name}
                          </div>
                        )}
                        <div>
                          <span className="text-slate-400">Assigned:</span>{' '}
                          {order.assignedTo?.name || <span className="italic">Unassigned</span>}
                        </div>
                        {order.dueDate && (
                          <div>
                            <span className="text-slate-400">Due:</span> {formatDate(order.dueDate)}
                          </div>
                        )}
                        <div>
                          <span className="text-slate-400">Requested:</span> {order.requestedBy?.name || '—'}
                        </div>
                      </div>

                      {/* Mobile action buttons */}
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {order.status === 'pending' && (
                          <>
                            <Button size="sm" className="h-7 text-xs bg-[#0f766e] hover:bg-[#0d6961] text-white" onClick={() => handleAction(order, 'approve')} disabled={!!actionLoading[order.id]}>
                              {actionLoading[order.id] === 'approve' ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Check className="size-3 mr-1" />} Approve
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setRejectTarget(order); setRejectReason('') }} disabled={!!actionLoading[order.id]}>
                              <XCircle className="size-3 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                        {order.status === 'approved' && (
                          <Button size="sm" className="h-7 text-xs bg-[#0f766e] hover:bg-[#0d6961] text-white" onClick={() => { setAssignTarget(order); setAssignUserId(''); fetchRefData() }} disabled={!!actionLoading[order.id]}>
                            <UserPlus className="size-3 mr-1" /> Assign
                          </Button>
                        )}
                        {order.status === 'in_progress' && (
                          <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleAction(order, 'complete')} disabled={!!actionLoading[order.id]}>
                            {actionLoading[order.id] === 'complete' ? <Loader2 className="size-3 mr-1 animate-spin" /> : <CheckCircle2 className="size-3 mr-1" />} Complete
                          </Button>
                        )}
                        {order.status === 'completed' && (
                          <Button size="sm" className="h-7 text-xs" variant="outline" onClick={() => { setCloseTarget(order); setCloseNotes(''); setCloseActualCost('') }}>
                            <ArrowRightLeft className="size-3 mr-1" /> Close
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM) } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {editingId ? 'Edit Work Order' : 'New Work Order'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update the details of this work order.'
                : 'Create a new work order for your team.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="wo-title">Title <span className="text-red-500">*</span></Label>
              <Input
                id="wo-title"
                placeholder="e.g., Fix leaking pipe in Building A"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wo-description">Description</Label>
              <Textarea
                id="wo-description"
                placeholder="Describe the work needed..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wo-due-date">Due Date</Label>
                <Input
                  id="wo-due-date"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                  className="h-9"
                />
              </div>
            </div>

            {/* Asset Searchable Select */}
            <div className="space-y-2">
              <Label>Asset</Label>
              <Popover>
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
                            onSelect={() => setForm((f) => ({ ...f, assetId: asset.id }))}
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
            </div>

            {/* Location Select */}
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={form.locationId} onValueChange={(v) => setForm((f) => ({ ...f, locationId: v }))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select location..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No location</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wo-cost">Estimated Cost (TTD)</Label>
              <Input
                id="wo-cost"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.estimatedCost}
                onChange={(e) => setForm((f) => ({ ...f, estimatedCost: e.target.value }))}
                className="h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM) }}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={formSubmitting || !form.title.trim()}
              className="bg-[#0f766e] hover:bg-[#0d6961] text-white"
            >
              {formSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
              {editingId ? 'Save Changes' : 'Create Work Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectReason('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Work Order</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting &ldquo;{rejectTarget?.title}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Reason</Label>
              <Textarea
                id="reject-reason"
                placeholder="Enter rejection reason..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason('') }} disabled={rejecting}>
              Cancel
            </Button>
            <Button onClick={handleReject} disabled={rejecting} className="bg-red-600 hover:bg-red-700 text-white">
              {rejecting && <Loader2 className="size-4 mr-2 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={!!assignTarget} onOpenChange={(open) => { if (!open) { setAssignTarget(null); setAssignUserId('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Work Order</DialogTitle>
            <DialogDescription>
              Assign &ldquo;{assignTarget?.title}&rdquo; to a team member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between h-9 font-normal"
                >
                  {assignUserId
                    ? users.find((u) => u.id === assignUserId)?.name || 'Select user...'
                    : 'Search users...'}
                  <Search className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command className="max-h-56">
                  <CommandInput placeholder="Search users..." />
                  <CommandList>
                    <CommandEmpty>No users found.</CommandEmpty>
                    <CommandGroup>
                      {users.map((user) => (
                        <CommandItem
                          key={user.id}
                          value={`${user.name} ${user.email}`}
                          onSelect={() => setAssignUserId(user.id)}
                        >
                          <Check className={`mr-2 size-4 ${assignUserId === user.id ? 'opacity-100' : 'opacity-0'}`} />
                          <div className="flex flex-col">
                            <span className="text-sm">{user.name}</span>
                            <span className="text-xs text-muted-foreground">{user.email}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAssignTarget(null); setAssignUserId('') }} disabled={assigning}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={assigning || !assignUserId} className="bg-[#0f766e] hover:bg-[#0d6961] text-white">
              {assigning && <Loader2 className="size-4 mr-2 animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Dialog */}
      <Dialog open={!!closeTarget} onOpenChange={(open) => { if (!open) { setCloseTarget(null); setCloseNotes(''); setCloseActualCost('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Close Work Order</DialogTitle>
            <DialogDescription>
              Close &ldquo;{closeTarget?.title}&rdquo; and record final details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="close-notes">Closing Notes</Label>
              <Textarea
                id="close-notes"
                placeholder="Summary of work performed..."
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="close-cost">Actual Cost (TTD)</Label>
              <Input
                id="close-cost"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={closeActualCost}
                onChange={(e) => setCloseActualCost(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCloseTarget(null); setCloseNotes(''); setCloseActualCost('') }} disabled={closing}>
              Cancel
            </Button>
            <Button onClick={handleClose} disabled={closing} className="bg-[#0f766e] hover:bg-[#0d6961] text-white">
              {closing && <Loader2 className="size-4 mr-2 animate-spin" />}
              Close Work Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Work Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.title}&rdquo;? This action cannot be undone.
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
