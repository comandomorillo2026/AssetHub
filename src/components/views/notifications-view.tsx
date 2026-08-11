'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  BellOff,
  CheckCheck,
  Search,
  Loader2,
  Inbox,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

import { useAppStore } from '@/lib/store'
import { notificationsApi } from '@/lib/api'

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */

interface NotificationItem {
  id: string
  tenantId: string
  userId: string | null
  type: string
  title: string
  message: string
  data: string | null
  isRead: boolean
  readAt: string | null
  createdAt: string
  user?: { id: string; name: string } | null
}

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

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
  if (minutes < 60) return `${minutes}h ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  if (weeks < 5) return `${weeks}w ago`
  return `${months}mo ago`
}

const TYPE_EMOJI: Record<string, string> = {
  maintenance_due: '🔧',
  warranty_expiring: '⚠️',
  inventory_completed: '✅',
  system: '🔔',
  asset_expired: '🔧',
  custom: '📡',
}

const TYPE_LABEL: Record<string, string> = {
  maintenance_due: 'Maintenance',
  warranty_expiring: 'Warranty',
  inventory_completed: 'Inventory',
  system: 'System',
  asset_expired: 'Maintenance',
  custom: 'System',
}

// Map user-facing filter tabs to API types
const TAB_TYPE_MAP: Record<string, string[]> = {
  all: [],
  unread: [],
  maintenance: ['maintenance_due', 'asset_expired'],
  warranty: ['warranty_expiring'],
  inventory: ['inventory_completed'],
  system: ['system', 'custom'],
}

type TabKey = 'all' | 'unread' | 'maintenance' | 'warranty' | 'inventory' | 'system'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'maintenance', label: '🔧 Maintenance' },
  { key: 'warranty', label: '⚠️ Warranty' },
  { key: 'inventory', label: '✅ Inventory' },
  { key: 'system', label: '🔔 System' },
]

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
  animate: { transition: { staggerChildren: 0.04 } },
}

/* ──────────────────────────────────────────────
   Main Component
   ────────────────────────────────────────────── */

export default function NotificationsView() {
  const refreshKey = useAppStore((s) => s.refreshKey)
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)

  // Data state
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Unread count
  const [unreadCount, setUnreadCount] = useState(0)

  // Filters
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Action states
  const [markingAllRead, setMarkingAllRead] = useState(false)
  const [markingRead, setMarkingRead] = useState<string | null>(null)

  /* ──────────────────────────────────────────────
     Data fetching
     ────────────────────────────────────────────── */

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params: Record<string, string> = { limit: '200' }
      if (activeTab === 'unread') {
        params.unreadOnly = 'true'
      }
      const res = await notificationsApi.list(params)
      setNotifications(res.data || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await notificationsApi.unreadCount()
      setUnreadCount(res.count ?? 0)
    } catch {
      // Silent
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications, refreshKey])

  useEffect(() => {
    fetchUnreadCount()
  }, [fetchUnreadCount, refreshKey])

  /* ──────────────────────────────────────────────
     Computed values
     ────────────────────────────────────────────── */

  const filteredNotifications = useMemo(() => {
    let result = notifications

    // Filter by type tab (only when not 'all' or 'unread')
    const typeKeys = TAB_TYPE_MAP[activeTab]
    if (typeKeys && typeKeys.length > 0) {
      result = result.filter((n) => typeKeys.includes(n.type))
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.message.toLowerCase().includes(q)
      )
    }

    return result
  }, [notifications, activeTab, searchQuery])

  /* ──────────────────────────────────────────────
     Handlers
     ────────────────────────────────────────────── */

  async function handleMarkRead(id: string) {
    const notification = notifications.find((n) => n.id === id)
    if (!notification || notification.isRead) return

    try {
      setMarkingRead(id)
      await notificationsApi.markRead(id)
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, isRead: true, readAt: new Date().toISOString() }
            : n
        )
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark as read.')
    } finally {
      setMarkingRead(null)
    }
  }

  async function handleMarkAllRead() {
    if (unreadCount === 0) return
    try {
      setMarkingAllRead(true)
      await notificationsApi.markAllRead()
      setNotifications((prev) =>
        prev.map((n) =>
          !n.isRead ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        )
      )
      setUnreadCount(0)
      toast.success('All notifications marked as read.')
      triggerRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark all as read.')
    } finally {
      setMarkingAllRead(false)
    }
  }

  /* ──────────────────────────────────────────────
     Render
     ────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Header */
        }
        <motion.div
          className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          {...fadeIn}
        >
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
              <p className="text-sm text-slate-500">Stay updated on your assets and activities.</p>
            </div>
            {unreadCount > 0 && (
              <Badge className="bg-[#0f766e] text-white hover:bg-[#0d6961] text-xs px-2.5 py-0.5 rounded-full font-semibold">
                {unreadCount}
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markingAllRead || unreadCount === 0}
            className="shrink-0"
          >
            {markingAllRead ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <CheckCheck className="size-3.5 mr-1.5" />
            )}
            Mark All Read
          </Button>
        </motion.div>

        {/* Tabs */
        }
        <motion.div
          className="mb-6"
          {...fadeIn}
          transition={{ delay: 0.05 }}
        >
          <div className="flex items-center gap-1 overflow-x-auto pb-1 -mb-1 scrollbar-none">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors
                  ${activeTab === tab.key
                    ? 'bg-white text-[#0f766e] shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                  }
                `}
              >
                {tab.label}
                {tab.key === 'unread' && unreadCount > 0 && (
                  <span className="flex size-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Search */
        }
        <motion.div className="mb-4" {...fadeIn} transition={{ delay: 0.1 }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </motion.div>

        {/* Content */
        }
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="size-9 rounded-lg shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BellOff className="size-10 text-red-400 mb-3" />
              <p className="text-sm text-red-600 font-medium">Failed to load notifications</p>
              <p className="text-xs text-slate-500 mt-1">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={fetchNotifications}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : filteredNotifications.length === 0 ? (
          <motion.div {...fadeIn}>
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="flex size-16 items-center justify-center rounded-full bg-slate-100 mb-4">
                  <Inbox className="size-8 text-slate-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-700">No notifications</h3>
                <p className="text-sm text-slate-500 mt-1 text-center max-w-sm">
                  {notifications.length === 0
                    ? 'You’re all caught up! New notifications will appear here.'
                    : 'No notifications match your current filters.'}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            className="space-y-2"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <AnimatePresence>
              {filteredNotifications.map((notification) => {
                const emoji = TYPE_EMOJI[notification.type] || '📡'
                const typeLabel = TYPE_LABEL[notification.type] || 'System'
                const isLoading = markingRead === notification.id

                return (
                  <motion.div
                    key={notification.id}
                    variants={fadeIn}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card
                      className={`
                        border-0 shadow-sm cursor-pointer transition-colors
                        ${!notification.isRead ? 'bg-white border-l-[3px] border-l-[#0f766e]' : 'bg-white/60 hover:bg-white/80'}
                      `}
                      onClick={() => handleMarkRead(notification.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {/* Emoji Icon */
                          }
                          <div
                            className={`
                              flex size-9 shrink-0 items-center justify-center rounded-lg text-lg
                              ${!notification.isRead ? 'bg-teal-50' : 'bg-slate-100'}
                            `}
                          >
                            {isLoading ? (
                              <Loader2 className="size-4 text-slate-400 animate-spin" />
                            ) : (
                              <span>{emoji}</span>
                            )}
                          </div>

                          {/* Content */
                          }
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  {/* Unread indicator */
                                  }
                                  {!notification.isRead && (
                                    <span className="flex size-2 shrink-0 rounded-full bg-blue-500" />
                                  )}
                                  <h3
                                    className={`
                                      text-sm truncate
                                      ${!notification.isRead ? 'font-semibold text-slate-900' : 'font-medium text-slate-600'}
                                    `}
                                  >
                                    {notification.title}
                                  </h3>
                                </div>
                                <p
                                  className={`
                                    text-xs leading-relaxed line-clamp-2
                                    ${!notification.isRead ? 'text-slate-600' : 'text-slate-400'}
                                  `}
                                >
                                  {notification.message}
                                </p>
                              </div>

                              {/* Time */
                              }
                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <span className="text-[11px] text-slate-400 whitespace-nowrap">
                                  {relativeTime(notification.createdAt)}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 h-4 font-normal ${
                                    !notification.isRead
                                      ? 'bg-teal-50 text-teal-700 border-teal-200'
                                      : 'bg-slate-50 text-slate-400 border-slate-200'
                                  }`}
                                >
                                  {typeLabel}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  )
}
