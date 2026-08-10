'use client'

import { Menu, Search, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAppStore, type View } from '@/lib/store'

const VIEW_TITLES: Record<View, string> = {
  login: 'Sign In',
  register: 'Create Organization',
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
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

interface AppHeaderProps {
  onMenuClick: () => void
}

export default function AppHeader({ onMenuClick }: AppHeaderProps) {
  const currentView = useAppStore((s) => s.currentView)
  const user = useAppStore((s) => s.user)
  const isOnline = useAppStore((s) => s.isOnline)
  const pendingSyncCount = useAppStore((s) => s.pendingSyncCount)

  const pageTitle = VIEW_TITLES[currentView] || 'Dashboard'

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
          <span className="text-xs font-medium hidden sm:inline">
            {pendingSyncCount} pending
          </span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-1.5 text-emerald-500">
        <Wifi className="w-3.5 h-3.5" />
        <span className="text-xs font-medium hidden sm:inline">All synced</span>
      </div>
    )
  }

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 px-4 sm:px-6 h-14 bg-white/80 backdrop-blur-md border-b border-slate-200/80">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors -ml-1"
        aria-label="Open navigation menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Page Title */}
      <h1 className="text-base font-semibold text-slate-900 truncate">
        {pageTitle}
      </h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search (cosmetic) */}
      <div className="hidden md:flex items-center relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search assets..."
          className="h-9 w-56 lg:w-64 bg-slate-50 border-slate-200 pl-8 text-sm focus:w-72 lg:focus:w-80 transition-all duration-200 focus:border-[#0f766e] focus:ring-[#0f766e]/20"
          readOnly
        />
      </div>

      {/* Sync Status */}
      <div className="flex items-center">
        {getSyncContent()}
      </div>

      {/* User Avatar */}
      <Avatar className="h-8 w-8 border-2 border-slate-200">
        <AvatarFallback className="bg-[#0f766e]/10 text-[#0f766e] text-xs font-semibold">
          {user ? getInitials(user.name) : '?'}
        </AvatarFallback>
      </Avatar>
    </header>
  )
}
