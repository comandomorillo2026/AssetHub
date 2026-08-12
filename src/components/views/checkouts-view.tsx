'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Plus,
  Search,
  Check,
  XCircle,
  Loader2,
  ArrowRightLeft,
  LogIn,
  CalendarDays,
  CheckCircle2,
  Ban,
  Undo2,
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

import { useAppStore, type Asset } from '@/lib/store'
import { checkoutsApi, reservationsApi, assetsApi, usersApi } from '@/lib/api'

/* Types */

interface CheckoutAsset {
  id: string
  name: string
  tagNumber: string
  serialNumber?: string
}

interface CheckoutUser {
  id: string
  name: string
  email: string
}

interface Checkout {
  id: string
  tenantId: string
  assetId: string
  asset: CheckoutAsset
  checkedOutToId: string
  checkedOutTo: CheckoutUser
  checkoutDate: string
  expectedReturnDate: string | null
  returnDate: string | null
  condition: string | null
  returnNotes: string | null
  status: 'active' | 'returned' | 'overdue'
  createdAt: string
  updatedAt: string
}

interface Reservation {
  id: string
  tenantId: string
  assetId: string
  asset: CheckoutAsset
  requestedById: string
  requestedBy: CheckoutUser
  startDate: string
  endDate: string
  purpose: string | null
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled' | 'completed' | 'cancelled'
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface CheckoutForm {
  assetId: string
  userId: string
  expectedReturnDate: string
  notes: string
}

interface ReservationForm {
  assetId: string
  userId: string
  purpose: string
  startDate: string
  endDate: string
  notes: string
}

/* Helpers */

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const EMPTY_CHECKOUT_FORM: CheckoutForm = {
  assetId: '',
  userId: '',
  expectedReturnDate: '',
  notes: '',
}

const EMPTY_RESERVATION_FORM: ReservationForm = {
  assetId: '',
  userId: '',
  purpose: '',
  startDate: '',
  endDate: '',
  notes: '',
}

function checkoutStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    case 'overdue': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    case 'returned': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
    default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
  }
}

function reservationStatusColor(status: string): string {
  switch (status) {
    case 'pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
    case 'approved': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    case 'rejected': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    case 'fulfilled': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    case 'completed': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
    case 'cancelled': return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
    default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
  }
}

function reservationStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

/* Animation */

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.25 },
}

/* Asset Search Combobox */

function AssetCombobox({ assets, value, onSelect }: { assets: Asset[]; value: string; onSelect: (id: string) => void }) {
  const selected = assets.find((a) => a.id === value)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between h-9 font-normal">
          {selected ? `${selected.name} (${selected.tagNumber})` : 'Search assets by name or tag...'}
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
                  value={`${asset.name} ${asset.tagNumber}`}
                  onSelect={() => onSelect(asset.id)}
                >
                  <Check className={`mr-2 size-4 ${value === asset.id ? 'opacity-100' : 'opacity-0'}`} />
                  <div className="flex flex-col">
                    <span className="text-sm">{asset.name}</span>
                    <span className="text-xs text-muted-foreground">{asset.tagNumber}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/* User Search Combobox */

function UserCombobox({ users, value, onSelect }: { users: CheckoutUser[]; value: string; onSelect: (id: string) => void }) {
  const selected = users.find((u) => u.id === value)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between h-9 font-normal">
          {selected ? selected.name : 'Search users...'}
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
                  onSelect={() => onSelect(user.id)}
                >
                  <Check className={`mr-2 size-4 ${value === user.id ? 'opacity-100' : 'opacity-0'}`} />
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
  )
}

/* Main Component */

export default function CheckoutsView() {
  const refreshKey = useAppStore((s) => s.refreshKey)
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)

  // Checkout data
  const [checkouts, setCheckouts] = useState<Checkout[]>([])
  const [checkoutsLoading, setCheckoutsLoading] = useState(true)
  const [checkoutsError, setCheckoutsError] = useState<string | null>(null)
  const [checkoutSearch, setCheckoutSearch] = useState('')

  // Reservation data
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [reservationsLoading, setReservationsLoading] = useState(true)
  const [reservationsError, setReservationsError] = useState<string | null>(null)
  const [reservationSearch, setReservationSearch] = useState('')

  // Reference data
  const [assets, setAssets] = useState<Asset[]>([])
  const [users, setUsers] = useState<CheckoutUser[]>([])

  // Checkout dialog
  const [showCheckoutForm, setShowCheckoutForm] = useState(false)
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>(EMPTY_CHECKOUT_FORM)
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false)

  // Return dialog
  const [returnTarget, setReturnTarget] = useState<Checkout | null>(null)
  const [returnCondition, setReturnCondition] = useState('good')
  const [returnNotes, setReturnNotes] = useState('')
  const [returning, setReturning] = useState(false)

  // Reservation dialog
  const [showReservationForm, setShowReservationForm] = useState(false)
  const [reservationForm, setReservationForm] = useState<ReservationForm>(EMPTY_RESERVATION_FORM)
  const [reservationSubmitting, setReservationSubmitting] = useState(false)

  // Action loading
  const [actionLoading, setActionLoading] = useState<Record<string, string | null>>({})

  /* Data fetching */

  const fetchCheckouts = useCallback(async () => {
    try {
      setCheckoutsLoading(true)
      setCheckoutsError(null)
      const res = await checkoutsApi.list({ limit: '200', status: 'active' })
      setCheckouts(res.data || [])
    } catch (err: unknown) {
      setCheckoutsError(err instanceof Error ? err.message : 'Failed to load checkouts')
    } finally {
      setCheckoutsLoading(false)
    }
  }, [])

  const fetchReservations = useCallback(async () => {
    try {
      setReservationsLoading(true)
      setReservationsError(null)
      const res = await reservationsApi.list({ limit: '200' })
      setReservations(res.data || [])
    } catch (err: unknown) {
      setReservationsError(err instanceof Error ? err.message : 'Failed to load reservations')
    } finally {
      setReservationsLoading(false)
    }
  }, [])

  const fetchRefData = useCallback(async () => {
    try {
      const [assetsRes, usersRes] = await Promise.allSettled([
        assetsApi.list({ limit: '200' }),
        usersApi.list({ limit: '200' }),
      ])
      if (assetsRes.status === 'fulfilled') setAssets(assetsRes.value.data || [])
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data || [])
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchCheckouts()
    fetchReservations()
  }, [fetchCheckouts, fetchReservations, refreshKey])

  useEffect(() => {
    if (showCheckoutForm || showReservationForm) {
      fetchRefData()
    }
  }, [showCheckoutForm, showReservationForm, fetchRefData])

  /* Computed */

  const filteredCheckouts = useMemo(() => {
    if (!checkoutSearch.trim()) return checkouts
    const q = checkoutSearch.toLowerCase()
    return checkouts.filter(
      (c) =>
        c.asset?.name?.toLowerCase().includes(q) ||
        c.checkedOutTo?.name?.toLowerCase().includes(q) ||
        c.asset?.tagNumber?.toLowerCase().includes(q)
    )
  }, [checkouts, checkoutSearch])

  const filteredReservations = useMemo(() => {
    if (!reservationSearch.trim()) return reservations
    const q = reservationSearch.toLowerCase()
    return reservations.filter(
      (r) =>
        r.asset?.name?.toLowerCase().includes(q) ||
        r.requestedBy?.name?.toLowerCase().includes(q) ||
        r.purpose?.toLowerCase().includes(q)
    )
  }, [reservations, reservationSearch])

  /* Handlers */

  const handleCreateCheckout = useCallback(async () => {
    if (!checkoutForm.assetId || !checkoutForm.userId) {
      toast.error('Please select an asset and a user.')
      return
    }
    try {
      setCheckoutSubmitting(true)
      await checkoutsApi.create({
        assetId: checkoutForm.assetId,
        checkedOutToId: checkoutForm.userId,
        expectedReturnDate: checkoutForm.expectedReturnDate || null,
        notes: checkoutForm.notes.trim() || null,
      })
      toast.success('Asset checked out successfully.')
      setShowCheckoutForm(false)
      setCheckoutForm(EMPTY_CHECKOUT_FORM)
      triggerRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to check out asset.')
    } finally {
      setCheckoutSubmitting(false)
    }
  }, [checkoutForm, triggerRefresh])

  const handleReturn = useCallback(async () => {
    if (!returnTarget) return
    try {
      setReturning(true)
      await checkoutsApi.return(returnTarget.id, {
        condition: returnCondition,
        notes: returnNotes.trim() || null,
      })
      toast.success('Asset returned successfully.')
      setReturnTarget(null)
      setReturnCondition('good')
      setReturnNotes('')
      triggerRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to return asset.')
    } finally {
      setReturning(false)
    }
  }, [returnTarget, returnCondition, returnNotes, triggerRefresh])

  const handleCreateReservation = useCallback(async () => {
    if (!reservationForm.assetId || !reservationForm.userId || !reservationForm.startDate || !reservationForm.endDate) {
      toast.error('Please fill in all required fields.')
      return
    }
    try {
      setReservationSubmitting(true)
      await reservationsApi.create({
        assetId: reservationForm.assetId,
        requestedById: reservationForm.userId,
        purpose: reservationForm.purpose.trim() || null,
        startDate: reservationForm.startDate,
        endDate: reservationForm.endDate,
        notes: reservationForm.notes.trim() || null,
      })
      toast.success('Reservation created successfully.')
      setShowReservationForm(false)
      setReservationForm(EMPTY_RESERVATION_FORM)
      triggerRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create reservation.')
    } finally {
      setReservationSubmitting(false)
    }
  }, [reservationForm, triggerRefresh])

  const handleReservationAction = useCallback(async (reservation: Reservation, action: string) => {
    try {
      setActionLoading((prev) => ({ ...prev, [reservation.id]: action }))
      switch (action) {
        case 'approve':
          await reservationsApi.approve(reservation.id)
          toast.success('Reservation approved.')
          break
        case 'reject':
          await reservationsApi.reject(reservation.id, { reason: 'Rejected' })
          toast.success('Reservation rejected.')
          break
        case 'cancel':
          await reservationsApi.cancel(reservation.id)
          toast.success('Reservation cancelled.')
          break
        case 'fulfill':
          await reservationsApi.fulfill(reservation.id)
          toast.success('Reservation fulfilled.')
          break
        case 'complete':
          await reservationsApi.complete(reservation.id)
          toast.success('Reservation completed.')
          break
      }
      triggerRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} reservation.`)
    } finally {
      setActionLoading((prev) => ({ ...prev, [reservation.id]: null }))
    }
  }, [triggerRefresh])

  /* Render */

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div
          className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          {...fadeIn}
        >
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Checkouts and Reservations</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage asset checkouts and reservations.</p>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="checkouts" className="space-y-6">
          <TabsList className="bg-slate-100 dark:bg-slate-800">
            <TabsTrigger value="checkouts" className="gap-2">
              <LogIn className="size-4" />
              Active Checkouts
              {checkouts.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{checkouts.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reservations" className="gap-2">
              <CalendarDays className="size-4" />
              Reservations
              {reservations.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{reservations.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Active Checkouts */}
          <TabsContent value="checkouts">
            <motion.div {...fadeIn}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search checkouts..."
                    value={checkoutSearch}
                    onChange={(e) => setCheckoutSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <Button onClick={() => { setCheckoutForm(EMPTY_CHECKOUT_FORM); setShowCheckoutForm(true) }} className="bg-[#0f766e] hover:bg-[#0d6961] text-white shrink-0">
                  <Plus className="size-4 mr-2" />
                  New Checkout
                </Button>
              </div>

              {checkoutsLoading ? (
                <Card className="border-0 shadow-sm dark:border dark:border-slate-800">
                  <CardContent className="p-6 space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-20 ml-auto" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : checkoutsError ? (
                <Card className="border-0 shadow-sm dark:border dark:border-slate-800">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <XCircle className="size-10 text-red-400 mb-3" />
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium">Failed to load checkouts</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{checkoutsError}</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={fetchCheckouts}>Try Again</Button>
                  </CardContent>
                </Card>
              ) : filteredCheckouts.length === 0 ? (
                <Card className="border-0 shadow-sm dark:border dark:border-slate-800">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="flex size-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                      <ArrowRightLeft className="size-8 text-slate-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200">No active checkouts</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-sm">
                      {checkouts.length === 0
                        ? 'No assets are currently checked out.'
                        : 'No checkouts match your search.'}
                    </p>
                    {checkouts.length === 0 && (
                      <Button onClick={() => { setCheckoutForm(EMPTY_CHECKOUT_FORM); setShowCheckoutForm(true) }} className="mt-4 bg-[#0f766e] hover:bg-[#0d6961] text-white">
                        <Plus className="size-4 mr-2" />
                        New Checkout
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Desktop */}
                  <div className="hidden md:block">
                    <Card className="border-0 shadow-sm overflow-hidden dark:border dark:border-slate-800">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 dark:bg-slate-900/50 dark:hover:bg-slate-900/50">
                            <TableHead className="font-semibold">Asset</TableHead>
                            <TableHead className="font-semibold">Checked Out To</TableHead>
                            <TableHead className="font-semibold">Checkout Date</TableHead>
                            <TableHead className="font-semibold">Expected Return</TableHead>
                            <TableHead className="font-semibold">Status</TableHead>
                            <TableHead className="font-semibold text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredCheckouts.map((checkout) => (
                            <TableRow key={checkout.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                                    {checkout.asset?.name || 'Unknown'}
                                  </span>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-800">
                                    {checkout.asset?.tagNumber || '-'}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                                {checkout.checkedOutTo?.name || '-'}
                              </TableCell>
                              <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                                {formatDate(checkout.checkoutDate)}
                              </TableCell>
                              <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                                {formatDate(checkout.expectedReturnDate)}
                              </TableCell>
                              <TableCell>
                                <Badge className={`text-xs ${checkoutStatusColor(checkout.status)}`}>
                                  {checkout.status.charAt(0).toUpperCase() + checkout.status.slice(1)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  className="bg-[#0f766e] hover:bg-[#0d6961] text-white h-8"
                                  onClick={() => { setReturnTarget(checkout); setReturnCondition('good'); setReturnNotes('') }}
                                >
                                  <Undo2 className="size-3.5 mr-1.5" />
                                  Return
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Card>
                  </div>

                  {/* Mobile */}
                  <div className="md:hidden space-y-3">
                    {filteredCheckouts.map((checkout) => (
                      <Card key={checkout.id} className="border-0 shadow-sm dark:border dark:border-slate-800">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{checkout.asset?.name || 'Unknown'}</h3>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-800">
                                {checkout.asset?.tagNumber || '-'}
                              </Badge>
                            </div>
                            <Badge className={`text-[10px] ${checkoutStatusColor(checkout.status)}`}>
                              {checkout.status.charAt(0).toUpperCase() + checkout.status.slice(1)}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 mb-3">
                            <div><span className="text-slate-400">Checked out to:</span> {checkout.checkedOutTo?.name}</div>
                            <div><span className="text-slate-400">Date:</span> {formatDate(checkout.checkoutDate)}</div>
                            {checkout.expectedReturnDate && (
                              <div><span className="text-slate-400">Expected return:</span> {formatDate(checkout.expectedReturnDate)}</div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            className="bg-[#0f766e] hover:bg-[#0d6961] text-white h-7 text-xs w-full"
                            onClick={() => { setReturnTarget(checkout); setReturnCondition('good'); setReturnNotes('') }}
                          >
                            <Undo2 className="size-3 mr-1" />
                            Return Asset
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </TabsContent>

          {/* Tab 2: Reservations */}
          <TabsContent value="reservations">
            <motion.div {...fadeIn}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search reservations..."
                    value={reservationSearch}
                    onChange={(e) => setReservationSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <Button onClick={() => { setReservationForm(EMPTY_RESERVATION_FORM); setShowReservationForm(true) }} className="bg-[#0f766e] hover:bg-[#0d6961] text-white shrink-0">
                  <Plus className="size-4 mr-2" />
                  New Reservation
                </Button>
              </div>

              {reservationsLoading ? (
                <Card className="border-0 shadow-sm dark:border dark:border-slate-800">
                  <CardContent className="p-6 space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-24 ml-auto" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : reservationsError ? (
                <Card className="border-0 shadow-sm dark:border dark:border-slate-800">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <XCircle className="size-10 text-red-400 mb-3" />
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium">Failed to load reservations</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{reservationsError}</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={fetchReservations}>Try Again</Button>
                  </CardContent>
                </Card>
              ) : filteredReservations.length === 0 ? (
                <Card className="border-0 shadow-sm dark:border dark:border-slate-800">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="flex size-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                      <CalendarDays className="size-8 text-slate-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200">No reservations</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-sm">
                      {reservations.length === 0
                        ? 'No reservations have been made yet.'
                        : 'No reservations match your search.'}
                    </p>
                    {reservations.length === 0 && (
                      <Button onClick={() => { setReservationForm(EMPTY_RESERVATION_FORM); setShowReservationForm(true) }} className="mt-4 bg-[#0f766e] hover:bg-[#0d6961] text-white">
                        <Plus className="size-4 mr-2" />
                        New Reservation
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Desktop */}
                  <div className="hidden md:block">
                    <Card className="border-0 shadow-sm overflow-hidden dark:border dark:border-slate-800">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 dark:bg-slate-900/50 dark:hover:bg-slate-900/50">
                            <TableHead className="font-semibold">Asset</TableHead>
                            <TableHead className="font-semibold">Requested By</TableHead>
                            <TableHead className="font-semibold">Start Date</TableHead>
                            <TableHead className="font-semibold">End Date</TableHead>
                            <TableHead className="font-semibold">Purpose</TableHead>
                            <TableHead className="font-semibold">Status</TableHead>
                            <TableHead className="font-semibold text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredReservations.map((res) => (
                            <TableRow key={res.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-slate-900 dark:text-white">{res.asset?.name || 'Unknown'}</span>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-800">
                                    {res.asset?.tagNumber || '-'}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-slate-600 dark:text-slate-300">{res.requestedBy?.name || '-'}</TableCell>
                              <TableCell className="text-sm text-slate-600 dark:text-slate-300">{formatDate(res.startDate)}</TableCell>
                              <TableCell className="text-sm text-slate-600 dark:text-slate-300">{formatDate(res.endDate)}</TableCell>
                              <TableCell className="text-sm text-slate-600 dark:text-slate-300 max-w-[200px] truncate">{res.purpose || '-'}</TableCell>
                              <TableCell>
                                <Badge className={`text-xs ${reservationStatusColor(res.status)}`}>
                                  {reservationStatusLabel(res.status)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center gap-1 justify-end">
                                  {res.status === 'pending' && (
                                    <>
                                      <ActionBtn label="Approve" icon={<Check className="size-3 mr-1" />} variant="teal" loading={actionLoading[res.id] === 'approve'} onClick={() => handleReservationAction(res, 'approve')} />
                                      <ActionBtn label="Reject" icon={<XCircle className="size-3 mr-1" />} variant="red" loading={actionLoading[res.id] === 'reject'} onClick={() => handleReservationAction(res, 'reject')} />
                                      <ActionBtn label="Cancel" icon={<Ban className="size-3 mr-1" />} loading={actionLoading[res.id] === 'cancel'} onClick={() => handleReservationAction(res, 'cancel')} />
                                    </>
                                  )}
                                  {res.status === 'approved' && (
                                    <>
                                      <ActionBtn label="Fulfill" icon={<CheckCircle2 className="size-3 mr-1" />} variant="teal" loading={actionLoading[res.id] === 'fulfill'} onClick={() => handleReservationAction(res, 'fulfill')} />
                                      <ActionBtn label="Cancel" icon={<Ban className="size-3 mr-1" />} loading={actionLoading[res.id] === 'cancel'} onClick={() => handleReservationAction(res, 'cancel')} />
                                    </>
                                  )}
                                  {res.status === 'fulfilled' && (
                                    <span className="text-xs text-slate-400 italic">Awaiting return</span>
                                  )}
                                  {res.status === 'completed' && (
                                    <span className="text-xs text-slate-400 italic">Done</span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Card>
                  </div>

                  {/* Mobile */}
                  <div className="md:hidden space-y-3">
                    {filteredReservations.map((res) => (
                      <Card key={res.id} className="border-0 shadow-sm dark:border dark:border-slate-800">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0 mr-2">
                              <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{res.asset?.name || 'Unknown'}</h3>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-800">
                                {res.asset?.tagNumber || '-'}
                              </Badge>
                            </div>
                            <Badge className={`text-[10px] shrink-0 ${reservationStatusColor(res.status)}`}>
                              {reservationStatusLabel(res.status)}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 mb-3">
                            <div><span className="text-slate-400">Requested by:</span> {res.requestedBy?.name}</div>
                            <div><span className="text-slate-400">Period:</span> {formatDate(res.startDate)} - {formatDate(res.endDate)}</div>
                            {res.purpose && (
                              <div className="col-span-2"><span className="text-slate-400">Purpose:</span> {res.purpose}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {res.status === 'pending' && (
                              <>
                                <ActionBtn label="Approve" icon={<Check className="size-3 mr-1" />} variant="teal" loading={actionLoading[res.id] === 'approve'} onClick={() => handleReservationAction(res, 'approve')} />
                                <ActionBtn label="Reject" icon={<XCircle className="size-3 mr-1" />} variant="red" loading={actionLoading[res.id] === 'reject'} onClick={() => handleReservationAction(res, 'reject')} />
                                <ActionBtn label="Cancel" icon={<Ban className="size-3 mr-1" />} loading={actionLoading[res.id] === 'cancel'} onClick={() => handleReservationAction(res, 'cancel')} />
                              </>
                            )}
                            {res.status === 'approved' && (
                              <>
                                <ActionBtn label="Fulfill" icon={<CheckCircle2 className="size-3 mr-1" />} variant="teal" loading={actionLoading[res.id] === 'fulfill'} onClick={() => handleReservationAction(res, 'fulfill')} />
                                <ActionBtn label="Cancel" icon={<Ban className="size-3 mr-1" />} loading={actionLoading[res.id] === 'cancel'} onClick={() => handleReservationAction(res, 'cancel')} />
                              </>
                            )}
                            {res.status === 'fulfilled' && (
                              <span className="text-xs text-slate-400 italic">Awaiting return</span>
                            )}
                            {res.status === 'completed' && (
                              <span className="text-xs text-slate-400 italic">Done</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>

        {/* New Checkout Dialog */}
        <Dialog open={showCheckoutForm} onOpenChange={(open) => { if (!open) { setShowCheckoutForm(false); setCheckoutForm(EMPTY_CHECKOUT_FORM) } }}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg">New Checkout</DialogTitle>
              <DialogDescription>Check out an asset to a user.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Asset <span className="text-red-500">*</span></Label>
                <AssetCombobox assets={assets} value={checkoutForm.assetId} onSelect={(id) => setCheckoutForm((f) => ({ ...f, assetId: id }))} />
              </div>
              <div className="space-y-2">
                <Label>User <span className="text-red-500">*</span></Label>
                <UserCombobox users={users} value={checkoutForm.userId} onSelect={(id) => setCheckoutForm((f) => ({ ...f, userId: id }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="co-expected-return">Expected Return Date</Label>
                <Input
                  id="co-expected-return"
                  type="date"
                  value={checkoutForm.expectedReturnDate}
                  onChange={(e) => setCheckoutForm((f) => ({ ...f, expectedReturnDate: e.target.value }))}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="co-notes">Notes</Label>
                <Textarea
                  id="co-notes"
                  placeholder="Additional notes..."
                  value={checkoutForm.notes}
                  onChange={(e) => setCheckoutForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowCheckoutForm(false); setCheckoutForm(EMPTY_CHECKOUT_FORM) }} disabled={checkoutSubmitting}>Cancel</Button>
              <Button onClick={handleCreateCheckout} disabled={checkoutSubmitting || !checkoutForm.assetId || !checkoutForm.userId} className="bg-[#0f766e] hover:bg-[#0d6961] text-white">
                {checkoutSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
                Check Out
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Return Dialog */}
        <Dialog open={!!returnTarget} onOpenChange={(open) => { if (!open) { setReturnTarget(null); setReturnCondition('good'); setReturnNotes('') } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Return Asset</DialogTitle>
              <DialogDescription>
                Return &quot;{returnTarget?.asset?.name}&quot; from {returnTarget?.checkedOutTo?.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Condition <span className="text-red-500">*</span></Label>
                <Select value={returnCondition} onValueChange={setReturnCondition}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                    <SelectItem value="damaged">Damaged</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="return-notes">Notes</Label>
                <Textarea
                  id="return-notes"
                  placeholder="Any notes about the return condition..."
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setReturnTarget(null); setReturnCondition('good'); setReturnNotes('') }} disabled={returning}>Cancel</Button>
              <Button onClick={handleReturn} disabled={returning} className="bg-[#0f766e] hover:bg-[#0d6961] text-white">
                {returning && <Loader2 className="size-4 mr-2 animate-spin" />}
                Return Asset
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New Reservation Dialog */}
        <Dialog open={showReservationForm} onOpenChange={(open) => { if (!open) { setShowReservationForm(false); setReservationForm(EMPTY_RESERVATION_FORM) } }}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg">New Reservation</DialogTitle>
              <DialogDescription>Reserve an asset for a future date.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Asset <span className="text-red-500">*</span></Label>
                <AssetCombobox assets={assets} value={reservationForm.assetId} onSelect={(id) => setReservationForm((f) => ({ ...f, assetId: id }))} />
              </div>
              <div className="space-y-2">
                <Label>User <span className="text-red-500">*</span></Label>
                <UserCombobox users={users} value={reservationForm.userId} onSelect={(id) => setReservationForm((f) => ({ ...f, userId: id }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="res-purpose">Purpose</Label>
                <Textarea
                  id="res-purpose"
                  placeholder="Describe the purpose of this reservation..."
                  value={reservationForm.purpose}
                  onChange={(e) => setReservationForm((f) => ({ ...f, purpose: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="res-start">Start Date <span className="text-red-500">*</span></Label>
                  <Input
                    id="res-start"
                    type="date"
                    value={reservationForm.startDate}
                    onChange={(e) => setReservationForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="res-end">End Date <span className="text-red-500">*</span></Label>
                  <Input
                    id="res-end"
                    type="date"
                    value={reservationForm.endDate}
                    onChange={(e) => setReservationForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="h-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="res-notes">Notes</Label>
                <Textarea
                  id="res-notes"
                  placeholder="Additional notes..."
                  value={reservationForm.notes}
                  onChange={(e) => setReservationForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowReservationForm(false); setReservationForm(EMPTY_RESERVATION_FORM) }} disabled={reservationSubmitting}>Cancel</Button>
              <Button
                onClick={handleCreateReservation}
                disabled={reservationSubmitting || !reservationForm.assetId || !reservationForm.userId || !reservationForm.startDate || !reservationForm.endDate}
                className="bg-[#0f766e] hover:bg-[#0d6961] text-white"
              >
                {reservationSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
                Create Reservation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

/* Action Button Helper */

function ActionBtn({ label, icon, variant, loading, onClick }: {
  label: string
  icon: React.ReactNode
  variant?: string
  loading?: boolean
  onClick: () => void
}) {
  const baseClass = 'h-8 text-xs'
  const variantClass = variant === 'teal'
    ? 'bg-[#0f766e] hover:bg-[#0d6961] text-white'
    : variant === 'red'
    ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
    : ''

  return (
    <Button
      size="sm"
      variant={variant === 'teal' ? 'default' : 'outline'}
      className={`${baseClass} ${variantClass}`}
      onClick={onClick}
      disabled={loading}
    >
      {loading ? <Loader2 className="size-3 mr-1 animate-spin" /> : icon}
      {label}
    </Button>
  )
}
