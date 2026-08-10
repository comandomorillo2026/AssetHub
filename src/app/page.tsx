'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import PortalView from '@/components/portal/portal-view'
import LoginView from '@/components/auth/login-view'
import RegisterView from '@/components/auth/register-view'
import AdminView from '@/components/admin/admin-view'
import { DesktopSidebar, MobileSidebar } from '@/components/layout/sidebar'
import AppHeader from '@/components/layout/app-header'
import DashboardView from '@/components/views/dashboard-view'
import AssetsView from '@/components/views/assets-view'
import InventoryView from '@/components/views/inventory-view'
import SettingsView from '@/components/views/settings-view'

function AppLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const currentView = useAppStore((s) => s.currentView)

  function renderView() {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />
      case 'assets':
      case 'asset-detail':
      case 'add-asset':
      case 'edit-asset':
        return <AssetsView />
      case 'scan':
      case 'inventory':
      case 'inventory-detail':
        return <InventoryView />
      case 'reports':
      case 'settings':
      case 'users':
        return <SettingsView />
      default:
        return <DashboardView />
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <DesktopSidebar />
      <MobileSidebar open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader onMenuClick={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {renderView()}
        </main>
      </div>
    </div>
  )
}

export default function Home() {
  const currentView = useAppStore((s) => s.currentView)
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const isSuperAdmin = useAppStore((s) => s.isSuperAdmin)

  useEffect(() => {
    const stored = localStorage.getItem('zeitgeist_user')
    const storedToken = localStorage.getItem('zeitgeist_token')
    if (stored && storedToken) {
      try {
        const user = JSON.parse(stored)
        useAppStore.getState().setAuth(user, storedToken)
      } catch {
        localStorage.removeItem('zeitgeist_user')
        localStorage.removeItem('zeitgeist_token')
      }
    }

    const storedAdmin = localStorage.getItem('zeitgeist_super_admin')
    const storedSuperToken = localStorage.getItem('zeitgeist_super_token')
    if (storedAdmin && storedSuperToken) {
      try {
        const admin = JSON.parse(storedAdmin)
        useAppStore.getState().setSuperAuth(admin, storedSuperToken)
      } catch {
        localStorage.removeItem('zeitgeist_super_admin')
        localStorage.removeItem('zeitgeist_super_token')
      }
    }
  }, [])

  useEffect(() => {
    const handleOnline = () => { useAppStore.getState().setOnlineStatus(true) }
    const handleOffline = () => { useAppStore.getState().setOnlineStatus(false) }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Super Admin views
  if (currentView === 'super-admin' || currentView === 'admin-tenant-detail') {
    return <AdminView />
  }

  // Regular auth views — show portal as default landing
  if (!isAuthenticated) {
    if (currentView === 'login') {
      return <LoginView />
    }
    if (currentView === 'register') {
      return <RegisterView />
    }
    // Default: show marketing portal
    return <PortalView />
  }

  return <AppLayout />
}
