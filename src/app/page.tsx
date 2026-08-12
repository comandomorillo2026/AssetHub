'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import PortalView from '@/components/portal/portal-view'
import LoginView from '@/components/auth/login-view'
import RegistrationWizard from '@/components/auth/registration-wizard'
import PwaInstallPrompt from '@/components/pwa/pwa-install-prompt'
import AdminView from '@/components/admin/admin-view'
import { DesktopSidebar, MobileSidebar } from '@/components/layout/sidebar'
import AppHeader from '@/components/layout/app-header'
import DashboardView from '@/components/views/dashboard-view'
import AssetsView from '@/components/views/assets-view'
import InventoryView from '@/components/views/inventory-view'
import SettingsView from '@/components/views/settings-view'
import MaintenanceView from '@/components/views/maintenance-view'
import WorkOrdersView from '@/components/views/work-orders-view'
import CheckoutsView from '@/components/views/checkouts-view'
import ReservationsView from '@/components/views/reservations-view'
import NotificationsView from '@/components/views/notifications-view'
import AiAssistantView from '@/components/views/ai-assistant-view'
import MigrationView from '@/components/views/migration-view'
import ReportsView from '@/components/views/reports-view'
import UsersView from '@/components/views/users-view'
import SearchView from '@/components/views/search-view'

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
        return <ReportsView />
      case 'settings':
        return <SettingsView />
      case 'users':
        return <UsersView />
      case 'search':
        return <SearchView />
      case 'notifications':
        return <NotificationsView />
      case 'maintenance':
        return <MaintenanceView />
      case 'work-orders':
        return <WorkOrdersView />
      case 'checkouts':
        return <CheckoutsView />
      case 'reservations':
        return <ReservationsView />
      case 'ai-assistant':
        return <AiAssistantView />
      case 'migration':
        return <MigrationView />
      default:
        return <DashboardView />
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DesktopSidebar />
      <MobileSidebar open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader onMenuClick={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {renderView()}
        </main>
      </div>
      <PwaInstallPrompt />
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
    const storedRefresh = localStorage.getItem('zeitgeist_refresh_token')
    if (stored && storedToken && storedRefresh) {
      try {
        const user = JSON.parse(stored)
        useAppStore.getState().setAuth(user, storedToken, storedRefresh)
      } catch {
        localStorage.removeItem('zeitgeist_user')
        localStorage.removeItem('zeitgeist_token')
        localStorage.removeItem('zeitgeist_refresh_token')
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

    // Handle payment success redirect from WiPay
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('payment_success') === 'true') {
      toast.success('Payment completed! Your subscription is now active.')
      // Clean URL without refresh
      window.history.replaceState({}, '', '/')
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
    if (currentView === 'register' || currentView === 'register-wizard') {
      return <RegistrationWizard />
    }
    // Default: show marketing portal
    return <PortalView />
  }

  return <AppLayout />
}