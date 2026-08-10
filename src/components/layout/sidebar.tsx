'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Shield,
  LayoutDashboard,
  Package,
  ScanLine,
  ClipboardCheck,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAppStore, type View } from '@/lib/store'

type NavItem = {
  view: View
  label: string
  icon: React.ElementType
}

const NAV_ITEMS: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'assets', label: 'Assets', icon: Package },
  { view: 'scan', label: 'Scan QR', icon: ScanLine },
  { view: 'inventory', label: 'Inventory', icon: ClipboardCheck },
  { view: 'reports', label: 'Reports', icon: BarChart3 },
  { view: 'settings', label: 'Settings', icon: Settings },
]

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function SidebarContent({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean
  onNavigate?: () => void
}) {
  const currentView = useAppStore((s) => s.currentView)
  const navigate = useAppStore((s) => s.navigate)
  const user = useAppStore((s) => s.user)
  const isOnline = useAppStore((s) => s.isOnline)
  const pendingSyncCount = useAppStore((s) => s.pendingSyncCount)
  const logout = useAppStore((s) => s.logout)

  function handleNav(view: View) {
    navigate(view)
    onNavigate?.()
  }

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5 shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#0f766e] text-white shrink-0">
          <Shield className="w-5 h-5" strokeWidth={2} />
        </div>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <h2 className="text-sm font-bold text-white tracking-tight leading-tight">
              AssetHub
            </h2>
            <p className="text-[10px] text-slate-400 leading-tight">
              Zeitgeist Business Solution
            </p>
          </motion.div>
        )}
      </div>

      <Separator className="bg-slate-700/50" />

      {/* Navigation */}
      <ScrollArea className="flex-1 py-3 px-2">
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = currentView === item.view ||
              (item.view === 'assets' && (currentView === 'asset-detail' || currentView === 'add-asset' || currentView === 'edit-asset')) ||
              (item.view === 'inventory' && (currentView === 'inventory-detail'))
            const Icon = item.icon

            return (
              <button
                key={item.view}
                onClick={() => handleNav(item.view)}
                title={collapsed ? item.label : undefined}
                className={
                  'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 group relative ' +
                  (isActive
                    ? 'bg-[#0f766e]/15 text-[#5eead4]'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200')
                }
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#0f766e]"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-[#5eead4]' : 'text-slate-500 group-hover:text-slate-300'}`} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>
      </ScrollArea>

      {/* Bottom Section */}
      <div className="shrink-0">
        {/* Sync Status */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60">
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-slate-400 flex-1">
                  {pendingSyncCount > 0 ? `${pendingSyncCount} pending` : 'All synced'}
                </span>
                {pendingSyncCount > 0 && (
                  <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                )}
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-slate-500">Offline</span>
              </>
            )}
          </div>
        </div>

        <Separator className="bg-slate-700/50" />

        {/* User Info */}
        <div className="px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <Avatar className="w-8 h-8 border-2 border-slate-700">
                <AvatarFallback className="bg-[#0f766e]/20 text-[#5eead4] text-xs font-semibold">
                  {user ? getInitials(user.name) : '?'}
                </AvatarFallback>
              </Avatar>
              <span
                className={
                  'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ' +
                  (isOnline ? 'bg-emerald-400' : 'bg-slate-600')
                }
              />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">
                  {user?.name || 'User'}
                </p>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-4 font-medium border-[#0f766e]/40 text-[#5eead4] bg-[#0f766e]/10"
                  >
                    {user?.role || 'Admin'}
                  </Badge>
                  {pendingSyncCount > 0 && (
                    <Badge className="text-[10px] px-1.5 py-0 h-4 font-medium bg-amber-500/20 text-amber-400 border-0">
                      {pendingSyncCount}
                    </Badge>
                  )}
                </div>
              </div>
            )}
            {!collapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-slate-800 shrink-0"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function DesktopSidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 256 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="hidden lg:flex flex-col h-screen sticky top-0 shrink-0 border-r border-slate-800 z-30"
    >
      <SidebarContent collapsed={collapsed} />
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-7 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors z-40"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} />
      </button>
    </motion.aside>
  )
}

export function MobileSidebar({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] p-0 bg-slate-900 border-slate-800">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation Menu</SheetTitle>
        </SheetHeader>
        <SidebarContent collapsed={false} onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}
