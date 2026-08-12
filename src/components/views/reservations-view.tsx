'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Search,
  Check,
  XCircle,
  Loader2,
  CalendarRange,
  CheckCircle2,
  Ban,
  X,
  Filter,
  ArrowUpDown,
  Eye,
  Trash2,
  Clock,
  AlertTriangle,
  Send,
  PackageCheck,
  CalendarClock,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { reservationsApi, assetsApi, usersApi } from '@/lib/api'

/* ── Types ── */

interface ResAsset {
  id: string
  name: string
  tagNumber: string
  serialNumber?: string
  status: string
}

interface ResUser {
  id: string
  name: string
  email: string
}

interface Reservation {
  id: string
  tenantId: string
  assetId: string
  asset: ResAsset
  userId: string
  user: ResUser
  purpose: string | null
  startDate: string
  endDate: string
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled' | 'completed' | 'cancelled'
  approvedBy: string | null
  approvedByUser?: ResUser | null
  approvedAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface NewReservation {
  assetId: string
  userId: string
  startDate: string
  endDate: string
  purpose: string
  notes: string
}

/* ── Status Config ── */

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  pending:    { label: 'Pending',    variant: 'secondary', className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' },
  approved:   { label: 'Approved',   variant: 'default',  className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' },
  rejected:   { label: 'Rejected',   variant: 'destructive', className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' },
  fulfilled:  { label: 'Fulfilled',  variant: 'default',  className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' },
  completed:  { label: 'Completed',  variant: 'default',  className: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
  cancelled:  { label: 'Cancelled',  variant: 'outline',  className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700' },
}

/* ── Component ── */

export default function ReservationsView() {
  const refreshKey = useAppStore((s) => s.refreshKey)
  const user = useAppStore((s) => s.user)

  /* State */
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState('all')

  /* Form dialog */
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<NewReservation>({ assetId: '', userId: '', startDate: '', endDate: '', purpose: '', notes: '' })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  /* Detail dialog */
  const [detailRes, setDetailRes] = useState<Reservation | null>(null)

  /* Action dialog */
  const [actionDialog, setActionDialog] = useState<{ type: 'approve' | 'reject' | 'cancel' | 'fulfill' | 'complete'; reservation: Reservation } | null>(null)
  const [actionReason, setActionReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  /* Asset & user search */
  const [assets, setAssets] = useState<ResAsset[]>([])
  const [users, setUsers] = useState<ResUser[]>([])
  const [assetSearch, setAssetSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')

  const isAdmin = user?.role === 'admin' || user?.role === 'auditor'

  /* ── Data Fetching ── */

  const fetchReservations = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, string> = { limit: '200' }
      if (activeTab !== 'all') params.status = activeTab
      const data = await reservationsApi.list(params)
      setReservations(Array.isArray(data) ? data : data.reservations || data.data || [])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load reservations')
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  const fetchAssets = useCallback(async () => {
    try {
      const data = await assetsApi.list({ limit: '500', status: 'active' })
      const list = Array.isArray(data) ? data : data.assets || data.data || []
      setAssets(list.map((a: { id: string; name: string; tagNumber: string; serialNumber?: string; status?: string }) => ({
        id: a.id, name: a.name, tagNumber: a.tagNumber, serialNumber: a.serialNumber, status: a.status || 'active'
      })))
    } catch { /* ignore */ }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const data = await usersApi.list({ limit: '200' })
      const list = Array.isArray(data) ? data : data.users || data.data || []
      setUsers(list.map((u: { id: string; name: string; email: string }) => ({ id: u.id, name: u.name, email: u.email })))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchReservations() }, [fetchReservations, refreshKey])
  useEffect(() => { fetchAssets(); fetchUsers() }, [fetchAssets, fetchUsers])

  /* ── Filtering ── */

  const filtered = useMemo(() => {
    let result = reservations
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      result = result.filter((r) =>
        r.asset.name.toLowerCase().includes(q) ||
        r.asset.tagNumber.toLowerCase().includes(q) ||
        r.user.name.toLowerCase().includes(q) ||
        r.user.email.toLowerCase().includes(q) ||
        (r.purpose || '').toLowerCase().includes(q)
      )
    }
    return result
  }, [reservations, searchTerm])

  /* ── Stats ── */

  const stats = useMemo(() => {
    const pending = reservations.filter((r) => r.status === 'pending').length
    const approved = reservations.filter((r) => r.status === 'approved').length
    const active = reservations.filter((r) => ['pending', 'approved', 'fulfilled'].includes(r.status)).length
    const completed = reservations.filter((r) => r.status === 'completed').length
    const rejected = reservations.filter((r) => r.status === 'rejected').length
    return { pending, approved, active, completed, rejected, total: reservations.length }
  }, [reservations])

  /* ── Handlers ── */

  function resetForm() {
    setForm({ assetId: '', userId: '', startDate: '', endDate: '', purpose: '', notes: '' })
    setFormErrors({})
    setAssetSearch('')
    setUserSearch('')
  }

  function openCreate() {
    resetForm()
    setShowCreate(true)
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {}
    if (!form.assetId) errors.assetId = 'Select an asset'
    if (!form.userId) errors.userId = 'Select a user'
    if (!form.startDate) errors.startDate = 'Start date is required'
    if (!form.endDate) errors.endDate = 'End date is required'
    if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate)) {
      errors.endDate = 'End date must be after start date'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleCreate() {
    if (!validateForm()) return
    try {
      setSubmitting(true)
      await reservationsApi.create(form as unknown as Record<string, unknown>)
      toast.success('Reservation created successfully')
      setShowCreate(false)
      resetForm()
      fetchReservations()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create reservation')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAction() {
    if (!actionDialog) return
    const { type, reservation } = actionDialog
    try {
      setActionLoading(true)
      switch (type) {
        case 'approve':
          await reservationsApi.approve(reservation.id)
          toast.success('Reservation approved')
          break
        case 'reject':
          await reservationsApi.reject(reservation.id, { reason: actionReason })
          toast.success('Reservation rejected')
          break
        case 'cancel':
          await reservationsApi.cancel(reservation.id)
          toast.success('Reservation cancelled')
          break
        case 'fulfill':
          await reservationsApi.fulfill(reservation.id)
          toast.success('Reservation fulfilled — asset checked out')
          break
        case 'complete':
          await reservationsApi.complete(reservation.id)
          toast.success('Reservation completed')
          break
      }
      setActionDialog(null)
      setActionReason('')
      fetchReservations()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : `Failed to ${type} reservation`)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this reservation? This cannot be undone.')) return
    try {
      await reservationsApi.delete(id)
      toast.success('Reservation deleted')
      fetchReservations()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  /* ── Date Formatting ── */

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-TT', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function fmtDateTime(d: string) {
    return new Date(d).toLocaleString('en-TT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  /* ── Selected Asset/User from Combobox ── */

  const selectedAsset = assets.find((a) => a.id === form.assetId)
  const selectedUser = users.find((u) => u.id === form.userId)

  const filteredAssets = useMemo(() => {
    if (!assetSearch) return assets.slice(0, 30)
    const q = assetSearch.toLowerCase()
    return assets.filter((a) => a.name.toLowerCase().includes(q) || a.tagNumber.toLowerCase().includes(q)).slice(0, 30)
  }, [assets, assetSearch])

  const filteredUsers = useMemo(() => {
    if (!userSearch) return users.slice(0, 30)
    const q = userSearch.toLowerCase()
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)).slice(0, 30)
  }, [users, userSearch])

  /* ── Render ── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reservations</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage asset reservations and approval workflows</p>
        </div>
        <Button onClick={openCreate} className="bg-[#0f766e] hover:bg-[#0d6560] text-white shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          New Reservation
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Active', value: stats.active, icon: CalendarClock, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Approved', value: stats.approved, icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Completed', value: stats.completed, icon: Check, color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-50 dark:bg-slate-800/50' },
          { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
        ].map((s) => (
          <Card key={s.label} className="border-slate-200 dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${s.bg}`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-lg">All Reservations</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search assets, users, purpose..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64 h-9 text-sm"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
            <TabsList className="bg-slate-100 dark:bg-slate-800">
              <TabsTrigger value="all" className="text-xs">All ({stats.total})</TabsTrigger>
              <TabsTrigger value="pending" className="text-xs">Pending ({stats.pending})</TabsTrigger>
              <TabsTrigger value="approved" className="text-xs">Approved ({stats.approved})</TabsTrigger>
              <TabsTrigger value="fulfilled" className="text-xs">Fulfilled</TabsTrigger>
              <TabsTrigger value="completed" className="text-xs">Completed</TabsTrigger>
              <TabsTrigger value="cancelled" className="text-xs">Cancelled</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Table */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <CalendarRange className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">No reservations found</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                {searchTerm ? 'Try a different search term' : 'Create your first reservation to get started'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 dark:border-slate-700">
                    <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400">Asset</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400">Requested By</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400">Period</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400">Purpose</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {filtered.map((res, idx) => {
                      const sc = STATUS_CONFIG[res.status] || STATUS_CONFIG.pending
                      return (
                        <motion.tr
                          key={res.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ delay: idx * 0.03, duration: 0.2 }}
                          className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <TableCell className="py-3">
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{res.asset.name}</p>
                              <p className="text-xs text-slate-400">{res.asset.tagNumber}</p>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{res.user.name}</p>
                              <p className="text-xs text-slate-400">{res.user.email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="text-sm text-slate-700 dark:text-slate-300">
                              <p>{fmtDate(res.startDate)}</p>
                              <p className="text-xs text-slate-400">to {fmtDate(res.endDate)}</p>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <p className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
                              {res.purpose || '—'}
                            </p>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge variant={sc.variant} className={`text-xs ${sc.className}`}>
                              {sc.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                onClick={() => setDetailRes(res)}
                                title="View details"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {isAdmin && res.status === 'pending' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                    onClick={() => setActionDialog({ type: 'approve', reservation: res })}
                                    title="Approve"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => setActionDialog({ type: 'reject', reservation: res })}
                                    title="Reject"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                              {isAdmin && res.status === 'approved' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                  onClick={() => setActionDialog({ type: 'fulfill', reservation: res })}
                                  title="Fulfill (check out asset)"
                                >
                                  <Send className="w-4 h-4" />
                                </Button>
                              )}
                              {isAdmin && res.status === 'fulfilled' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  onClick={() => setActionDialog({ type: 'complete', reservation: res })}
                                  title="Complete"
                                >
                                  <PackageCheck className="w-4 h-4" />
                                </Button>
                              )}
                              {(res.status === 'pending' || res.status === 'approved') && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                  onClick={() => setActionDialog({ type: 'cancel', reservation: res })}
                                  title="Cancel"
                                >
                                  <Ban className="w-4 h-4" />
                                </Button>
                              )}
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  onClick={() => handleDelete(res.id)}
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </motion.tr>
                      )
                    })}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Create Dialog ── */}
      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) resetForm() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Reservation</DialogTitle>
            <DialogDescription>Reserve an asset for a specific time period. Admins will need to approve pending reservations.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Asset Combobox */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Asset *</Label>
              <Popover open={!!assetSearch || (!selectedAsset && !assetSearch)} onOpenChange={(open) => { if (!open) setAssetSearch('') }}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between text-sm h-10 font-normal">
                    {selectedAsset ? `${selectedAsset.name} (${selectedAsset.tagNumber})` : 'Select asset...'}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search assets by name or tag..." value={assetSearch} onValueChange={setAssetSearch} />
                    <CommandList>
                      <CommandEmpty>No asset found.</CommandEmpty>
                      <CommandGroup>
                        {filteredAssets.map((a) => (
                          <CommandItem
                            key={a.id}
                            value={`${a.name} ${a.tagNumber}`}
                            onSelect={() => { setForm((f) => ({ ...f, assetId: a.id })); setAssetSearch('') }}
                          >
                            <Check className={form.assetId === a.id ? 'opacity-100 mr-2' : 'opacity-0 mr-2'} />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{a.name}</span>
                              <span className="text-xs text-slate-400">{a.tagNumber}{a.serialNumber ? ` | S/N: ${a.serialNumber}` : ''}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {formErrors.assetId && <p className="text-xs text-red-500">{formErrors.assetId}</p>}
            </div>

            {/* User Combobox */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Request For (User) *</Label>
              <Popover open={!!userSearch || (!selectedUser && !userSearch)} onOpenChange={(open) => { if (!open) setUserSearch('') }}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between text-sm h-10 font-normal">
                    {selectedUser ? `${selectedUser.name} (${selectedUser.email})` : 'Select user...'}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search users by name or email..." value={userSearch} onValueChange={setUserSearch} />
                    <CommandList>
                      <CommandEmpty>No user found.</CommandEmpty>
                      <CommandGroup>
                        {filteredUsers.map((u) => (
                          <CommandItem
                            key={u.id}
                            value={`${u.name} ${u.email}`}
                            onSelect={() => { setForm((f) => ({ ...f, userId: u.id })); setUserSearch('') }}
                          >
                            <Check className={form.userId === u.id ? 'opacity-100 mr-2' : 'opacity-0 mr-2'} />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{u.name}</span>
                              <span className="text-xs text-slate-400">{u.email}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {formErrors.userId && <p className="text-xs text-red-500">{formErrors.userId}</p>}
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Start Date *</Label>
                <Input
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="text-sm"
                />
                {formErrors.startDate && <p className="text-xs text-red-500">{formErrors.startDate}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">End Date *</Label>
                <Input
                  type="datetime-local"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="text-sm"
                />
                {formErrors.endDate && <p className="text-xs text-red-500">{formErrors.endDate}</p>}
              </div>
            </div>

            {/* Purpose */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Purpose</Label>
              <Input
                placeholder="e.g., Field survey at Site B"
                value={form.purpose}
                onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                className="text-sm"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Notes</Label>
              <Textarea
                placeholder="Additional notes (optional)"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="text-sm min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); resetForm() }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting} className="bg-[#0f766e] hover:bg-[#0d6560] text-white">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create Reservation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ── */}
      <Dialog open={!!detailRes} onOpenChange={(open) => { if (!open) setDetailRes(null) }}>
        <DialogContent className="max-w-lg">
          {detailRes && (
            <>
              <DialogHeader>
                <DialogTitle>Reservation Details</DialogTitle>
                <DialogDescription>Full details and history for this reservation.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">Asset</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{detailRes.asset.name}</p>
                    <p className="text-xs text-slate-500">{detailRes.asset.tagNumber}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">Requested By</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{detailRes.user.name}</p>
                    <p className="text-xs text-slate-500">{detailRes.user.email}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">Start Date</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{fmtDateTime(detailRes.startDate)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">End Date</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{fmtDateTime(detailRes.endDate)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">Status</p>
                    <Badge variant={STATUS_CONFIG[detailRes.status]?.variant || 'secondary'} className={STATUS_CONFIG[detailRes.status]?.className || ''}>
                      {STATUS_CONFIG[detailRes.status]?.label || detailRes.status}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">Created</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{fmtDateTime(detailRes.createdAt)}</p>
                  </div>
                </div>
                {detailRes.purpose && (
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">Purpose</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{detailRes.purpose}</p>
                  </div>
                )}
                {detailRes.notes && (
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">Notes</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{detailRes.notes}</p>
                  </div>
                )}
                {detailRes.approvedByUser && (
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">Approved By</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{detailRes.approvedByUser.name} {detailRes.approvedAt ? `at ${fmtDateTime(detailRes.approvedAt)}` : ''}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Action Confirmation Dialog ── */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => { if (!open) { setActionDialog(null); setActionReason('') } }}>
        <DialogContent className="max-w-sm">
          {actionDialog && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {actionDialog.type === 'approve' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                  {actionDialog.type === 'reject' && <XCircle className="w-5 h-5 text-red-500" />}
                  {actionDialog.type === 'cancel' && <Ban className="w-5 h-5 text-amber-500" />}
                  {actionDialog.type === 'fulfill' && <Send className="w-5 h-5 text-blue-500" />}
                  {actionDialog.type === 'complete' && <PackageCheck className="w-5 h-5 text-slate-500" />}
                  <span className="capitalize">{actionDialog.type} Reservation</span>
                </DialogTitle>
                <DialogDescription>
                  {actionDialog.type === 'approve' && `Approve reservation for "${actionDialog.reservation.asset.name}" requested by ${actionDialog.reservation.user.name}?`}
                  {actionDialog.type === 'reject' && `Reject this reservation? A reason is recommended.`}
                  {actionDialog.type === 'cancel' && `Cancel this reservation for "${actionDialog.reservation.asset.name}"?`}
                  {actionDialog.type === 'fulfill' && `Fulfill this reservation? This will check out the asset to ${actionDialog.reservation.user.name}.`}
                  {actionDialog.type === 'complete' && `Mark this reservation as completed? The asset should have been returned.`}
                </DialogDescription>
              </DialogHeader>

              {actionDialog.type === 'reject' && (
                <div className="space-y-2 py-2">
                  <Label className="text-sm font-medium">Reason</Label>
                  <Textarea
                    placeholder="Reason for rejection (optional but recommended)"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    className="text-sm min-h-[80px]"
                  />
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => { setActionDialog(null); setActionReason('') }}>Cancel</Button>
                <Button
                  onClick={handleAction}
                  disabled={actionLoading}
                  className={
                    actionDialog.type === 'reject' || actionDialog.type === 'cancel'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-[#0f766e] hover:bg-[#0d6560] text-white'
                  }
                >
                  {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {actionDialog.type === 'approve' && 'Approve'}
                  {actionDialog.type === 'reject' && 'Reject'}
                  {actionDialog.type === 'cancel' && 'Cancel Reservation'}
                  {actionDialog.type === 'fulfill' && 'Fulfill'}
                  {actionDialog.type === 'complete' && 'Complete'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
