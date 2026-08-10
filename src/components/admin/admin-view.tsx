'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Building2, CreditCard, BookOpen, Settings, LogOut, ChevronLeft,
  Eye, EyeOff, Loader2, Shield, ArrowRight, Users, TrendingUp, AlertTriangle,
  DollarSign, Package, Activity, BarChart3, ChevronDown, Search,
  Phone, Mail, MapPin, Calendar, BadgeCheck, XCircle, CheckCircle2,
  FileText, Receipt, Clock, ArrowLeft, Plus, RefreshCw, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAppStore, type View } from '@/lib/store'
import { adminApi } from '@/lib/admin-api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

// ─── Colors ───
const GOLD = '#d97706'
const GOLD_LIGHT = '#f59e0b'
const GOLD_BG = '#f59e0b15'
const SIDEBAR_BG = '#1c1917' // stone-900

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

// ─── Admin Login View ───
function AdminLoginView() {
  const [email, setEmail] = useState('admin@zeitgeist.co')
  const [password, setPassword] = useState('super2024')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const setSuperAuth = useAppStore((s) => s.setSuperAuth)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await adminApi.login(email, password)
      setSuperAuth(res.user, res.token)
      toast.success('Welcome, Super Admin!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-amber-50/40 px-4 py-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-amber-100/40 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-orange-100/30 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.1 }} className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-600 text-white mb-4 shadow-lg shadow-amber-700/20">
            <Shield className="w-9 h-9" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Super Admin</h1>
          <p className="text-sm text-slate-500 mt-1">AssetHub by Zeitgeist Business Solution</p>
        </motion.div>

        <Card className="border-slate-200/80 shadow-xl shadow-slate-200/50">
          <CardHeader className="pb-2 pt-6 px-6">
            <h2 className="text-xl font-semibold text-slate-900">Admin Sign In</h2>
            <p className="text-sm text-slate-500">Access the management portal</p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email" className="text-sm font-medium text-slate-700">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 bg-white border-slate-300 focus:border-amber-500 focus:ring-amber-500/20"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password" className="text-sm font-medium text-slate-700">Password</Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 bg-white border-slate-300 pr-10 focus:border-amber-500 focus:ring-amber-500/20"
                    disabled={loading}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-lg shadow-amber-700/20 mt-2">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in...</> : <>Sign In <ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100">
              <p className="text-sm text-center text-slate-500">
                Return to{' '}
                <button
                  type="button"
                  onClick={() => useAppStore.getState().superLogout()}
                  className="text-amber-600 hover:text-amber-700 font-semibold inline-flex items-center gap-1"
                >
                  Tenant Login <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// ─── Admin Sidebar ───
const ADMIN_NAV: { view: View; label: string; icon: React.ElementType }[] = [
  { view: 'super-admin', label: 'Overview', icon: LayoutDashboard },
  { view: 'super-admin', label: 'Tenants', icon: Building2 },
  { view: 'super-admin', label: 'Plans', icon: CreditCard },
  { view: 'super-admin', label: 'Accounting', icon: BookOpen },
  { view: 'super-admin', label: 'Settings', icon: Settings },
]

function AdminSidebar({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  const superAdmin = useAppStore((s) => s.superAdmin)
  const superLogout = useAppStore((s) => s.superLogout)

  return (
    <div className="flex flex-col h-full bg-stone-900 w-60 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5 shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-600 text-white shrink-0">
          <Shield className="w-5 h-5" strokeWidth={2} />
        </div>
        <div className="overflow-hidden">
          <h2 className="text-sm font-bold text-white tracking-tight leading-tight">AssetHub</h2>
          <p className="text-[10px] text-amber-400 leading-tight font-medium">Super Admin</p>
        </div>
      </div>

      <Separator className="bg-stone-700/50" />

      {/* Nav */}
      <ScrollArea className="flex-1 py-3 px-2">
        <nav className="space-y-1">
          {ADMIN_NAV.map((item) => {
            const isActive = activeTab === item.label
            const Icon = item.icon
            return (
              <button
                key={item.label}
                onClick={() => onTabChange(item.label)}
                className={
                  'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 relative ' +
                  (isActive ? 'bg-amber-600/15 text-amber-400' : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200')
                }
              >
                {isActive && (
                  <motion.div
                    layoutId="admin-sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-amber-600"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-amber-400' : 'text-stone-500 group-hover:text-stone-300'}`} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </ScrollArea>

      <div className="shrink-0">
        <Separator className="bg-stone-700/50" />
        <div className="px-3 py-3">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8 border-2 border-stone-700">
              <AvatarFallback className="bg-amber-600/20 text-amber-400 text-xs font-semibold">
                {superAdmin ? superAdmin.name.split(' ').map(w => w[0]).slice(0, 2).join('') : '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-200 truncate">{superAdmin?.name || 'Admin'}</p>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-medium border-amber-600/40 text-amber-400 bg-amber-600/10">
                Super Admin
              </Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={superLogout} className="h-8 w-8 text-stone-500 hover:text-red-400 hover:bg-stone-800 shrink-0" title="Sign out">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Overview Tab ───
function OverviewTab() {
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminApi.getDashboard()
      setDashboardData(data)
    } catch (err) {
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  if (loading || !dashboardData) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    )
  }

  const { stats, planDistribution, revenueChart, recentSignups, overduePayments } = dashboardData

  const statCards = [
    { label: 'Total Tenants', value: stats.totalTenants, icon: Building2, color: 'text-slate-600', bg: 'bg-slate-100' },
    { label: 'Active', value: stats.activeTenants, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'Monthly Revenue', value: `$${stats.mrr.toLocaleString()} TTD`, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-100' },
    { label: 'Overdue Invoices', value: stats.overdueCount, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
  ]

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="border-slate-200/80 hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 font-medium">{card.label}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{card.value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center`}>
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-2">
          <Card className="border-slate-200/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Revenue (Last 6 Months)</CardTitle>
              <CardDescription>Revenue from completed payments in TTD</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [`$${value.toLocaleString()} TTD`, 'Revenue']}
                    />
                    <Bar dataKey="revenue" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Plan Distribution */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="border-slate-200/80 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Plan Distribution</CardTitle>
              <CardDescription>Tenants per plan</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planDistribution}
                      dataKey="subscriberCount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={false}
                    >
                      {planDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Signups */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="border-slate-200/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Signups</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSignups.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-slate-400 py-8">No tenants yet</TableCell></TableRow>
                  )}
                  {recentSignups.map((t: any) => (
                    <TableRow key={t.id} className="cursor-pointer hover:bg-slate-50" onClick={() => {
                      useAppStore.getState().setAdminSelectedTenantId(t.id)
                      useAppStore.getState().navigate('admin-tenant-detail')
                    }}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs capitalize">{t.type}</Badge></TableCell>
                      <TableCell className="text-sm text-slate-500">{t.subscription?.plan?.name || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={t.isActive ? 'default' : 'secondary'} className={`text-xs ${t.isActive ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-slate-100 text-slate-500 border-0'}`}>
                          {t.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>

        {/* Overdue Payments */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card className="border-slate-200/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Overdue / Pending Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {overduePayments.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-8">All payments are up to date</p>
                )}
                {overduePayments.map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{inv.invoiceNumber}</p>
                      <p className="text-xs text-slate-500">{inv.tenant?.name} • Due: {new Date(inv.dueAt).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">${inv.amount.toLocaleString()} TTD</p>
                      <Badge variant={inv.status === 'overdue' ? 'destructive' : 'secondary'} className="text-[10px]">
                        {inv.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <Card className="border-slate-200/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" onClick={async () => {
                try {
                  const res = await adminApi.seed()
                  toast.success('Seed completed: ' + res.message)
                  loadDashboard()
                } catch { toast.error('Seed failed') }
              }} className="text-amber-700 border-amber-200 hover:bg-amber-50">
                <RefreshCw className="w-4 h-4 mr-2" /> Seed Admin Data
              </Button>
              <Button variant="outline" size="sm" onClick={async () => {
                try {
                  const res = await adminApi.reseedDemo()
                  toast.success('Reseed completed: ' + res.message)
                  loadDashboard()
                } catch { toast.error('Reseed failed') }
              }} className="text-amber-700 border-amber-200 hover:bg-amber-50">
                <RefreshCw className="w-4 h-4 mr-2" /> Reseed Demo Data
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// ─── Tenants Tab ───
function TenantsTab() {
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const loadTenants = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminApi.listTenants({ search })
      setTenants(data.tenants || [])
    } catch {
      toast.error('Failed to load tenants')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { loadTenants() }, [loadTenants])

  const navigate = useAppStore((s) => s.navigate)
  const setAdminSelectedTenantId = useAppStore((s) => s.setAdminSelectedTenantId)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-white border-slate-200"
          />
        </div>
        <Button onClick={loadTenants} variant="outline" size="icon" className="h-10 w-10">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Card className="border-slate-200/80">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Users</TableHead>
                <TableHead className="text-right">Assets</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && [1, 2, 3].map(i => (
                <TableRow key={i}>
                  <TableCell colSpan={7}><Skeleton className="h-10 w-full" /></TableCell>
                </TableRow>
              ))}
              {!loading && tenants.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-slate-400 py-12">No tenants found</TableCell></TableRow>
              )}
              {!loading && tenants.map((t: any) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer hover:bg-amber-50/50 transition-colors"
                  onClick={() => {
                    setAdminSelectedTenantId(t.id)
                    navigate('admin-tenant-detail')
                  }}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-900">{t.name}</p>
                      <p className="text-xs text-slate-500">{t.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs capitalize">{t.type}</Badge></TableCell>
                  <TableCell className="text-sm">{t.subscription?.plan?.name || '—'}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs border-0 ${t.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {t.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{t._count?.users || 0}</TableCell>
                  <TableCell className="text-right font-medium">{t._count?.assets || 0}</TableCell>
                  <TableCell className="text-sm text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Plans Tab ───
function PlansTab() {
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const data = await adminApi.listPlans()
        setPlans(data.plans || [])
      } catch {
        toast.error('Failed to load plans')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading && [1, 2, 3].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        {!loading && plans.map((plan: any, idx: number) => (
          <motion.div key={plan.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}>
            <Card className="border-slate-200/80 hover:shadow-md transition-shadow h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
                    {plan._count?.subscriptions || 0} tenants
                  </Badge>
                </div>
                <CardDescription className="text-xs uppercase tracking-wider text-slate-400">{plan.slug}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-slate-900">${plan.priceMonthly.toLocaleString()}</span>
                  <span className="text-sm text-slate-500 ml-1">TTD/mo</span>
                  {plan.priceYearly && (
                    <p className="text-xs text-emerald-600 mt-1">${plan.priceYearly.toLocaleString()} TTD/year (save 17%)</p>
                  )}
                </div>
                <Separator className="my-4" />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Max Assets</span>
                    <span className="font-medium">{plan.maxAssets.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Max Users</span>
                    <span className="font-medium">{plan.maxUsers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Max Locations</span>
                    <span className="font-medium">{plan.maxLocations}</span>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="space-y-1.5">
                  {JSON.parse(plan.features || '[]').map((f: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ─── Accounting Tab ───
function AccountingTab() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [journalEntries, setJournalEntries] = useState<any[]>([])
  const [trialBalance, setTrialBalance] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('accounts')

  useEffect(() => {
    (async () => {
      try {
        const [acctData, tbData] = await Promise.all([
          adminApi.getAccounts(),
          adminApi.getTrialBalance(),
        ])
        setAccounts(acctData.accounts || [])
        setJournalEntries(acctData.journalEntries || [])
        setTrialBalance(tbData)
      } catch {
        toast.error('Failed to load accounting data')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const typeColors: Record<string, string> = {
    asset: 'bg-blue-100 text-blue-700',
    liability: 'bg-red-100 text-red-700',
    equity: 'bg-purple-100 text-purple-700',
    revenue: 'bg-emerald-100 text-emerald-700',
    expense: 'bg-orange-100 text-orange-700',
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="accounts">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="journal">Journal Entries</TabsTrigger>
          <TabsTrigger value="trial">Trial Balance</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-4">
          <Card className="border-slate-200/80">
            <CardHeader><CardTitle className="text-base">Chart of Accounts</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono font-medium">{a.code}</TableCell>
                      <TableCell>{a.name}</TableCell>
                      <TableCell><Badge className={`text-xs border-0 ${typeColors[a.accountType] || 'bg-slate-100'}`}>{a.accountType}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={a.isActive ? 'default' : 'secondary'} className={`text-xs border-0 ${a.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {a.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="journal" className="mt-4">
          <Card className="border-slate-200/80">
            <CardHeader><CardTitle className="text-base">Journal Entries</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {journalEntries.map((je: any) => (
                  <div key={je.id} className="p-4 rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="font-mono text-sm font-medium text-slate-900">{je.number}</span>
                        <Badge variant={je.status === 'posted' ? 'default' : 'secondary'} className={`ml-2 text-xs border-0 ${je.status === 'posted' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {je.status}
                        </Badge>
                      </div>
                      <span className="text-xs text-slate-400">{new Date(je.date).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-slate-700 mb-3">{je.description}</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {je.entries.map((e: any) => (
                          <TableRow key={e.id}>
                            <TableCell className="text-sm">{e.ledgerAccount.code} - {e.ledgerAccount.name}</TableCell>
                            <TableCell className="text-right font-mono">{e.debit > 0 ? e.debit.toFixed(2) : ''}</TableCell>
                            <TableCell className="text-right font-mono">{e.credit > 0 ? e.credit.toFixed(2) : ''}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trial" className="mt-4">
          <Card className="border-slate-200/80">
            <CardHeader>
              <CardTitle className="text-base">Trial Balance</CardTitle>
              {trialBalance && (
                <CardDescription className="flex items-center gap-2">
                  {trialBalance.balanced ? (
                    <><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Balanced</>
                  ) : (
                    <><AlertTriangle className="w-4 h-4 text-red-500" /> Out of Balance</>
                  )}
                  {trialBalance.balanced && (
                    <span className="text-xs text-slate-400">Debits: ${trialBalance.totalDebits.toFixed(2)} = Credits: ${trialBalance.totalCredits.toFixed(2)}</span>
                  )}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trialBalance?.trialBalance?.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono">{a.code}</TableCell>
                      <TableCell>{a.name}</TableCell>
                      <TableCell><Badge className={`text-xs border-0 ${typeColors[a.accountType] || ''}`}>{a.accountType}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{a.debitBalance > 0 ? a.debitBalance.toFixed(2) : ''}</TableCell>
                      <TableCell className="text-right font-mono">{a.creditBalance > 0 ? a.creditBalance.toFixed(2) : ''}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{a.balance.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Settings Tab ───
function SettingsTab() {
  const superAdmin = useAppStore((s) => s.superAdmin)

  return (
    <div className="space-y-6">
      <Card className="border-slate-200/80">
        <CardHeader>
          <CardTitle className="text-base">Admin Profile</CardTitle>
          <CardDescription>Super administrator account information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-slate-500">Name</Label>
              <p className="text-sm font-medium text-slate-900 mt-1">{superAdmin?.name}</p>
            </div>
            <div>
              <Label className="text-sm text-slate-500">Email</Label>
              <p className="text-sm font-medium text-slate-900 mt-1">{superAdmin?.email}</p>
            </div>
            <Separator />
            <div className="pt-2">
              <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => {
                useAppStore.getState().superLogout()
                toast.success('Signed out')
              }}>
                <LogOut className="w-4 h-4 mr-2" /> Sign Out
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Tenant Detail View ───
function TenantDetailView() {
  const tenantId = useAppStore((s) => s.adminSelectedTenantId)
  const navigate = useAppStore((s) => s.navigate)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'bank_transfer', reference: '', notes: '' })

  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const data = await adminApi.getTenant(tenantId)
      setData(data)
    } catch {
      toast.error('Failed to load tenant details')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { loadData() }, [loadData])

  const handleToggleActive = async () => {
    if (!data?.tenant) return
    try {
      await adminApi.toggleTenant(tenantId!, !data.tenant.isActive)
      toast.success(`Tenant ${!data.tenant.isActive ? 'activated' : 'deactivated'}`)
      loadData()
    } catch {
      toast.error('Failed to toggle tenant status')
    }
  }

  const handleRecordPayment = async () => {
    if (!paymentForm.amount || !tenantId) {
      toast.error('Amount is required')
      return
    }
    try {
      await adminApi.recordPayment({
        tenantId,
        amount: parseFloat(paymentForm.amount),
        method: paymentForm.method,
        reference: paymentForm.reference,
        notes: paymentForm.notes,
      })
      toast.success('Payment recorded successfully')
      setRecordPaymentOpen(false)
      setPaymentForm({ amount: '', method: 'bank_transfer', reference: '', notes: '' })
      loadData()
    } catch {
      toast.error('Failed to record payment')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!data?.tenant) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Tenant not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('super-admin')}>Back to Overview</Button>
      </div>
    )
  }

  const t = data.tenant
  const sub = t.subscription
  const plan = sub?.plan

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('super-admin')} className="h-9 w-9">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{t.name}</h1>
              <Badge variant="outline" className="text-xs capitalize">{t.type}</Badge>
              <Badge className={`text-xs border-0 ${t.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {t.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{t.slug} • Created {new Date(t.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleToggleActive}>
            {t.isActive ? <><ToggleRight className="w-4 h-4 mr-1" /> Deactivate</> : <><ToggleLeft className="w-4 h-4 mr-1" /> Activate</>}
          </Button>
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => setRecordPaymentOpen(true)}>
            <DollarSign className="w-4 h-4 mr-1" /> Record Payment
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Contact Card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-slate-200/80 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" /> Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {t.contactName && (
                <div className="flex items-center gap-2 text-sm">
                  <BadgeCheck className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">{t.contactName}</span>
                </div>
              )}
              {t.contactEmail && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <a href={`mailto:${t.contactEmail}`} className="text-amber-600 hover:underline">{t.contactEmail}</a>
                </div>
              )}
              {t.contactPhone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">{t.contactPhone}</span>
                </div>
              )}
              {t.address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <span className="text-slate-700">{t.address}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Subscription Card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-slate-200/80 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-400" /> Subscription
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sub ? (
                <>
                  <div>
                    <p className="text-lg font-bold text-slate-900">{plan?.name || 'No Plan'}</p>
                    <p className="text-sm text-slate-500">
                      ${plan?.priceMonthly?.toLocaleString() || 0} TTD / {sub.billingCycle}
                    </p>
                  </div>
                  <Badge className={`text-xs border-0 ${
                    sub.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                    sub.status === 'past_due' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {sub.status === 'past_due' ? 'Past Due' : sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                  </Badge>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Period Start</span>
                      <span>{new Date(sub.currentPeriodStart).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Period End</span>
                      <span>{new Date(sub.currentPeriodEnd).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Next Billing</span>
                      <span>{new Date(sub.nextBillingDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400">No subscription</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Asset Stats Card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-slate-200/80 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-400" /> Asset Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 text-center">
                  <p className="text-2xl font-bold text-slate-900">{t._count?.assets || 0}</p>
                  <p className="text-xs text-slate-500">Total Assets</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 text-center">
                  <p className="text-2xl font-bold text-slate-900">{t._count?.users || 0}</p>
                  <p className="text-xs text-slate-500">Users</p>
                </div>
              </div>
              {data.assetStats?.byStatus && data.assetStats.byStatus.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">By Status</p>
                  {data.assetStats.byStatus.map((s: any) => (
                    <div key={s.status} className="flex justify-between text-sm">
                      <span className="capitalize text-slate-600">{s.status}</span>
                      <span className="font-medium">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Payment History & Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payments */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="border-slate-200/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-400" /> Payment History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!t.payments || t.payments.length === 0) && (
                    <TableRow><TableCell colSpan={4} className="text-center text-slate-400 py-8">No payments yet</TableCell></TableRow>
                  )}
                  {t.payments?.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">${p.amount.toLocaleString()} TTD</TableCell>
                      <TableCell className="text-sm capitalize">{p.method.replace('_', ' ')}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs border-0 ${
                          p.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          p.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>

        {/* Invoices */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="border-slate-200/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" /> Invoices
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!t.invoices || t.invoices.length === 0) && (
                    <TableRow><TableCell colSpan={4} className="text-center text-slate-400 py-8">No invoices yet</TableCell></TableRow>
                  )}
                  {t.invoices?.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-sm font-medium">{inv.invoiceNumber}</TableCell>
                      <TableCell className="font-medium">${inv.amount.toLocaleString()} TTD</TableCell>
                      <TableCell>
                        <Badge className={`text-xs border-0 ${
                          inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                          inv.status === 'overdue' ? 'bg-red-100 text-red-700' :
                          inv.status === 'cancelled' ? 'bg-slate-200 text-slate-500' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">{new Date(inv.dueAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Activity Timeline */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <Card className="border-slate-200/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" /> Activity Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {(!data.recentLogs || data.recentLogs.length === 0) && (
                <p className="text-sm text-slate-400 text-center py-8">No activity recorded</p>
              )}
              {data.recentLogs?.map((log: any) => (
                <div key={log.id} className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-amber-400 mt-2 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-900 capitalize">{log.action.replace(/_/g, ' ')}</p>
                      <span className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    {log.details && <p className="text-xs text-slate-500 mt-0.5">{log.details}</p>}
                    {log.user && <p className="text-xs text-slate-400 mt-0.5">by {log.user.name}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Record Payment Dialog */}
      <Dialog open={recordPaymentOpen} onOpenChange={setRecordPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>Record a new payment for {t.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (TTD)</Label>
              <Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentForm.method} onValueChange={(v) => setPaymentForm({ ...paymentForm, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} placeholder="Bank reference or receipt number" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordPaymentOpen(false)}>Cancel</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleRecordPayment}>Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Main Admin View ───
export default function AdminView() {
  const currentView = useAppStore((s) => s.currentView)
  const isSuperAdmin = useAppStore((s) => s.isSuperAdmin)
  const [adminTab, setAdminTab] = useState('Overview')
  const initializedRef = useRef(false)

  // Restore super admin session from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && !initializedRef.current) {
      initializedRef.current = true
      const storedAdmin = localStorage.getItem('zeitgeist_super_admin')
      const storedToken = localStorage.getItem('zeitgeist_super_token')
      if (storedAdmin && storedToken) {
        try {
          const admin = JSON.parse(storedAdmin)
          useAppStore.getState().setSuperAuth(admin, storedToken)
        } catch {
          localStorage.removeItem('zeitgeist_super_admin')
          localStorage.removeItem('zeitgeist_super_token')
        }
      }
    }
  }, [])

  // If not a super admin view, return null
  if (currentView !== 'super-admin' && currentView !== 'admin-tenant-detail') {
    return null
  }

  // Show login if not authenticated as super admin
  if (!isSuperAdmin) {
    return <AdminLoginView />
  }

  // Tenant Detail View
  if (currentView === 'admin-tenant-detail') {
    return (
      <div className="min-h-screen flex bg-slate-50">
        <div className="hidden lg:flex">
          <AdminSidebar activeTab="Tenants" onTabChange={(tab) => { setAdminTab(tab); useAppStore.getState().navigate('super-admin') }} />
        </div>
        <div className="flex-1 min-w-0">
          <header className="h-14 border-b border-slate-200 bg-white flex items-center px-4 sm:px-6 shrink-0">
            <div className="flex items-center gap-3">
              <div className="lg:hidden">
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => useAppStore.getState().navigate('super-admin')}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </div>
              <h1 className="text-sm font-semibold text-slate-900">Tenant Details</h1>
            </div>
          </header>
          <main className="p-4 sm:p-6 lg:p-8">
            <TenantDetailView />
          </main>
        </div>
      </div>
    )
  }

  // Super Admin Dashboard
  return (
    <div className="min-h-screen flex bg-slate-50">
      <div className="hidden lg:flex">
        <AdminSidebar activeTab={adminTab} onTabChange={setAdminTab} />
      </div>
      <div className="flex-1 min-w-0">
        <header className="h-14 border-b border-slate-200 bg-white flex items-center px-4 sm:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-slate-900">
              Super Admin {adminTab !== 'Overview' && `— ${adminTab}`}
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* Mobile nav */}
            <div className="lg:hidden">
              <Select value={adminTab} onValueChange={setAdminTab}>
                <SelectTrigger className="h-9 w-auto text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ADMIN_NAV.map(item => (
                    <SelectItem key={item.label} value={item.label}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={adminTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {adminTab === 'Overview' && <OverviewTab />}
              {adminTab === 'Tenants' && <TenantsTab />}
              {adminTab === 'Plans' && <PlansTab />}
              {adminTab === 'Accounting' && <AccountingTab />}
              {adminTab === 'Settings' && <SettingsTab />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
