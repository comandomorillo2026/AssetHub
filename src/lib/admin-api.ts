import { useAppStore } from './store'

const ADMIN_TOKEN = 'zeitgeist-super-admin-2024'

function getSuperAdminToken(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('zeitgeist_super_token') || ADMIN_TOKEN
}

async function adminRequest(path: string, options: RequestInit = {}) {
  const token = getSuperAdminToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-super-admin-token': token,
    ...(options.headers as Record<string, string>),
  }

  const res = await fetch(`${path}`, { ...options, headers })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export const adminApi = {
  // Auth
  login: (email: string, password: string) =>
    adminRequest('/api/admin/auth', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  // Tenants
  listTenants: (params?: { search?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString()
    return adminRequest(`/api/admin/tenants${q ? `?${q}` : ''}`)
  },
  getTenant: (id: string) => adminRequest(`/api/admin/tenants/${id}`),
  createTenant: (data: Record<string, unknown>) =>
    adminRequest('/api/admin/tenants', { method: 'POST', body: JSON.stringify(data) }),
  updateTenant: (id: string, data: Record<string, unknown>) =>
    adminRequest(`/api/admin/tenants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleTenant: (id: string, isActive: boolean, reason?: string) =>
    adminRequest(`/api/admin/tenants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive, reason }),
    }),

  // Tenant History
  getTenantHistory: (id: string, params?: { type?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString()
    return adminRequest(`/api/admin/tenants/${id}/history${q ? `?${q}` : ''}`)
  },

  // Plans
  listPlans: () => adminRequest('/api/admin/plans'),
  createPlan: (data: Record<string, unknown>) =>
    adminRequest('/api/admin/plans', { method: 'POST', body: JSON.stringify(data) }),

  // Billing
  listSubscriptions: (status?: string) =>
    adminRequest(`/api/admin/billing${status ? `?status=${status}` : ''}`),
  recordPayment: (data: {
    tenantId: string
    amount: number
    method?: string
    reference?: string
    notes?: string
  }) =>
    adminRequest('/api/admin/billing', {
      method: 'POST',
      body: JSON.stringify({ action: 'record_payment', ...data }),
    }),
  generateInvoice: (data: { tenantId: string; amount: number; dueDays?: number }) =>
    adminRequest('/api/admin/billing', {
      method: 'POST',
      body: JSON.stringify({ action: 'generate_invoice', ...data }),
    }),

  // Accounting
  getAccounts: () => adminRequest('/api/admin/accounting'),
  getTrialBalance: () => adminRequest('/api/admin/accounting?type=trial_balance'),
  createJournalEntry: (data: Record<string, unknown>) =>
    adminRequest('/api/admin/accounting', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Dashboard
  getDashboard: () => adminRequest('/api/admin/dashboard'),

  // Seed
  seed: () => adminRequest('/api/admin/seed', { method: 'POST' }),
  reseedDemo: () => adminRequest('/api/admin/reseed-demo', { method: 'POST' }),
}
