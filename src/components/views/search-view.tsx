'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Search,
  Package,
  Users,
  MapPin,
  FolderTree,
  Wrench,
  ClipboardList,
  ArrowRight,
  Loader2,
} from 'lucide-react'

import { useAppStore } from '@/lib/store'
import { searchApi } from '@/lib/api'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// ─── Types ────────────────────────────────────────────────────────────────

interface SearchResult {
  id: string
  type: string
  title: string
  subtitle?: string
  data?: Record<string, unknown>
}

interface SearchResponse {
  results: SearchResult[]
  total: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  assets: { label: 'Assets', icon: Package, color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' },
  users: { label: 'Users', icon: Users, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  locations: { label: 'Locations', icon: MapPin, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  categories: { label: 'Categories', icon: FolderTree, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  maintenance: { label: 'Maintenance', icon: Wrench, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  work_orders: { label: 'Work Orders', icon: ClipboardList, color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
}

const TYPE_ORDER = ['assets', 'users', 'locations', 'categories', 'maintenance', 'work_orders']

function groupByType(results: SearchResult[]): Record<string, SearchResult[]> {
  const groups: Record<string, SearchResult[]> = {}
  for (const r of results) {
    if (!groups[r.type]) groups[r.type] = []
    groups[r.type].push(r)
  }
  return groups
}

const fadeVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
}

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH VIEW
// ═══════════════════════════════════════════════════════════════════════════

export default function SearchView() {
  const searchQuery = useAppStore((s) => s.searchQuery)
  const navigate = useAppStore((s) => s.navigate)
  const setSelectedAssetId = useAppStore((s) => s.setSelectedAssetId)
  const setSelectedInventoryId = useAppStore((s) => s.setSelectedInventoryId)

  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('')

  const doSearch = useCallback(async () => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([])
      setTotal(0)
      return
    }

    setLoading(true)
    try {
      const data = (await searchApi.global(searchQuery)) as SearchResponse
      const res = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : []
      setResults(res)
      setTotal(data?.total ?? res.length)

      // Auto-select first tab with results
      const groups = groupByType(res)
      const firstType = TYPE_ORDER.find((t) => groups[t]?.length)
      if (firstType) setActiveTab(firstType)
    } catch {
      toast.error('Search failed')
      setResults([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [searchQuery])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(doSearch, 400)
    return () => clearTimeout(timer)
  }, [doSearch])

  const grouped = groupByType(results)
  const tabsWithResults = TYPE_ORDER.filter((t) => grouped[t]?.length)

  // Handle clicking a result
  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case 'assets':
        setSelectedAssetId(result.id)
        navigate('asset-detail')
        break
      case 'users':
        navigate('users')
        break
      case 'work_orders':
        navigate('work-orders')
        break
      default:
        // categories, locations, maintenance have no dedicated view — go to assets
        navigate('assets')
        break
    }
  }

  // ─── Empty / Initial state ────────────────────────────────────────────
  if (!searchQuery || searchQuery.length < 2) {
    return (
      <motion.div {...fadeVariants} transition={{ duration: 0.25 }} className="flex flex-col items-center justify-center gap-4 py-20">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <Search className="size-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Search AssetHub</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Type at least 2 characters in the search bar to find assets, users, locations, and more.
        </p>
      </motion.div>
    )
  }

  // ─── Loading state ────────────────────────────────────────────────────
  if (loading) {
    return (
      <motion.div {...fadeVariants} transition={{ duration: 0.25 }} className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            Search Results for &lsquo;{searchQuery}&rsquo;
          </h1>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </motion.div>
    )
  }

  // ─── No results ───────────────────────────────────────────────────────
  if (results.length === 0) {
    return (
      <motion.div {...fadeVariants} transition={{ duration: 0.25 }} className="flex flex-col items-center justify-center gap-4 py-20">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <Search className="size-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">No results found for &lsquo;{searchQuery}&rsquo;</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Try a different search term, check your spelling, or use broader keywords.
        </p>
      </motion.div>
    )
  }

  // ─── Results with tabs ────────────────────────────────────────────────
  const currentTabItems = activeTab ? grouped[activeTab] ?? [] : []

  return (
    <motion.div {...fadeVariants} transition={{ duration: 0.25 }} className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          Search Results for &lsquo;{searchQuery}&rsquo;
        </h1>
        <Badge variant="secondary" className="text-xs font-medium tabular-nums">
          {total} {total === 1 ? 'result' : 'results'}
        </Badge>
      </div>

      {/* Tabs */}
      {tabsWithResults.length > 1 ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            {tabsWithResults.map((type) => {
              const config = TYPE_CONFIG[type]
              if (!config) return null
              const Icon = config.icon
              return (
                <TabsTrigger key={type} value={type} className="text-xs">
                  <Icon className="size-3.5 mr-1.5" />
                  {config.label}
                  <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 h-4">
                    {grouped[type].length}
                  </Badge>
                </TabsTrigger>
              )
            })}
          </TabsList>

          {tabsWithResults.map((type) => (
            <TabsContent key={type} value={type} className="mt-4">
              <div className="space-y-2">
                {grouped[type].map((result) => (
                  <SearchResultCard key={result.id} result={result} onClick={() => handleResultClick(result)} />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        /* Single tab — just show results directly */
        <div className="space-y-2">
          {currentTabItems.map((result) => (
            <SearchResultCard key={result.id} result={result} onClick={() => handleResultClick(result)} />
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ─── Search Result Card ────────────────────────────────────────────────────

function SearchResultCard({ result, onClick }: { result: SearchResult; onClick: () => void }) {
  const config = TYPE_CONFIG[result.type]
  const Icon = config?.icon ?? Search

  return (
    <Card
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`flex size-10 items-center justify-center rounded-lg shrink-0 ${config?.color ?? 'bg-gray-100 text-gray-700'}`}>
          <Icon className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{result.title}</p>
            <Badge variant="outline" className={`text-[10px] shrink-0 ${config?.color ?? ''}`}>
              {config?.label ?? result.type}
            </Badge>
          </div>
          {result.subtitle && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{result.subtitle}</p>
          )}
        </div>
        <ArrowRight className="size-4 text-muted-foreground shrink-0" />
      </CardContent>
    </Card>
  )
}
