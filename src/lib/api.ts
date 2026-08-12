import { useAppStore } from './store'

const BASE = ''

let isRefreshing = false
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('zeitgeist_refresh_token')
  if (!refreshToken) return null

  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return null
    const data = await res.json()
    localStorage.setItem('zeitgeist_token', data.accessToken)
    localStorage.setItem('zeitgeist_refresh_token', data.refreshToken)
    return data.accessToken
  } catch {
    return null
  }
}

async function request(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('zeitgeist_token') : ''
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch(`${BASE}${path}`, { ...options, headers })

    // Auto-refresh on 401 with TOKEN_EXPIRED
    if (res.status === 401) {
      const data = await res.json().catch(() => ({}))
      if (data.code === 'TOKEN_EXPIRED') {
        if (!isRefreshing) {
          isRefreshing = true
          refreshPromise = refreshAccessToken().finally(() => { isRefreshing = false })
        }
        const newToken = await refreshPromise
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`
          const retryRes = await fetch(`${BASE}${path}`, { ...options, headers })
          const retryData = await retryRes.json()
          if (!retryRes.ok) throw new Error(retryData.error || 'Request failed')
          return retryData
        }
        // Refresh failed - logout
        useAppStore.getState().logout()
        throw new Error('Session expired')
      }
      throw new Error(data.error || 'Authentication failed')
    }

    const respData = await res.json()
    if (!res.ok) throw new Error(respData.error || 'Request failed')
    return respData
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      const store = useAppStore.getState()
      store.setOnlineStatus(false)
      if (options.method && options.method !== 'GET') {
        const queue = JSON.parse(localStorage.getItem('zeitgeist_offline_queue') || '[]')
        queue.push({ path, options: { ...options, headers }, timestamp: new Date().toISOString() })
        localStorage.setItem('zeitgeist_offline_queue', JSON.stringify(queue))
        store.setPendingSyncCount(queue.length)
      }
    }
    throw error
  }
}

// Auth
export const authApi = {
  login: (email: string, password: string, tenantSlug: string) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, tenantSlug }),
    }),
  register: (data: Record<string, unknown>) =>
    request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
}

// Assets
export const assetsApi = {
  list: (params?: Record<string, string>) => {
    const q = new URLSearchParams(params).toString()
    return request(`/api/assets${q ? `?${q}` : ''}`)
  },
  get: (id: string) => request(`/api/assets/${id}`),
  create: (data: Record<string, unknown>) => request('/api/assets', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => request(`/api/assets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/api/assets/${id}`, { method: 'DELETE' }),
}

// Categories
export const categoriesApi = {
  list: (search?: string) => request(`/api/categories${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  create: (data: { name: string; code: string; color?: string; icon?: string }) =>
    request('/api/categories', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => request(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/api/categories/${id}`, { method: 'DELETE' }),
}

// Locations
export const locationsApi = {
  list: (search?: string) => request(`/api/locations${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  create: (data: { name: string; code: string; address?: string; parentId?: string }) =>
    request('/api/locations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => request(`/api/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/api/locations/${id}`, { method: 'DELETE' }),
}

// Inventory
export const inventoryApi = {
  list: (params?: Record<string, string>) => {
    const q = new URLSearchParams(params).toString()
    return request(`/api/inventory${q ? `?${q}` : ''}`)
  },
  get: (id: string) => request(`/api/inventory/${id}`),
  create: (data: { name: string; locationId?: string; notes?: string }) =>
    request('/api/inventory', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    request(`/api/inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/api/inventory/${id}`, { method: 'DELETE' }),
  scan: (sessionId: string, qrCode: string) =>
    request('/api/inventory/scan', { method: 'POST', body: JSON.stringify({ sessionId, qrCode }) }),
  complete: (id: string) => request(`/api/inventory/${id}/complete`, { method: 'POST' }),
}

// Reports
export const reportsApi = {
  dashboard: () => request('/api/reports?type=dashboard'),
  byCategory: () => request('/api/reports?type=assets_by_category'),
  byLocation: () => request('/api/reports?type=assets_by_location'),
  discrepancies: () => request('/api/reports?type=discrepancies'),
  auditTrail: (params?: Record<string, string>) => {
    const q = new URLSearchParams(params).toString()
    return request(`/api/reports?type=audit_trail${q ? `&${q}` : ''}`)
  },
}

// Notifications
export const notificationsApi = {
  list: (params?: Record<string, string>) => {
    const q = new URLSearchParams(params).toString()
    return request(`/api/notifications${q ? `?${q}` : ''}`)
  },
  markRead: (id: string) => request(`/api/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => request('/api/notifications/read-all', { method: 'POST' }),
  unreadCount: () => request('/api/notifications/unread-count'),
}

// Maintenance
export const maintenanceApi = {
  list: (params?: Record<string, string>) => {
    const q = new URLSearchParams(params).toString()
    return request(`/api/maintenance${q ? `?${q}` : ''}`)
  },
  get: (id: string) => request(`/api/maintenance/${id}`),
  create: (data: Record<string, unknown>) => request('/api/maintenance', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => request(`/api/maintenance/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/api/maintenance/${id}`, { method: 'DELETE' }),
}

// Documents
export const documentsApi = {
  list: (assetId?: string) => request(`/api/documents${assetId ? `?assetId=${assetId}` : ''}`),
  upload: (formData: FormData) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('zeitgeist_token') : ''
    return fetch('/api/documents', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async (res) => {
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      return data
    })
  },
  delete: (id: string) => request(`/api/documents/${id}`, { method: 'DELETE' }),
}

// Depreciation
export const depreciationApi = {
  calculate: (params?: Record<string, string>) => {
    const q = new URLSearchParams(params).toString()
    return request(`/api/depreciation/calculate${q ? `?${q}` : ''}`)
  },
  history: (params?: Record<string, string>) => {
    const q = new URLSearchParams(params).toString()
    return request(`/api/depreciation/history${q ? `?${q}` : ''}`)
  },
}

// Tenant Settings
export const settingsApi = {
  get: () => request('/api/tenant-settings'),
  update: (data: Record<string, unknown>) => request('/api/tenant-settings', { method: 'PUT', body: JSON.stringify(data) }),
  updateBranding: (data: Record<string, unknown>) => request('/api/tenant-settings/branding', { method: 'PUT', body: JSON.stringify(data) }),
  updateWhatsApp: (data: Record<string, unknown>) => request('/api/tenant-settings/whatsapp', { method: 'PUT', body: JSON.stringify(data) }),
  updateAI: (data: Record<string, unknown>) => request('/api/tenant-settings/ai', { method: 'PUT', body: JSON.stringify(data) }),
}

// AI Assistant
export const aiApi = {
  chat: (message: string, context?: string) =>
    request('/api/ai/chat', { method: 'POST', body: JSON.stringify({ message, context }) }),
}

// Migration
export const migrationApi = {
  importCSV: (formData: FormData) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('zeitgeist_token') : ''
    return fetch('/api/migration/import', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async (res) => {
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      return data
    })
  },
  list: () => request('/api/migration'),
  rollback: (id: string) => request(`/api/migration/${id}/rollback`, { method: 'POST' }),
}

// Export
export const exportApi = {
  assets: (format?: string) => request(`/api/export/assets${format ? `?format=${format}` : ''}`),
  report: (type: string, format?: string) => request(`/api/export/report?type=${type}${format ? `&format=${format}` : ''}`),
}

// Sync
export const syncApi = {
  push: (operations: unknown[]) => request('/api/sync', { method: 'POST', body: JSON.stringify({ operations }) }),
  pull: () => request('/api/sync'),
}

// Seed uses /api/admin/quick-seed (protected by super admin JWT)

// QR Resolve
export const qrApi = {
  resolve: (code: string) => request(`/api/qr/${encodeURIComponent(code)}`),
}

// Search API
export const searchApi = {
  global: (q: string, types?: string) => {
    const params = new URLSearchParams({ q: q.length >= 2 ? q : '' })
    if (types) params.set('types', types)
    return request('/api/search?' + params.toString())
  },
}

// PDF Export API
export const exportPdfApi = {
  pdf: (type: string, params?: Record<string, string>) => {
    const searchParams = new URLSearchParams({ type, format: 'html', ...params })
    window.open(`/api/export/pdf?${searchParams.toString()}`, '_blank')
  },
}

// Warranty Alerts API
export const warrantyAlertsApi = {
  list: (days?: number) => request(`/api/assets/warranty-alerts?days=${days || 30}`),
}

// Asset Timeline API
export const assetTimelineApi = {
  get: (assetId: string, limit?: number, offset?: number) => {
    const params = new URLSearchParams()
    if (limit) params.set('limit', String(limit))
    if (offset) params.set('offset', String(offset))
    return request(`/api/assets/${assetId}/timeline?${params.toString()}`)
  },
}

// Checkouts API
export const checkoutsApi = {
  list: (params?: Record<string, string>) => request('/api/checkouts?' + new URLSearchParams(params || {}).toString()),
  create: (data: Record<string, unknown>) => request('/api/checkouts', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) => request(`/api/checkouts/${id}`),
  return: (id: string, data: Record<string, unknown>) => request(`/api/checkouts/${id}/return`, { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/api/checkouts/${id}`, { method: 'DELETE' }),
}

// Reservations API
export const reservationsApi = {
  list: (params?: Record<string, string>) => request('/api/reservations?' + new URLSearchParams(params || {}).toString()),
  create: (data: Record<string, unknown>) => request('/api/reservations', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) => request(`/api/reservations/${id}`),
  update: (id: string, data: Record<string, unknown>) => request(`/api/reservations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/api/reservations/${id}`, { method: 'DELETE' }),
  approve: (id: string, data?: Record<string, unknown>) => request(`/api/reservations/${id}/approve`, { method: 'POST', body: JSON.stringify(data || {}) }),
  reject: (id: string, data: Record<string, unknown>) => request(`/api/reservations/${id}/reject`, { method: 'POST', body: JSON.stringify(data) }),
  cancel: (id: string) => request(`/api/reservations/${id}/cancel`, { method: 'POST' }),
  fulfill: (id: string) => request(`/api/reservations/${id}/fulfill`, { method: 'POST' }),
  complete: (id: string) => request(`/api/reservations/${id}/complete`, { method: 'POST' }),
}

// Work Orders API
export const workOrdersApi = {
  list: (params?: Record<string, string>) => request('/api/work-orders?' + new URLSearchParams(params || {}).toString()),
  create: (data: Record<string, unknown>) => request('/api/work-orders', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) => request(`/api/work-orders/${id}`),
  update: (id: string, data: Record<string, unknown>) => request(`/api/work-orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/api/work-orders/${id}`, { method: 'DELETE' }),
  approve: (id: string, data?: Record<string, unknown>) => request(`/api/work-orders/${id}/approve`, { method: 'POST', body: JSON.stringify(data || {}) }),
  reject: (id: string, data: Record<string, unknown>) => request(`/api/work-orders/${id}/reject`, { method: 'POST', body: JSON.stringify(data) }),
  assign: (id: string, data: Record<string, unknown>) => request(`/api/work-orders/${id}/assign`, { method: 'POST', body: JSON.stringify(data) }),
  complete: (id: string) => request(`/api/work-orders/${id}/complete`, { method: 'POST' }),
  close: (id: string, data?: Record<string, unknown>) => request(`/api/work-orders/${id}/close`, { method: 'POST', body: JSON.stringify(data || {}) }),
  cancel: (id: string) => request(`/api/work-orders/${id}/cancel`, { method: 'POST' }),
}

// Users API
export const usersApi = {
  list: (params?: Record<string, string>) => request('/api/users?' + new URLSearchParams(params || {}).toString()),
  create: (data: Record<string, unknown>) => request('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) => request(`/api/users/${id}`),
  update: (id: string, data: Record<string, unknown>) => request(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/api/users/${id}`, { method: 'DELETE' }),
  resetPassword: (id: string, data: Record<string, unknown>) => request(`/api/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify(data) }),
}
