'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { Menu, Search, Wifi, WifiOff, RefreshCw, Bell, X, Bot, Wrench, Upload, Sun, Moon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore, type View } from '@/lib/store'
import { notificationsApi } from '@/lib/api'

const VIEW_TITLES: Record<View, string> = {
  login: 'Sign In',
  register: 'Create Organization',
  'register-wizard': 'Create Organization',
  portal: 'AssetHub',
  dashboard: 'Dashboard',
  assets: 'Assets',
  'asset-detail': 'Asset Details',
  'add-asset': 'Add Asset',
  'edit-asset': 'Edit Asset',
  scan: 'Scan QR Code',
  inventory: 'Inventory',
  'inventory-detail': 'Inventory Details',
  reports: 'Reports',
  settings: 'Settings',
  users: 'Users',
  notifications: 'Notifications',
  maintenance: 'Maintenance',
  'work-orders': 'Work Orders',
  checkouts: 'Checkouts',
  'ai-assistant': 'AI Assistant',
  migration: 'Data Migration',
  search: 'Search Results',
  'super-admin': 'Torre de Control',
  'admin-tenant-detail': 'Tenant Details',
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

interface Notification {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

interface AppHeaderProps {
  onMenuClick: () => void
}

export default function AppHeader({ onMenuClick }: AppHeaderProps) {
  const currentView = useAppStore((s) => s.currentView)
  const user = useAppStore((s) => s.user)
  const isOnline = useAppStore((s) => s.isOnline)
  const pendingSyncCount = useAppStore((s) => s.pendingSyncCount)
  const navigate = useAppStore((s) => s.navigate)
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)
  const { theme, setTheme } = useTheme()

  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await notificationsApi.unreadCount()
      setUnreadCount(data.count)
    } catch { /* ignore */ }
  }, [])

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationsApi.list({ limit: '20' })
      setNotifications(data.notifications || data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  async function handleOpenNotifications() {
    setShowNotifications(true)
    await fetchNotifications()
  }

  async function handleMarkRead(id: string) {
    try {
      await notificationsApi.markRead(id)
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch { /* ignore */ }
  }

  async function handleMarkAllRead() {
    try {
      await notificationsApi.markAllRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch { /* ignore */ }
  }

  const pageTitle = VIEW_TITLES[currentView] || 'Dashboard'

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const query = (e.target as HTMLInputElement).value.trim()
      if (query.length >= 2) {
        useAppStore.getState().setSearchQuery(query)
        navigate('search')
      }
    }
  }

  function getSyncContent() {
    if (!isOnline) {
      return (
        <div className="flex items-center gap-1.5 text-slate-500">
          <WifiOff className="w-3.5 h-3.5" />
          <span className="text-xs font-medium hidden sm:inline">Offline</span>
        </div>
      )
    }
    if (pendingSyncCount > 0) {
      return (
        <div className="flex items-center gap-1.5 text-amber-500">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span className="text-xs font-medium hidden sm:inline">{pendingSyncCount} pending</span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-1.5 text-emerald-500">
        <Wifi className="w-3.5 h-3.5" />
        <span className="text-xs font-medium hidden sm:inline">Synced</span>
      </div>
    )
  }

  function formatTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  function getNotifIcon(type: string) {
    switch (type) {
      case 'maintenance_due': return '🔧'
      case 'warranty_expiring': return '⚠️'
      case 'inventory_completed': return '✅'
      case 'asset_expired': return '📅'
      default: return '🔔'
    }
  }

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 px-4 sm:px-6 h-14 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-700/80">
      <button onClick={onMenuClick} className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors -ml-1" aria-label="Menu">
        <Menu className="w-5 h-5" />
      </button>

      <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">{pageTitle}</h1>
      <div className="flex-1" />

      {/* Quick action buttons - desktop only */}
      <div className="hidden lg:flex items-center gap-1">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500 hover:text-[#0f766e]" onClick={() => navigate('maintenance')} title="Maintenance">
          <Wrench className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500 hover:text-[#0f766e]" onClick={() => navigate('ai-assistant')} title="AI Assistant">
          <Bot className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500 hover:text-[#0f766e]" onClick={() => navigate('migration')} title="Import Data">
          <Upload className="w-4 h-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="hidden md:flex items-center relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Search assets..." className="h-9 w-56 lg:w-64 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 pl-8 text-sm focus:w-72 lg:focus:w-80 transition-all duration-200 focus:border-[#0f766e] focus:ring-[#0f766e]/20" onKeyDown={handleSearchKeyDown} />
      </div>

      {/* Sync Status */}
      <div className="flex items-center">{getSyncContent()}</div>

      {/* Notifications Bell */}
      <div className="relative">
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 relative text-slate-500 hover:text-slate-700" onClick={handleOpenNotifications}>
          <Bell className="w-4.5 h-4.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>

        {showNotifications && (
          <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="font-semibold text-sm text-slate-900">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-xs text-[#0f766e] hover:underline font-medium">Mark all read</button>
                )}
                <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <ScrollArea className="max-h-80">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">No notifications yet</div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${!n.isRead ? 'bg-teal-50/40' : ''}`}
                    onClick={() => handleMarkRead(n.id)}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-base mt-0.5">{getNotifIcon(n.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!n.isRead ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{n.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{formatTimeAgo(n.createdAt)}</p>
                      </div>
                      {!n.isRead && <div className="w-2 h-2 rounded-full bg-[#0f766e] mt-1.5 flex-shrink-0" />}
                    </div>
                  </button>
                ))
              )}
            </ScrollArea>
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
              <button onClick={() => { navigate('notifications'); setShowNotifications(false) }} className="text-xs text-[#0f766e] hover:underline font-medium w-full text-center">View all notifications</button>
            </div>
          </div>
        )}
      </div>

      {/* Theme Toggle */}
      <Button variant="ghost" size="icon" className="h-9 w-9 p-0 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </Button>

      {/* User Avatar */}
      <Avatar className="h-8 w-8 border-2 border-slate-200 dark:border-slate-700">
        <AvatarFallback className="bg-[#0f766e]/10 text-[#0f766e] text-xs font-semibold">
          {user ? getInitials(user.name) : '?'}
        </AvatarFallback>
      </Avatar>
    </header>
  )
}