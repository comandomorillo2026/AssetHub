'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Upload,
  FileSpreadsheet,
  Database,
  ArrowRight,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  History,
  X,
  Trash2,
} from 'lucide-react'

import { migrationApi } from '@/lib/api'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'

// ── Types ───────────────────────────────────────────────────────────────

type EntityType = 'assets' | 'categories' | 'locations' | 'users'
type MigrationStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'rolled_back'

interface MigrationRecord {
  id: string
  sourceType: string
  entityType: string
  fileName: string
  fileSize: number
  totalRows: number
  processedRows: number
  failedRows: number
  status: MigrationStatus
  mappingConfig: string
  errors: string | null
  startedAt: string | null
  completedAt: string | null
  rolledBackAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

interface ImportError {
  row: number
  message: string
  data?: Record<string, string>
}

// ── Entity field definitions ────────────────────────────────────────────

const ENTITY_FIELDS: Record<EntityType, { label: string; value: string; required?: boolean }[]> = {
  assets: [
    { label: 'Name', value: 'name', required: true },
    { label: 'Description', value: 'description' },
    { label: 'Serial Number', value: 'serialNumber' },
    { label: 'Brand', value: 'brand' },
    { label: 'Model', value: 'model' },
    { label: 'Purchase Date', value: 'purchaseDate' },
    { label: 'Purchase Price', value: 'purchasePrice' },
    { label: 'Current Value', value: 'currentValue' },
    { label: 'Status', value: 'status' },
    { label: 'Condition', value: 'condition' },
    { label: 'Assigned To', value: 'assignedTo' },
    { label: 'Category', value: 'categoryId' },
    { label: 'Location', value: 'locationId' },
    { label: 'Tag Number', value: 'tagNumber' },
  ],
  categories: [
    { label: 'Name', value: 'name', required: true },
    { label: 'Code', value: 'code' },
    { label: 'Color', value: 'color' },
    { label: 'Icon', value: 'icon' },
  ],
  locations: [
    { label: 'Name', value: 'name', required: true },
    { label: 'Code', value: 'code' },
    { label: 'Address', value: 'address' },
  ],
  users: [
    { label: 'Name', value: 'name', required: true },
    { label: 'Email', value: 'email', required: true },
    { label: 'Role', value: 'role' },
    { label: 'Phone', value: 'phone' },
    { label: 'Department', value: 'department' },
    { label: 'Job Title', value: 'jobTitle' },
  ],
}

// Auto-matching patterns for column mapping
const AUTO_MAP_PATTERNS: Record<string, string[]> = {
  name: ['name', 'asset_name', 'asset name', 'item', 'item_name', 'item name', 'category_name', 'location_name', 'full_name', 'full name', 'display_name'],
  description: ['description', 'desc', 'details', 'notes'],
  serialNumber: ['serial', 'serial_number', 'serial number', 'serialnumber', 'serial_no', 'serial no'],
  brand: ['brand', 'manufacturer', 'make', 'vendor'],
  model: ['model', 'model_number', 'model number', 'model_no'],
  purchaseDate: ['purchase_date', 'purchase date', 'date_purchased', 'date purchased', 'acquired_date', 'acquired'],
  purchasePrice: ['purchase_price', 'purchase price', 'cost', 'price', 'amount', 'value'],
  currentValue: ['current_value', 'current value', 'book_value', 'book value'],
  status: ['status', 'condition_status', 'asset_status'],
  condition: ['condition', 'physical_condition'],
  assignedTo: ['assigned_to', 'assigned to', 'assigned', 'user', 'custodian', 'responsible'],
  categoryId: ['category', 'category_id', 'category_name'],
  locationId: ['location', 'location_id', 'location_name', 'site', 'building'],
  tagNumber: ['tag', 'tag_number', 'tag number', 'tag_no', 'asset_tag', 'asset_tag_number', 'barcode'],
  code: ['code', 'category_code', 'category code', 'location_code', 'location code'],
  color: ['color', 'hex'],
  icon: ['icon'],
  address: ['address', 'location_address'],
  email: ['email', 'email_address', 'email address'],
  role: ['role', 'user_role', 'position', 'job_title'],
  phone: ['phone', 'phone_number', 'phone number', 'mobile', 'telephone'],
  department: ['department', 'dept'],
  jobTitle: ['job_title', 'job title', 'title', 'position'],
}

const ENTITY_LABELS: Record<EntityType, string> = {
  assets: 'Assets',
  categories: 'Categories',
  locations: 'Locations',
  users: 'Users',
}

// ── Helpers ─────────────────────────────────────────────────────────────

function autoMapColumns(csvHeaders: string[], entityType: EntityType): Record<string, string> {
  const mapping: Record<string, string> = {}
  const fields = ENTITY_FIELDS[entityType]

  for (const field of fields) {
    const patterns = AUTO_MAP_PATTERNS[field.value] || []
    for (const header of csvHeaders) {
      const normalized = header.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
      if (patterns.some(p => p === normalized || p.replace(/_/g, ' ') === header.toLowerCase())) {
        mapping[field.value] = header
        break
      }
    }
  }
  return mapping
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusBadge(status: MigrationStatus) {
  const config: Record<MigrationStatus, { label: string; className: string }> = {
    completed: { label: 'Completed', className: 'bg-green-100 text-green-700 border-green-200' },
    failed: { label: 'Failed', className: 'bg-red-100 text-red-700 border-red-200' },
    processing: { label: 'Processing', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    pending: { label: 'Pending', className: 'bg-slate-100 text-slate-600 border-slate-200' },
    rolled_back: { label: 'Rolled Back', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  }
  const c = config[status] || config.pending
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>
}

function parseCSVHeaders(text: string): string[] {
  const firstLine = text.split(/\r?\n/)[0] || ''
  const headers: string[] = []
  let inQuotes = false
  let current = ''
  for (const ch of firstLine) {
    if (inQuotes) {
      if (ch === '"' && current.endsWith('"')) {
        inQuotes = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        headers.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }
  if (current.trim()) headers.push(current.trim())
  return headers
}

// ── Component ───────────────────────────────────────────────────────────

export default function MigrationView() {
  // ── State: Import ──
  const [entityType, setEntityType] = useState<EntityType>('assets')
  const [file, setFile] = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [showMapping, setShowMapping] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<MigrationRecord | null>(null)
  const [importErrors, setImportErrors] = useState<ImportError[]>([])

  // ── State: History ──
  const [migrations, setMigrations] = useState<MigrationRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [rollbackId, setRollbackId] = useState<string | null>(null)
  const [isRollingBack, setIsRollingBack] = useState(false)

  // Drag state
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch migration history ──
  const fetchHistory = useCallback(async () => {
    try {
      const data = await migrationApi.list()
      setMigrations(data.data || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load migration history')
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // ── Process uploaded file ──
  const processFile = useCallback((selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Only CSV files are supported')
      return
    }
    setFile(selectedFile)
    setImportResult(null)
    setImportErrors([])

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const headers = parseCSVHeaders(text)
      setCsvHeaders(headers)
      const mapping = autoMapColumns(headers, entityType)
      setColumnMapping(mapping)
      setShowMapping(true)
    }
    reader.onerror = () => {
      toast.error('Failed to read file')
    }
    reader.readAsText(selectedFile)
  }, [entityType])

  // ── Handle entity type change ──
  const handleEntityTypeChange = (value: string) => {
    const type = value as EntityType
    setEntityType(type)
    setImportResult(null)
    setImportErrors([])
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const headers = parseCSVHeaders(text)
        setCsvHeaders(headers)
        const mapping = autoMapColumns(headers, type)
        setColumnMapping(mapping)
      }
      reader.readAsText(file)
    } else {
      setCsvHeaders([])
      setColumnMapping({})
      setShowMapping(false)
    }
  }

  // ── Drag & drop handlers ──
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) processFile(droppedFile)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) processFile(selectedFile)
  }

  // ── Update mapping ──
  const updateMapping = (targetField: string, sourceColumn: string) => {
    setColumnMapping((prev) => {
      const next = { ...prev }
      // Remove any other mapping pointing to the same source column
      for (const [key, val] of Object.entries(next)) {
        if (val === sourceColumn && key !== targetField) {
          delete next[key]
        }
      }
      if (sourceColumn === '__none__') {
        delete next[targetField]
      } else {
        next[targetField] = sourceColumn
      }
      return next
    })
  }

  // ── Start import ──
  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file first')
      return
    }

    setIsImporting(true)
    setImportProgress(10)
    setImportResult(null)
    setImportErrors([])

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('entityType', entityType)
      formData.append('mappingConfig', JSON.stringify(columnMapping))

      setImportProgress(30)
      const data = await migrationApi.importCSV(formData)
      setImportProgress(100)

      const migration = data.data as MigrationRecord
      setImportResult(migration)

      // Parse errors if any
      if (migration.errors) {
        try {
          const parsed = JSON.parse(migration.errors)
          setImportErrors(Array.isArray(parsed) ? parsed : [])
        } catch {
          setImportErrors([])
        }
      }

      if (migration.status === 'completed') {
        toast.success(`Import completed: ${migration.processedRows} rows processed successfully`)
      } else if (migration.status === 'failed') {
        toast.error('Import failed. Check the error details below.')
      } else {
        toast.info(`Import finished with status: ${migration.status}`)
      }

      // Refresh history
      fetchHistory()
    } catch (err) {
      setImportProgress(0)
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsImporting(false)
    }
  }

  // ── Rollback ──
  const handleRollback = async () => {
    if (!rollbackId) return
    setIsRollingBack(true)
    try {
      const data = await migrationApi.rollback(rollbackId)
      toast.success(data.message || 'Migration rolled back successfully')
      setRollbackId(null)
      fetchHistory()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rollback failed')
    } finally {
      setIsRollingBack(false)
    }
  }

  // ── Reset import form ──
  const resetForm = () => {
    setFile(null)
    setCsvHeaders([])
    setColumnMapping({})
    setShowMapping(false)
    setImportResult(null)
    setImportErrors([])
    setImportProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Render ──
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Data Migration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Import data from CSV files into your AssetHub system. Map columns, review, and track import history.
        </p>
      </div>

      {/* Section 1: Import Data */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0f766e]/10">
              <Upload className="h-4 w-4 text-[#0f766e]" />
            </div>
            <div>
              <CardTitle className="text-base">Import Data</CardTitle>
              <CardDescription>Upload a CSV file and map columns to target fields</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Entity type selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Entity Type</Label>
            <Select value={entityType} onValueChange={handleEntityTypeChange}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ENTITY_FIELDS) as EntityType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      {type === 'assets' && <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />}
                      {type === 'categories' && <Database className="h-3.5 w-3.5 text-muted-foreground" />}
                      {type === 'locations' && <Database className="h-3.5 w-3.5 text-muted-foreground" />}
                      {type === 'users' && <Database className="h-3.5 w-3.5 text-muted-foreground" />}
                      {ENTITY_LABELS[type]}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Upload area */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">CSV File</Label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors ${
                isDragOver
                  ? 'border-[#0f766e] bg-[#0f766e]/5'
                  : file
                    ? 'border-green-300 bg-green-50/50'
                    : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
              {file ? (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); resetForm() }}
                    className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-slate-200 hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <Upload className="h-6 w-6 text-slate-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">
                      {isDragOver ? 'Drop your file here' : 'Drag & drop a CSV file here'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">or click to browse</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Column mapping */}
          <AnimatePresence>
            {showMapping && csvHeaders.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-[#0f766e]" />
                      <span className="text-sm font-medium text-foreground">Column Mapping</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {csvHeaders.length} columns detected · {Object.keys(columnMapping).length} mapped
                    </span>
                  </div>

                  <ScrollArea className="max-h-64">
                    <div className="space-y-2 pr-2">
                      {ENTITY_FIELDS[entityType].map((field) => (
                        <div key={field.value} className="flex items-center gap-3">
                          <span className="w-32 shrink-0 truncate text-right text-sm text-muted-foreground">
                            {field.label}
                            {field.required && <span className="ml-0.5 text-red-400">*</span>}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                          <Select
                            value={columnMapping[field.value] || '__none__'}
                            onValueChange={(val) => updateMapping(field.value, val)}
                          >
                            <SelectTrigger className="h-8 flex-1 text-xs">
                              <SelectValue placeholder="— Not mapped —" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— Not mapped —</SelectItem>
                              {csvHeaders.map((header) => (
                                <SelectItem key={header} value={header}>
                                  {header}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Import progress */}
          {isImporting && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
            >
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Importing data...</span>
              </div>
              <Progress value={importProgress} className="h-2 bg-amber-100" />
              <p className="text-xs text-amber-600">Please wait while your data is being processed.</p>
            </motion.div>
          )}

          {/* Import results */}
          <AnimatePresence>
            {importResult && !isImporting && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <div className={`rounded-xl border p-4 ${
                  importResult.status === 'completed'
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50'
                }`}>
                  <div className="flex items-start gap-3">
                    {importResult.status === 'completed' ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                    ) : (
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                    )}
                    <div className="flex-1">
                      <h3 className={`text-sm font-semibold ${
                        importResult.status === 'completed' ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {importResult.status === 'completed' ? 'Import Completed' : 'Import Issues Found'}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm">
                        <span className={importResult.processedRows > 0 ? 'text-green-700' : 'text-muted-foreground'}>
                          <strong>{importResult.processedRows}</strong> successful
                        </span>
                        <span className={importResult.failedRows > 0 ? 'text-red-600' : 'text-muted-foreground'}>
                          <strong>{importResult.failedRows}</strong> failed
                        </span>
                        <span className="text-muted-foreground">
                          <strong>{importResult.totalRows}</strong> total
                        </span>
                      </div>

                      {/* Error list */}
                      {importErrors.length > 0 && (
                        <div className="mt-3">
                          <button
                            onClick={() => {
                              const el = document.getElementById('import-errors')
                              el?.classList.toggle('hidden')
                            }}
                            className="text-xs font-medium text-red-600 hover:text-red-700"
                          >
                            {importErrors.length} error{importErrors.length > 1 ? 's' : ''} — click to {document.getElementById('import-errors')?.classList.contains('hidden') ? 'show' : 'hide'}
                          </button>
                          <div id="import-errors" className="mt-2 hidden">
                            <ScrollArea className="max-h-48 rounded-lg border border-red-200 bg-white">
                              <div className="space-y-1 p-2">
                                {importErrors.slice(0, 50).map((err, idx) => (
                                  <div key={idx} className="flex items-start gap-2 rounded px-2 py-1 text-xs">
                                    <span className="shrink-0 font-mono text-red-400">Row {err.row}:</span>
                                    <span className="text-red-700">{err.message}</span>
                                  </div>
                                ))}
                                {importErrors.length > 50 && (
                                  <p className="px-2 py-1 text-xs text-muted-foreground">
                                    ...and {importErrors.length - 50} more errors
                                  </p>
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Import button */}
          <div className="flex items-center gap-3">
            <Button
              className="bg-[#0f766e] text-white hover:bg-[#0d6560]"
              disabled={!file || isImporting}
              onClick={handleImport}
            >
              {isImporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {isImporting ? 'Importing...' : 'Start Import'}
            </Button>
            {file && !isImporting && (
              <Button variant="ghost" onClick={resetForm}>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Import History */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0f766e]/10">
              <History className="h-4 w-4 text-[#0f766e]" />
            </div>
            <div>
              <CardTitle className="text-base">Import History</CardTitle>
              <CardDescription>View and manage past data imports</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : migrations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Database className="h-10 w-10 text-slate-300" />
              <p className="text-sm text-muted-foreground">No import history yet</p>
              <p className="text-xs text-muted-foreground">
                Upload a CSV file above to get started
              </p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80">
                      <TableHead className="text-xs font-medium">File Name</TableHead>
                      <TableHead className="text-xs font-medium">Entity</TableHead>
                      <TableHead className="text-xs font-medium">Status</TableHead>
                      <TableHead className="text-xs font-medium text-right">Rows</TableHead>
                      <TableHead className="hidden text-xs font-medium sm:table-cell">Date</TableHead>
                      <TableHead className="text-right text-xs font-medium">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {migrations.map((m) => (
                      <TableRow key={m.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4 shrink-0 text-slate-400" />
                            <div className="min-w-0">
                              <p className="max-w-[200px] truncate text-sm font-medium">{m.fileName}</p>
                              <p className="text-xs text-muted-foreground">{formatBytes(m.fileSize)}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {m.entityType}
                          </Badge>
                        </TableCell>
                        <TableCell>{statusBadge(m.status)}</TableCell>
                        <TableCell className="text-right text-sm">
                          <span className={m.failedRows > 0 ? 'text-red-600' : ''}>
                            {m.processedRows}
                          </span>
                          <span className="text-muted-foreground">/{m.totalRows}</span>
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                          {formatDate(m.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {m.status === 'completed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => setRollbackId(m.id)}
                            >
                              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Rollback</span>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rollback confirmation dialog */}
      <AlertDialog open={!!rollbackId} onOpenChange={(open) => !open && setRollbackId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rollback Import</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to rollback this import? This is a soft rollback — the imported
              records may still exist in the system. You may need to manually clean up the data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRollingBack}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollback}
              disabled={isRollingBack}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isRollingBack ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isRollingBack ? 'Rolling back...' : 'Rollback Import'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
