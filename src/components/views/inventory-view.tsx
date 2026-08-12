'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Html5Qrcode } from 'html5-qrcode'
import {
  ScanLine,
  Zap,
  ZapOff,
  ArrowLeft,
  Plus,
  PackageSearch,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CircleDot,
  MapPin,
  Clock,
  User,
  ListChecks,
  Play,
  CheckCheck,
  Ban,
  Search,
  ChevronRight,
  ClipboardList,
  QrCode,
  Eye,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

import { useAppStore, type InventorySession, type InventoryItem, type Asset } from '@/lib/store'
import { inventoryApi, qrApi } from '@/lib/api'

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

const SCANNER_ID = 'zeitgeist-qr-scanner'

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

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  if (weeks < 5) return `${weeks}w ago`
  return `${months}mo ago`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'in_progress': return 'default'
    case 'completed': return 'secondary'
    case 'cancelled': return 'destructive'
    default: return 'outline'
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'in_progress': return 'In Progress'
    case 'completed': return 'Completed'
    case 'cancelled': return 'Cancelled'
    default: return status
  }
}

function conditionColor(condition: string): string {
  switch (condition) {
    case 'new': return 'text-emerald-600'
    case 'good': return 'text-teal-600'
    case 'fair': return 'text-amber-600'
    case 'poor': return 'text-orange-600'
    case 'broken': return 'text-red-600'
    default: return 'text-muted-foreground'
  }
}

function assetStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'bg-emerald-100 text-emerald-700'
    case 'inactive': return 'bg-slate-100 text-slate-700'
    case 'maintenance': return 'bg-amber-100 text-amber-700'
    case 'disposed': return 'bg-red-100 text-red-700'
    default: return 'bg-slate-100 text-slate-700'
  }
}

/* ──────────────────────────────────────────────
   Fade-in animation variant
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
   SCAN VIEW
   ────────────────────────────────────────────── */

interface ScanResult {
  qrCode: string
  asset: Asset | null
  timestamp: number
}

function ScanView() {
  const { navigate } = useAppStore()
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannerDivRef = useRef<HTMLDivElement>(null)
  const [flashOn, setFlashOn] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [scanning, setScanning] = useState(true)
  const [recentScans, setRecentScans] = useState<ScanResult[]>([])
  const [scannedAsset, setScannedAsset] = useState<Asset | null>(null)
  const [showAssetCard, setShowAssetCard] = useState(false)
  const [activeSession, setActiveSession] = useState<InventorySession | null>(null)
  const [scanCount, setScanCount] = useState(0)
  const [processing, setProcessing] = useState(false)

  // Check for active inventory session
  useEffect(() => {
    let cancelled = false
    async function checkSession() {
      try {
        const data = await inventoryApi.list({ status: 'in_progress' })
        if (cancelled) return
        const sessions: InventorySession[] = data?.data || data || []
        if (sessions.length > 0) {
          setActiveSession(sessions[0])
          setScanCount(sessions[0].totalScanned || 0)
        }
      } catch (_e) {
        // no active session
      }
    }
    checkSession()
    return () => { cancelled = true }
  }, [])

  // Initialize scanner
  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ID)
    scannerRef.current = scanner

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          if (processing) return
          setProcessing(true)
          try {
            await scanner.pause(true)
            setScanning(false)
            await handleScanResult(decodedText)
          } finally {
            setTimeout(async () => {
              try {
                await scanner.resume()
                setScanning(true)
              } catch (_e) {
                // ignore resume errors
              }
              setProcessing(false)
            }, 2000)
          }
        },
        () => {}
      )
      .catch(() => {
        // camera not available, that's ok
      })

    return () => {
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => {})
    }
  }, [])

  // Toggle flash
  const toggleFlash = useCallback(async () => {
    if (!scannerRef.current) return
    try {
      const track = (scannerRef.current as unknown as { _renderedCamera?: { getVideoTrack?: () => MediaStreamTrack } })._renderedCamera?.getVideoTrack?.()
      if (track) {
        const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined
        if (capabilities?.torch) {
          await track.applyConstraints({ advanced: [{ torch: !flashOn }] } as unknown as MediaTrackConstraints)
          setFlashOn(!flashOn)
        }
      }
    } catch (_e) {
      toast.error('Flash not supported on this device')
    }
  }, [flashOn])

  // Handle scan result
  const handleScanResult = useCallback(async (code: string) => {
    try {
      const data = await qrApi.resolve(code)
      const asset: Asset = data?.asset || data
      if (asset && asset.id) {
        setScannedAsset(asset)
        setShowAssetCard(true)
        toast.success('Asset found!')

        // Auto-submit to active inventory session
        if (activeSession) {
          try {
            await inventoryApi.scan(activeSession.id, code)
            setScanCount((prev) => prev + 1)
          } catch (_e) {
            // silently fail for inventory scan
          }
        }
      } else {
        toast.error('Asset not registered')
      }

      // Add to recent scans
      setRecentScans((prev) => {
        const entry: ScanResult = {
          qrCode: code,
          asset: asset?.id ? asset : null,
          timestamp: Date.now(),
        }
        return [entry, ...prev].slice(0, 5)
      })
    } catch (_e) {
      toast.error('Asset not registered')
      setRecentScans((prev) => {
        const entry: ScanResult = { qrCode: code, asset: null, timestamp: Date.now() }
        return [entry, ...prev].slice(0, 5)
      })
    }
  }, [activeSession])

  // Manual submit
  const handleManualSubmit = useCallback(async () => {
    const code = manualCode.trim()
    if (!code) return
    setManualCode('')
    setProcessing(true)
    try {
      if (scannerRef.current) {
        await scannerRef.current.pause(true)
        setScanning(false)
      }
      await handleScanResult(code)
    } finally {
      setTimeout(async () => {
        try {
          if (scannerRef.current) await scannerRef.current.resume()
          setScanning(true)
        } catch (_e) {}
        setProcessing(false)
      }, 2000)
    }
  }, [manualCode, handleScanResult])

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 max-w-2xl mx-auto w-full">
      {/* Header */}
      <motion.div {...fadeIn} className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">QR Scanner</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleFlash}
          className="gap-1.5"
        >
          {flashOn ? <ZapOff className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
          {flashOn ? 'Flash Off' : 'Flash'}
        </Button>
      </motion.div>

      {/* Camera Viewfinder */}
      <motion.div {...fadeIn} className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
        <div id={SCANNER_ID} className="w-full h-full" />
        {/* Scanning line animation overlay */}
        {scanning && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative w-[250px] h-[250px]">
              {/* Corner brackets */}
              <span className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-lg" />
              <span className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-lg" />
              <span className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-lg" />
              <span className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-lg" />
              {/* Scanning line */}
              <motion.div
                className="absolute left-1 right-1 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent"
                initial={{ top: '0%' }}
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          </div>
        )}
        {/* Not scanning indicator */}
        {!scanning && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-white">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              <span className="text-sm font-medium">Scan captured</span>
            </div>
          </div>
        )}
      </motion.div>

      {/* Active session indicator */}
      {activeSession && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{activeSession.name}</span>
          </div>
          <Badge variant="default" className="font-mono">
            {scanCount} / {activeSession.totalExpected} expected
          </Badge>
        </motion.div>
      )}

      {/* Start session button if no active session */}
      {!activeSession && (
        <motion.div {...fadeIn}>
          <Button
            className="w-full gap-2"
            variant="outline"
            onClick={() => navigate('inventory')}
          >
            <Play className="h-4 w-4" />
            Start Inventory Session
          </Button>
        </motion.div>
      )}

      {/* Manual input */}
      <motion.div {...fadeIn} className="flex gap-2">
        <Input
          placeholder="Enter QR code manually..."
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
          className="flex-1"
        />
        <Button onClick={handleManualSubmit} disabled={!manualCode.trim() || processing}>
          <Search className="h-4 w-4 mr-1.5" />
          Lookup
        </Button>
      </motion.div>

      {/* Scanned Asset Card (Popup) */}
      <AnimatePresence>
        {showAssetCard && scannedAsset && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    {scannedAsset.name}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setShowAssetCard(false)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription>Asset scanned successfully</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-1.5">
                    <QrCode className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Tag:</span>
                    <span className="font-medium">{scannedAsset.tagNumber}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CircleDot className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant="secondary" className={assetStatusColor(scannedAsset.status)}>
                      {scannedAsset.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-medium">
                      {scannedAsset.location?.name || 'Unassigned'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Condition:</span>
                    <span className={`font-medium ${conditionColor(scannedAsset.condition)}`}>
                      {scannedAsset.condition}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Scans */}
      {recentScans.length > 0 && (
        <motion.div {...fadeIn}>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Recent Scans
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {recentScans.map((scan, idx) => (
              <motion.div
                key={`${scan.qrCode}-${scan.timestamp}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 border text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {scan.asset ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                  )}
                  <span className="font-mono text-xs truncate">
                    {scan.qrCode}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {scan.asset?.name || 'Unknown'}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────
   INVENTORY LIST VIEW
   ────────────────────────────────────────────── */

type SessionStatusFilter = 'all' | 'in_progress' | 'completed' | 'cancelled'

function InventoryListView() {
  const { navigate, setSelectedInventoryId } = useAppStore()
  const [sessions, setSessions] = useState<InventorySession[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<SessionStatusFilter>('all')

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const data = await inventoryApi.list()
      const list: InventorySession[] = data?.data || data || []
      setSessions(list)
    } catch (_e) {
      toast.error('Failed to load inventory sessions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const filteredSessions = sessions.filter((s) => {
    if (filter === 'all') return true
    return s.status === filter
  })

  const openSession = (session: InventorySession) => {
    setSelectedInventoryId(session.id)
    navigate('inventory-detail')
  }

  const filters: { label: string; value: SessionStatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled' },
  ]

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 max-w-4xl mx-auto w-full">
      {/* Header */}
      <motion.div
        {...fadeIn}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Inventory Sessions
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage and track your asset inventory audits
          </p>
        </div>
        <Button className="gap-1.5 shrink-0" onClick={() => navigate('scan')}>
          <Plus className="h-4 w-4" />
          New Session
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div {...fadeIn} className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </motion.div>

      {/* Loading skeletons */}
      {loading && (
        <motion.div
          {...staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-3"
        >
          {[1, 2, 3].map((i) => (
            <motion.div key={i} {...fadeIn}>
              <Skeleton className="h-32 w-full rounded-lg" />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Empty state */}
      {!loading && filteredSessions.length === 0 && (
        <motion.div
          {...fadeIn}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <PackageSearch className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <h3 className="text-base font-medium text-muted-foreground">No sessions found</h3>
          <p className="text-sm text-muted-foreground/70 mt-1">
            {filter === 'all'
              ? 'Create your first inventory session to get started.'
              : `No ${statusLabel(filter).toLowerCase()} sessions.`}
          </p>
        </motion.div>
      )}

      {/* Session Cards */}
      {!loading && filteredSessions.length > 0 && (
        <motion.div
          {...staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-3"
        >
          {filteredSessions.map((session) => {
            const progressPct =
              session.totalExpected > 0
                ? Math.round((session.totalScanned / session.totalExpected) * 100)
                : 0
            return (
              <motion.div key={session.id} {...fadeIn}>
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => openSession(session)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm truncate">
                          {session.name}
                        </h3>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          {session.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {session.location.name}
                            </span>
                          )}
                          {session.user && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {session.user.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <Badge variant={statusVariant(session.status)}>
                          {statusLabel(session.status)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {relativeTime(session.startedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Progress
                        </span>
                        <span className="font-medium">
                          {session.totalScanned} / {session.totalExpected}
                        </span>
                      </div>
                      <Progress value={progressPct} className="h-2" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{progressPct}%</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────
   INVENTORY DETAIL VIEW
   ────────────────────────────────────────────── */

function InventoryDetailView() {
  const { selectedInventoryId, goBack, navigate } = useAppStore()
  const [session, setSession] = useState<InventorySession | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)

  const fetchSession = useCallback(async () => {
    if (!selectedInventoryId) return
    setLoading(true)
    try {
      const data = await inventoryApi.get(selectedInventoryId)
      const s: InventorySession = data?.data || data
      setSession(s)
    } catch (_e) {
      toast.error('Failed to load session details')
    } finally {
      setLoading(false)
    }
  }, [selectedInventoryId])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  const handleComplete = async () => {
    if (!selectedInventoryId) return
    setCompleting(true)
    try {
      await inventoryApi.complete(selectedInventoryId)
      toast.success('Session completed successfully')
      setShowCompleteDialog(false)
      fetchSession()
    } catch (_e) {
      toast.error('Failed to complete session')
    } finally {
      setCompleting(false)
    }
  }

  const isCompleted = session?.status === 'completed'
  const isInProgress = session?.status === 'in_progress'
  const items: InventoryItem[] = session?.items || []
  const matchedCount = items.filter((i) => !i.discrepancyType).length
  const discrepancyCount = items.filter((i) => i.discrepancyType).length
  const matchRate =
    items.length > 0 ? Math.round((matchedCount / items.length) * 100) : 0
  const missingCount = items.filter((i) => i.discrepancyType === 'missing').length
  const extraCount = items.filter((i) => i.discrepancyType === 'extra').length

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6 max-w-5xl mx-auto w-full">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <PackageSearch className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <h3 className="text-base font-medium text-muted-foreground">Session not found</h3>
        <Button variant="outline" className="mt-4" onClick={goBack}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <motion.div
        {...fadeIn}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{session.name}</h2>
              <Badge variant={statusVariant(session.status)}>
                {statusLabel(session.status)}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {session.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {session.location.name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Started {formatDate(session.startedAt)}
              </span>
              {session.user && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {session.user.name}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button variant="outline" className="gap-1.5" onClick={() => navigate('scan')}>
            <ScanLine className="h-4 w-4" />
            Scan
          </Button>
          {isInProgress && (
            <Button
              className="gap-1.5"
              onClick={() => setShowCompleteDialog(true)}
            >
              <CheckCheck className="h-4 w-4" />
              Complete Session
            </Button>
          )}
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        {...staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 sm:grid-cols-5 gap-3"
      >
        {[
          {
            label: 'Expected',
            value: session.totalExpected,
            icon: ListChecks,
            color: 'text-slate-600',
            bg: 'bg-slate-50',
          },
          {
            label: 'Scanned',
            value: session.totalScanned,
            icon: ScanLine,
            color: 'text-primary',
            bg: 'bg-primary/10',
          },
          {
            label: 'Matched',
            value: matchedCount,
            icon: CheckCircle2,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
          },
          {
            label: 'Missing',
            value: session.totalMissing,
            icon: AlertTriangle,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
          },
          {
            label: 'Extra',
            value: session.totalExtra,
            icon: XCircle,
            color: 'text-red-600',
            bg: 'bg-red-50',
          },
        ].map((stat) => (
          <motion.div key={stat.label} {...fadeIn}>
            <Card className={`${stat.bg} border-0`}>
              <CardContent className="p-3 sm:p-4 flex flex-col items-center text-center gap-1">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <span className="text-xl sm:text-2xl font-bold">{stat.value}</span>
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Completion Summary */}
      <AnimatePresence>
        {isCompleted && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCheck className="h-5 w-5 text-emerald-600" />
                    <span className="font-semibold text-emerald-800">
                      Session Completed
                    </span>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                    {matchRate}% Match Rate
                  </Badge>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-emerald-700">Matched items</span>
                    <span className="font-medium">{matchedCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-amber-700">Discrepancies</span>
                    <span className="font-medium">{discrepancyCount}</span>
                  </div>
                  <Progress value={matchRate} className="h-2 mt-1" />
                </div>
                {session.completedAt && (
                  <p className="text-xs text-emerald-600/70 mt-2">
                    Completed on {formatDate(session.completedAt)}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scanned Items Table */}
      <motion.div {...fadeIn}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Scanned Items</CardTitle>
            <CardDescription>
              {items.length} item{items.length !== 1 ? 's' : ''} scanned
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <ScanLine className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No items scanned yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">QR Code</TableHead>
                      <TableHead>Asset Name</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[140px]">Discrepancy</TableHead>
                      <TableHead className="w-[100px]">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const hasDiscrepancy = !!item.discrepancyType
                      const rowClass = hasDiscrepancy
                        ? item.discrepancyType === 'missing'
                          ? 'bg-amber-50/80 dark:bg-amber-950/20'
                          : 'bg-red-50/80 dark:bg-red-950/20'
                        : ''

                      return (
                        <TableRow key={item.id} className={rowClass}>
                          <TableCell className="font-mono text-xs">
                            {item.qrCode || (item.asset?.qrCode ? `...${item.asset.qrCode.slice(-8)}` : '—')}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            {item.asset?.name || 'Unregistered'}
                          </TableCell>
                          <TableCell>
                            {item.asset ? (
                              <Badge
                                variant="secondary"
                                className={assetStatusColor(item.asset.status)}
                              >
                                {item.asset.status}
                              </Badge>
                            ) : (
                              <Badge variant="outline">unknown</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {hasDiscrepancy ? (
                              <Badge
                                variant={item.discrepancyType === 'missing' ? 'outline' : 'destructive'}
                                className={
                                  item.discrepancyType === 'missing'
                                    ? 'border-amber-300 text-amber-700 bg-amber-50'
                                    : ''
                                }
                              >
                                {item.discrepancyType === 'missing' && (
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                )}
                                {item.discrepancyType === 'extra' && (
                                  <XCircle className="h-3 w-3 mr-1" />
                                )}
                                {item.discrepancyType}
                                {item.discrepancyNote && (
                                  <span className="ml-1 text-[10px] opacity-70">
                                    — {item.discrepancyNote}
                                  </span>
                                )}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(item.scannedAt).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Complete Session Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Inventory Session?</DialogTitle>
            <DialogDescription>
              This will finalize the session &ldquo;{session.name}&rdquo;. You will
              not be able to scan additional items after completion.
              {session.totalExpected > 0 && session.totalScanned < session.totalExpected && (
                <span className="block mt-2 text-amber-600 font-medium">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  Warning: {session.totalExpected - session.totalScanned} expected items have not been scanned yet.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCompleteDialog(false)}
              disabled={completing}
            >
              Cancel
            </Button>
            <Button onClick={handleComplete} disabled={completing}>
              {completing ? 'Completing...' : 'Complete Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ──────────────────────────────────────────────
   MAIN EXPORT
   ────────────────────────────────────────────── */

export default function InventoryView() {
  const { currentView } = useAppStore()

  return (
    <main className="min-h-screen w-full">
      <AnimatePresence mode="wait">
        {currentView === 'scan' && (
          <motion.div
            key="scan"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <ScanView />
          </motion.div>
        )}
        {currentView === 'inventory' && (
          <motion.div
            key="inventory"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <InventoryListView />
          </motion.div>
        )}
        {currentView === 'inventory-detail' && (
          <motion.div
            key="inventory-detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <InventoryDetailView />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
