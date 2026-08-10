import { useAppStore } from './store'

const BASE = ''

function getTenantId(): string {
  if (typeof window === 'undefined') return ''
  const stored = localStorage.getItem('zeitgeist_user')
  if (stored) {
    const user = JSON.parse(stored)
    return user.tenantId || ''
  }
  return ''
}

function getToken(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('zeitgeist_token') || ''
}

async function request(path: string, options: RequestInit = {}) {
  const tenantId = getTenantId()
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (tenantId) headers['x-tenant-id'] = tenantId
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch(`${BASE}${path}`, { ...options, headers })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  } catch (error) {
    // Queue for offline sync on network error
    if (error instanceof TypeError && error.message.includes('fetch')) {
      const store = useAppStore.getState()
      store.setOnlineStatus(false)
      // Store in offline queue
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
  register: (data: { tenantName: string; tenantSlug?: string; tenantType: string; name: string; email: string; password: string }) =>
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
}

// Locations
export const locationsApi = {
  list: (search?: string) => request(`/api/locations${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  create: (data: { name: string; code: string; address?: string; parentId?: string }) =>
    request('/api/locations', { method: 'POST', body: JSON.stringify(data) }),
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

// Sync
export const syncApi = {
  push: (operations: unknown[]) => request('/api/sync', { method: 'POST', body: JSON.stringify({ operations }) }),
  pull: () => request('/api/sync'),
}

// Seed
export const seedApi = {
  run: () => request('/api/seed', { method: 'POST' }),
}

// QR Resolve
export const qrApi = {
  resolve: (code: string) => request(`/api/qr/${encodeURIComponent(code)}`),
}
