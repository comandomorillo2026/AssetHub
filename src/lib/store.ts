import { create } from 'zustand'

export type View = 'login' | 'register' | 'register-wizard' | 'dashboard' | 'assets' | 'asset-detail' | 'add-asset' | 'edit-asset' | 'scan' | 'inventory' | 'inventory-detail' | 'reports' | 'settings' | 'users' | 'super-admin' | 'admin-tenant-detail' | 'portal'

export interface SuperAdmin {
  id: string
  email: string
  name: string
}

export interface TenantDetail {
  id: string
  name: string
  slug: string
  type: string
  country: string
  currency: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  address?: string
  isActive: boolean
  createdAt: string
  subscription?: {
    id: string
    status: string
    billingCycle: string
    currentPeriodStart: string
    currentPeriodEnd: string
    nextBillingDate: string
    plan?: {
      id: string
      name: string
      priceMonthly: number
      priceYearly?: number
    }
    payments?: {
      id: string
      amount: number
      method: string
      status: string
      reference?: string
      paidAt?: string
      createdAt: string
    }[]
    invoices?: {
      id: string
      invoiceNumber: string
      amount: number
      status: string
      issuedAt: string
      dueAt: string
      paidAt?: string
      createdAt: string
    }[]
  }
  payments?: {
    id: string
    amount: number
    method: string
    status: string
    reference?: string
    paidAt?: string
    createdAt: string
  }[]
  invoices?: {
    id: string
    invoiceNumber: string
    amount: number
    status: string
    issuedAt: string
    dueAt: string
    paidAt?: string
    createdAt: string
  }[]
  _count?: {
    users: number
    assets: number
    categories: number
    locations: number
  }
}

export interface User {
  id: string
  email: string
  name: string
  role: string
  tenantId: string
  tenant?: {
    id: string
    name: string
    slug: string
    type: string
    country: string
    currency: string
    plan: string
  }
}

export interface Asset {
  id: string
  qrCode: string
  tagNumber: string
  name: string
  description?: string
  serialNumber?: string
  brand?: string
  model?: string
  purchaseDate?: string
  purchasePrice?: number
  currentValue?: number
  warrantyExpiry?: string
  status: string
  condition: string
  assignedTo?: string
  notes?: string
  photo?: string
  categoryId?: string
  locationId?: string
  tenantId: string
  category?: { id: string; name: string; code: string; color: string; icon: string }
  location?: { id: string; name: string; code: string }
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  name: string
  code: string
  color: string
  icon: string
  _count?: { assets: number }
}

export interface Location {
  id: string
  name: string
  code: string
  address?: string
  parentId?: string
  children?: Location[]
  _count?: { assets: number }
}

export interface InventorySession {
  id: string
  name: string
  status: string
  locationId?: string
  location?: { id: string; name: string; code: string }
  notes?: string
  startedAt: string
  completedAt?: string
  totalExpected: number
  totalScanned: number
  totalMissing: number
  totalExtra: number
  userId?: string
  user?: { id: string; name: string }
  items?: InventoryItem[]
  createdAt: string
  updatedAt: string
}

export interface InventoryItem {
  id: string
  qrCode?: string
  assetId?: string
  asset?: Asset
  sessionId: string
  discrepancyType?: string
  discrepancyNote?: string
  scannedAt: string
  synced: boolean
}

export interface DashboardStats {
  totalAssets: number
  activeAssets: number
  totalValue: number
  byStatus: { status: string; count: number }[]
  byCategory: { category: string; count: number; value: number }[]
  byLocation: { location: string; count: number }[]
  recentLogs: { id: string; action: string; details?: string; createdAt: string; user?: { name: string } }[]
  pendingInventories: number
}

interface AppState {
  // Navigation
  currentView: View
  previousView: View | null
  navigate: (view: View) => void
  goBack: () => void

  // Auth
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string) => void
  logout: () => void

  // Super Admin Auth
  superAdmin: SuperAdmin | null
  superAdminToken: string | null
  isSuperAdmin: boolean
  setSuperAuth: (admin: SuperAdmin, token: string) => void
  superLogout: () => void

  // Admin selected tenant
  adminSelectedTenantId: string | null
  setAdminSelectedTenantId: (id: string | null) => void

  // Selected items
  selectedAssetId: string | null
  setSelectedAssetId: (id: string | null) => void
  selectedInventoryId: string | null
  setSelectedInventoryId: (id: string | null) => void

  // Offline
  isOnline: boolean
  pendingSyncCount: number
  setOnlineStatus: (status: boolean) => void
  setPendingSyncCount: (count: number) => void

  // Refresh triggers
  refreshKey: number
  triggerRefresh: () => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'portal',
  previousView: null,
  navigate: (view) => set((s) => ({ currentView: view, previousView: s.currentView })),
  goBack: () => set((s) => s.previousView ? { currentView: s.previousView, previousView: null } : {}),

  user: null,
  token: null,
  isAuthenticated: false,
  setAuth: (user, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('zeitgeist_user', JSON.stringify(user))
      localStorage.setItem('zeitgeist_token', token)
    }
    set({ user, token, isAuthenticated: true, currentView: 'dashboard' })
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('zeitgeist_user')
      localStorage.removeItem('zeitgeist_token')
    }
    set({ user: null, token: null, isAuthenticated: false, currentView: 'portal' as View, selectedAssetId: null, selectedInventoryId: null })
  },

  superAdmin: null,
  superAdminToken: null,
  isSuperAdmin: false,
  setSuperAuth: (admin, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('zeitgeist_super_admin', JSON.stringify(admin))
      localStorage.setItem('zeitgeist_super_token', token)
    }
    set({ superAdmin: admin, superAdminToken: token, isSuperAdmin: true, currentView: 'super-admin' })
  },
  superLogout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('zeitgeist_super_admin')
      localStorage.removeItem('zeitgeist_super_token')
    }
    set({
      superAdmin: null,
      superAdminToken: null,
      isSuperAdmin: false,
      currentView: 'portal' as View,
      adminSelectedTenantId: null,
    })
  },

  adminSelectedTenantId: null,
  setAdminSelectedTenantId: (id) => set({ adminSelectedTenantId: id }),

  selectedAssetId: null,
  setSelectedAssetId: (id) => set({ selectedAssetId: id }),
  selectedInventoryId: null,
  setSelectedInventoryId: (id) => set({ selectedInventoryId: id }),

  isOnline: true,
  pendingSyncCount: 0,
  setOnlineStatus: (status) => set({ isOnline: status }),
  setPendingSyncCount: (count) => set({ pendingSyncCount: count }),

  refreshKey: 0,
  triggerRefresh: () => set((s) => ({ refreshKey: s.refreshKey + 1 })),
}))
