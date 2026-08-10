'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'framer-motion'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  ArrowLeft,
  PackageOpen,
  ChevronLeft,
  ChevronRight,
  QrCode,
  Tag,
  Building2,
  MapPin,
  DollarSign,
  Calendar,
  User,
  FileText,
  Shield,
  Activity,
  Clock,
  AlertTriangle,
} from 'lucide-react'

import { useAppStore, type Asset, type Category, type Location } from '@/lib/store'
import { assetsApi, categoriesApi, locationsApi } from '@/lib/api'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ─── Helpers ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  inactive: 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400',
  maintenance: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  disposed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  lost: 'bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-400',
  stolen: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}

const CONDITION_COLORS: Record<string, string> = {
  new: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  good: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  fair: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  poor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  broken: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}

function formatTTD(value: number | undefined | null): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-TT', {
    style: 'currency',
    currency: 'TTD',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatDate(date: string | undefined | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ─── Zod schema ───────────────────────────────────────────────────────────

const assetFormSchema = z.object({
  tagNumber: z.string().min(1, 'Tag number is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().default(''),
  serialNumber: z.string().optional().default(''),
  brand: z.string().optional().default(''),
  model: z.string().optional().default(''),
  purchaseDate: z.string().optional().default(''),
  purchasePrice: z.coerce.number().optional().default(undefined),
  currentValue: z.coerce.number().optional().default(undefined),
  warrantyExpiry: z.string().optional().default(''),
  status: z.string().optional().default('active'),
  condition: z.string().optional().default('new'),
  assignedTo: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  categoryId: z.string().optional().default(''),
  locationId: z.string().optional().default(''),
})

type AssetFormData = z.infer<typeof assetFormSchema>

// ─── Fade variant ─────────────────────────────────────────────────────────

const fadeVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
}

// ═══════════════════════════════════════════════════════════════════════════
// ASSETS LIST VIEW
// ═══════════════════════════════════════════════════════════════════════════

function AssetsListView() {
  const { navigate, setSelectedAssetId, refreshKey } = useAppStore()

  const [assets, setAssets] = useState<Asset[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCondition, setFilterCondition] = useState('')

  const [categories, setCategories] = useState<Category[]>([])
  const [locations, setLocations] = useState<Location[]>([])

  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null)
  const [deleting, setDeleting] = useState(false)

  // fetch categories & locations
  useEffect(() => {
    categoriesApi.list().then((d: Category[]) => setCategories(Array.isArray(d) ? d : [])).catch(() => {})
    locationsApi.list().then((d: Location[]) => setLocations(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  // fetch assets
  const fetchAssets = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(pageSize),
      }
      if (search) params.search = search
      if (filterCategory) params.categoryId = filterCategory
      if (filterLocation) params.locationId = filterLocation
      if (filterStatus) params.status = filterStatus
      if (filterCondition) params.condition = filterCondition

      const data = await assetsApi.list(params)
      setAssets(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [])
      setTotal(data?.total ?? data?.data?.length ?? 0)
    } catch {
      toast.error('Failed to load assets')
    } finally {
      setLoading(false)
    }
  }, [page, search, filterCategory, filterLocation, filterStatus, filterCondition, refreshKey])

  useEffect(() => { fetchAssets() }, [fetchAssets])

  // reset page on filter changes
  useEffect(() => { setPage(1) }, [search, filterCategory, filterLocation, filterStatus, filterCondition])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endIdx = Math.min(page * pageSize, total)

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await assetsApi.delete(deleteTarget.id)
      toast.success('Asset deleted successfully')
      setDeleteTarget(null)
      fetchAssets()
    } catch {
      toast.error('Failed to delete asset')
    } finally {
      setDeleting(false)
    }
  }

  const statusOptions = ['active', 'inactive', 'maintenance', 'disposed', 'lost', 'stolen']
  const conditionOptions = ['new', 'good', 'fair', 'poor', 'broken']

  return (
    <motion.div {...fadeVariants} transition={{ duration: 0.25 }} className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Assets</h1>
          <Badge variant="secondary" className="text-xs font-medium tabular-nums">
            {total}
          </Badge>
        </div>
        <Button
          onClick={() => navigate('add-asset')}
          className="bg-teal-600 text-white hover:bg-teal-700"
        >
          <Plus className="size-4" />
          Add Asset
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v === '_all' ? '' : v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterLocation} onValueChange={(v) => setFilterLocation(v === '_all' ? '' : v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Locations</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v === '_all' ? '' : v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Status</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>{capitalize(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterCondition} onValueChange={(v) => setFilterCondition(v === '_all' ? '' : v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Conditions</SelectItem>
                {conditionOptions.map((c) => (
                  <SelectItem key={c} value={c}>{capitalize(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[120px]">Tag #</TableHead>
                <TableHead className="min-w-[180px]">Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="hidden md:table-cell">Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Condition</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Value</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : assets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <PackageOpen className="size-10" />
                      <p className="text-sm font-medium">No assets found</p>
                      <p className="text-xs">Try adjusting your search or filters</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                assets.map((asset) => (
                  <TableRow key={asset.id} className="group">
                    <TableCell className="font-mono text-xs">{asset.tagNumber}</TableCell>
                    <TableCell>
                      <div className="font-medium">{asset.name}</div>
                      {asset.serialNumber && (
                        <div className="text-xs text-muted-foreground">SN: {asset.serialNumber}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {asset.category ? (
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: asset.category.color,
                            color: asset.category.color,
                            backgroundColor: `${asset.category.color}15`,
                          }}
                          className="text-xs"
                        >
                          {asset.category.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {asset.location?.name ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-xs font-medium ${STATUS_COLORS[asset.status] ?? ''}`}
                      >
                        {capitalize(asset.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge
                        variant="secondary"
                        className={`text-xs font-medium ${CONDITION_COLORS[asset.condition] ?? ''}`}
                      >
                        {capitalize(asset.condition)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right hidden sm:table-cell font-mono text-sm">
                      {formatTTD(asset.currentValue)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => {
                            setSelectedAssetId(asset.id)
                            navigate('asset-detail')
                          }}
                        >
                          <Eye className="size-4" />
                          <span className="sr-only">View</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => {
                            setSelectedAssetId(asset.id)
                            navigate('edit-asset')
                          }}
                        >
                          <Pencil className="size-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => setDeleteTarget(asset)}
                        >
                          <Trash2 className="size-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-medium">{startIdx}</span>-<span className="font-medium">{endIdx}</span> of{' '}
              <span className="font-medium">{total}</span>
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="size-4" />
                <span className="hidden sm:inline ml-1">Previous</span>
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    if (totalPages <= 7) return true
                    if (p === 1 || p === totalPages) return true
                    if (Math.abs(p - page) <= 1) return true
                    return false
                  })
                  .map((p, idx, arr) => {
                    const showEllipsis = idx > 0 && p - (arr[idx - 1] ?? 0) > 1
                    return (
                      <React.Fragment key={p}>
                        {showEllipsis && (
                          <span className="px-1 text-muted-foreground">...</span>
                        )}
                        <Button
                          variant={p === page ? 'default' : 'outline'}
                          size="sm"
                          className="size-8 p-0"
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </Button>
                      </React.Fragment>
                    )
                  })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <span className="hidden sm:inline mr-1">Next</span>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ASSET DETAIL VIEW
// ═══════════════════════════════════════════════════════════════════════════

function AssetDetailView() {
  const { selectedAssetId, goBack, navigate, setSelectedAssetId, triggerRefresh } = useAppStore()

  const [asset, setAsset] = useState<Asset | null>(null)
  const [loading, setLoading] = useState(true)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!selectedAssetId) return
    setLoading(true)
    assetsApi
      .get(selectedAssetId)
      .then((data: Asset) => {
        setAsset(data)
        if (data?.qrCode) {
          QRCode.toDataURL(data.qrCode, { width: 200, margin: 1 }).then(setQrDataUrl).catch(() => {})
        }
      })
      .catch(() => toast.error('Failed to load asset'))
      .finally(() => setLoading(false))
  }, [selectedAssetId])

  const handleDelete = async () => {
    if (!asset) return
    setDeleting(true)
    try {
      await assetsApi.delete(asset.id)
      toast.success('Asset deleted')
      triggerRefresh()
      goBack()
    } catch {
      toast.error('Failed to delete asset')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <motion.div {...fadeVariants} transition={{ duration: 0.25 }} className="flex flex-col gap-6">
        <Skeleton className="h-8 w-32" />
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="p-6 md:col-span-2"><Skeleton className="h-64 w-full" /></Card>
          <Card className="p-6"><Skeleton className="h-64 w-full" /></Card>
        </div>
      </motion.div>
    )
  }

  if (!asset) {
    return (
      <motion.div {...fadeVariants} transition={{ duration: 0.25 }} className="flex flex-col items-center justify-center gap-4 py-20">
        <PackageOpen className="size-12 text-muted-foreground" />
        <p className="text-muted-foreground">Asset not found</p>
        <Button variant="outline" onClick={goBack}><ArrowLeft className="size-4 mr-2" />Go Back</Button>
      </motion.div>
    )
  }

  const detailFields = [
    { icon: Tag, label: 'Tag Number', value: asset.tagNumber },
    { icon: Building2, label: 'Category', value: asset.category?.name ?? '—' },
    { icon: MapPin, label: 'Location', value: asset.location?.name ?? '—' },
    { icon: Activity, label: 'Status', value: capitalize(asset.status), badge: STATUS_COLORS[asset.status] },
    { icon: Shield, label: 'Condition', value: capitalize(asset.condition), badge: CONDITION_COLORS[asset.condition] },
    { icon: DollarSign, label: 'Purchase Price', value: formatTTD(asset.purchasePrice) },
    { icon: DollarSign, label: 'Current Value', value: formatTTD(asset.currentValue) },
    { icon: Calendar, label: 'Purchase Date', value: formatDate(asset.purchaseDate) },
    { icon: Calendar, label: 'Warranty Expiry', value: formatDate(asset.warrantyExpiry) },
    { icon: User, label: 'Assigned To', value: asset.assignedTo ?? '—' },
  ]

  const auditLogs = (asset as Asset & { auditLogs?: Array<{ id: string; action: string; details?: string; createdAt: string; user?: { name: string } }> }).auditLogs ?? []

  return (
    <motion.div {...fadeVariants} transition={{ duration: 0.25 }} className="flex flex-col gap-6">
      {/* Back + Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" size="sm" onClick={goBack}>
          <ArrowLeft className="size-4 mr-1" />
          Back to Assets
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate('edit-asset')}
          >
            <Pencil className="size-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Info Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="size-5 text-teal-600" />
              {asset.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {asset.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{asset.description}</p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {detailFields.map((field) => (
                <div key={field.label} className="flex items-start gap-3 rounded-lg border p-3">
                  <field.icon className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{field.label}</p>
                    {field.badge ? (
                      <Badge variant="secondary" className={`mt-0.5 text-xs font-medium ${field.badge}`}>
                        {field.value}
                      </Badge>
                    ) : (
                      <p className="text-sm font-medium break-words">{field.value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {(asset.serialNumber || asset.brand || asset.model) && (
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Hardware Details</p>
                <div className="grid gap-2 sm:grid-cols-3 text-sm">
                  {asset.serialNumber && (
                    <div><span className="text-muted-foreground">Serial: </span>{asset.serialNumber}</div>
                  )}
                  {asset.brand && (
                    <div><span className="text-muted-foreground">Brand: </span>{asset.brand}</div>
                  )}
                  {asset.model && (
                    <div><span className="text-muted-foreground">Model: </span>{asset.model}</div>
                  )}
                </div>
              </div>
            )}
            {asset.notes && (
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="size-4 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">Notes</p>
                </div>
                <p className="text-sm whitespace-pre-wrap">{asset.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* QR Code Card */}
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-6">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code" className="size-48 rounded-lg border p-2" />
            ) : (
              <div className="flex size-48 items-center justify-center rounded-lg border bg-muted">
                <QrCode className="size-12 text-muted-foreground" />
              </div>
            )}
            <p className="text-center text-sm font-medium">{asset.tagNumber}</p>
            <p className="text-center text-xs text-muted-foreground">Scan to view asset details</p>
          </CardContent>
        </Card>
      </div>

      {/* Audit Log Timeline */}
      {auditLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-5 text-muted-foreground" />
              Audit Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative space-y-0">
              {auditLogs.map((log, idx) => (
                <div key={log.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {/* Timeline line + dot */}
                  <div className="flex flex-col items-center">
                    <div className="size-3 rounded-full border-2 border-teal-500 bg-background z-10" />
                    {idx < auditLogs.length - 1 && (
                      <div className="w-px flex-1 bg-border" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 pt-[-4px]">
                    <p className="text-sm font-medium">{log.action}</p>
                    {log.details && (
                      <p className="text-xs text-muted-foreground mt-0.5">{log.details}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {log.user?.name ?? 'System'} &middot; {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{asset.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ADD / EDIT ASSET VIEW
// ═══════════════════════════════════════════════════════════════════════════

function AssetFormView({ mode }: { mode: 'add' | 'edit' }) {
  const { selectedAssetId, goBack, triggerRefresh } = useAppStore()
  const isEdit = mode === 'edit'

  const [categories, setCategories] = useState<Category[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [loadingData, setLoadingData] = useState(isEdit)

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<AssetFormData>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      tagNumber: '',
      name: '',
      description: '',
      serialNumber: '',
      brand: '',
      model: '',
      purchaseDate: '',
      purchasePrice: undefined,
      currentValue: undefined,
      warrantyExpiry: '',
      status: 'active',
      condition: 'new',
      assignedTo: '',
      notes: '',
      categoryId: '',
      locationId: '',
    },
  })

  // fetch dropdowns
  useEffect(() => {
    categoriesApi.list().then((d: Category[]) => setCategories(Array.isArray(d) ? d : [])).catch(() => {})
    locationsApi.list().then((d: Location[]) => setLocations(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  // load existing asset for edit
  useEffect(() => {
    if (!isEdit || !selectedAssetId) return
    setLoadingData(true)
    assetsApi
      .get(selectedAssetId)
      .then((data: Asset) => {
        reset({
          tagNumber: data.tagNumber ?? '',
          name: data.name ?? '',
          description: data.description ?? '',
          serialNumber: data.serialNumber ?? '',
          brand: data.brand ?? '',
          model: data.model ?? '',
          purchaseDate: data.purchaseDate ? data.purchaseDate.split('T')[0] : '',
          purchasePrice: data.purchasePrice,
          currentValue: data.currentValue,
          warrantyExpiry: data.warrantyExpiry ? data.warrantyExpiry.split('T')[0] : '',
          status: data.status ?? 'active',
          condition: data.condition ?? 'new',
          assignedTo: data.assignedTo ?? '',
          notes: data.notes ?? '',
          categoryId: data.categoryId ?? '',
          locationId: data.locationId ?? '',
        })
      })
      .catch(() => toast.error('Failed to load asset data'))
      .finally(() => setLoadingData(false))
  }, [isEdit, selectedAssetId, reset])

  const onSubmit = async (data: AssetFormData) => {
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        tagNumber: data.tagNumber,
        name: data.name,
        description: data.description || undefined,
        serialNumber: data.serialNumber || undefined,
        brand: data.brand || undefined,
        model: data.model || undefined,
        purchaseDate: data.purchaseDate || undefined,
        purchasePrice: data.purchasePrice || undefined,
        currentValue: data.currentValue || undefined,
        warrantyExpiry: data.warrantyExpiry || undefined,
        status: data.status,
        condition: data.condition,
        assignedTo: data.assignedTo || undefined,
        notes: data.notes || undefined,
        categoryId: data.categoryId || undefined,
        locationId: data.locationId || undefined,
      }

      if (isEdit && selectedAssetId) {
        await assetsApi.update(selectedAssetId, payload)
        toast.success('Asset updated successfully')
      } else {
        await assetsApi.create(payload)
        toast.success('Asset created successfully')
      }
      triggerRefresh()
      goBack()
    } catch (err) {
      toast.error(`Failed to ${isEdit ? 'update' : 'create'} asset`)
    } finally {
      setSubmitting(false)
    }
  }

  const statusValue = watch('status')
  const conditionValue = watch('condition')
  const categoryValue = watch('categoryId')
  const locationValue = watch('locationId')

  if (loadingData) {
    return (
      <motion.div {...fadeVariants} transition={{ duration: 0.25 }} className="flex flex-col gap-6">
        <Skeleton className="h-8 w-40" />
        <Card className="p-6"><Skeleton className="h-96 w-full" /></Card>
      </motion.div>
    )
  }

  return (
    <motion.div {...fadeVariants} transition={{ duration: 0.25 }} className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={goBack}>
          <ArrowLeft className="size-4 mr-1" />
          Back
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">
          {isEdit ? 'Edit Asset' : 'Add New Asset'}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardContent className="p-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Tag Number */}
              <div className="space-y-2">
                <Label htmlFor="tagNumber">
                  Tag Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="tagNumber"
                  placeholder="e.g. AST-001"
                  {...register('tagNumber')}
                  aria-invalid={!!errors.tagNumber}
                />
                {errors.tagNumber && (
                  <p className="text-xs text-red-500">{errors.tagNumber.message}</p>
                )}
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Asset name"
                  {...register('name')}
                  aria-invalid={!!errors.name}
                />
                {errors.name && (
                  <p className="text-xs text-red-500">{errors.name.message}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the asset"
                  rows={3}
                  {...register('description')}
                />
              </div>

              {/* Serial Number */}
              <div className="space-y-2">
                <Label htmlFor="serialNumber">Serial Number</Label>
                <Input
                  id="serialNumber"
                  placeholder="Serial number"
                  {...register('serialNumber')}
                />
              </div>

              {/* Brand */}
              <div className="space-y-2">
                <Label htmlFor="brand">Brand</Label>
                <Input
                  id="brand"
                  placeholder="Brand"
                  {...register('brand')}
                />
              </div>

              {/* Model */}
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  placeholder="Model"
                  {...register('model')}
                />
              </div>

              {/* Purchase Date */}
              <div className="space-y-2">
                <Label htmlFor="purchaseDate">Purchase Date</Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  {...register('purchaseDate')}
                />
              </div>

              {/* Purchase Price */}
              <div className="space-y-2">
                <Label htmlFor="purchasePrice">Purchase Price (TTD)</Label>
                <Input
                  id="purchasePrice"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register('purchasePrice')}
                />
              </div>

              {/* Current Value */}
              <div className="space-y-2">
                <Label htmlFor="currentValue">Current Value (TTD)</Label>
                <Input
                  id="currentValue"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register('currentValue')}
                />
              </div>

              {/* Warranty Expiry */}
              <div className="space-y-2">
                <Label htmlFor="warrantyExpiry">Warranty Expiry</Label>
                <Input
                  id="warrantyExpiry"
                  type="date"
                  {...register('warrantyExpiry')}
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={statusValue}
                  onValueChange={(v) => setValue('status', v, { shouldValidate: true })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {['active', 'inactive', 'maintenance', 'disposed', 'lost', 'stolen'].map((s) => (
                      <SelectItem key={s} value={s}>{capitalize(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Condition */}
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select
                  value={conditionValue}
                  onValueChange={(v) => setValue('condition', v, { shouldValidate: true })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    {['new', 'good', 'fair', 'poor', 'broken'].map((c) => (
                      <SelectItem key={c} value={c}>{capitalize(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={categoryValue}
                  onValueChange={(v) => setValue('categoryId', v, { shouldValidate: true })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label>Location</Label>
                <Select
                  value={locationValue}
                  onValueChange={(v) => setValue('locationId', v, { shouldValidate: true })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assigned To */}
              <div className="space-y-2">
                <Label htmlFor="assignedTo">Assigned To</Label>
                <Input
                  id="assignedTo"
                  placeholder="Person or department"
                  {...register('assignedTo')}
                />
              </div>

              {/* Notes */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes"
                  rows={3}
                  {...register('notes')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-teal-600 text-white hover:bg-teal-700"
            disabled={submitting}
          >
            {submitting
              ? (isEdit ? 'Saving...' : 'Creating...')
              : (isEdit ? 'Save Changes' : 'Create Asset')
            }
          </Button>
        </div>
      </form>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default function AssetsView() {
  const currentView = useAppStore((s) => s.currentView)

  return (
    <AnimatePresence mode="wait">
      {currentView === 'assets' && <AssetsListView key="assets" />}
      {currentView === 'asset-detail' && <AssetDetailView key="asset-detail" />}
      {currentView === 'add-asset' && <AssetFormView key="add-asset" mode="add" />}
      {currentView === 'edit-asset' && <AssetFormView key="edit-asset" mode="edit" />}
    </AnimatePresence>
  )
}
