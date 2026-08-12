'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  KeyRound,
  UserCog,
  EyeOff,
  Eye,
  Loader2,
  Check,
  X,
} from 'lucide-react'

import { useAppStore } from '@/lib/store'
import { usersApi } from '@/lib/api'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ─── Types ────────────────────────────────────────────────────────────────

interface TeamUser {
  id: string
  name: string
  email: string
  role: string
  phone?: string
  department?: string
  jobTitle?: string
  avatar?: string
  isActive: boolean
  lastLogin?: string
  createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  auditor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  user: 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400',
}

const AVATAR_COLORS = [
  'bg-teal-600', 'bg-violet-600', 'bg-rose-600', 'bg-amber-600', 'bg-sky-600',
  'bg-emerald-600', 'bg-fuchsia-600', 'bg-indigo-600', 'bg-orange-600', 'bg-cyan-600',
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function relativeDate(date: string | undefined | null): string {
  if (!date) return 'Never'
  const now = Date.now()
  const diff = now - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function validatePassword(pw: string): { valid: boolean; rules: { label: string; ok: boolean }[] } {
  const rules = [
    { label: 'At least 8 characters', ok: pw.length >= 8 },
    { label: 'One uppercase letter', ok: /[A-Z]/.test(pw) },
    { label: 'One lowercase letter', ok: /[a-z]/.test(pw) },
    { label: 'One number', ok: /[0-9]/.test(pw) },
    { label: 'One special character', ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw) },
  ]
  return { valid: rules.every((r) => r.ok), rules }
}

const fadeVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
}

// ─── Password Requirements Display ────────────────────────────────────────

function PasswordRules({ password }: { password: string }) {
  const { rules } = validatePassword(password)
  return (
    <div className="space-y-1.5 mt-2">
      {rules.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-xs">
          {r.ok ? (
            <Check className="size-3.5 text-emerald-500 shrink-0" />
          ) : (
            <X className="size-3.5 text-muted-foreground shrink-0" />
          )}
          <span className={r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
            {r.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// USERS VIEW
// ═══════════════════════════════════════════════════════════════════════════

export default function UsersView() {
  const user = useAppStore((s) => s.user)
  const refreshKey = useAppStore((s) => s.refreshKey)
  const isAdmin = user?.role === 'admin'

  // Data state
  const [users, setUsers] = useState<TeamUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 10

  // Filter state
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TeamUser | null>(null)
  const [resetTarget, setResetTarget] = useState<TeamUser | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<TeamUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TeamUser | null>(null)

  // Form state
  const [formLoading, setFormLoading] = useState(false)

  // Create form
  const [createName, setCreateName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRole, setCreateRole] = useState('user')
  const [createPhone, setCreatePhone] = useState('')
  const [createDept, setCreateDept] = useState('')
  const [createJobTitle, setCreateJobTitle] = useState('')
  const [showCreatePw, setShowCreatePw] = useState(false)

  // Edit form
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editDept, setEditDept] = useState('')
  const [editJobTitle, setEditJobTitle] = useState('')

  // Reset password form
  const [resetPw, setResetPw] = useState('')
  const [resetPwConfirm, setResetPwConfirm] = useState('')
  const [showResetPw, setShowResetPw] = useState(false)
  const [showResetPwConfirm, setShowResetPwConfirm] = useState(false)

  // Delete / deactivate state
  const [actionLoading, setActionLoading] = useState(false)

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(pageSize),
      }
      if (search) params.search = search
      if (filterRole) params.role = filterRole
      if (filterStatus) params.status = filterStatus

      const data = await usersApi.list(params)
      setUsers(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [])
      setTotal(data?.total ?? data?.data?.length ?? 0)
    } catch {
      toast.error('Failed to load team members')
    } finally {
      setLoading(false)
    }
  }, [page, search, filterRole, filterStatus, refreshKey])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // Reset page on filter changes
  useEffect(() => { setPage(1) }, [search, filterRole, filterStatus])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endIdx = Math.min(page * pageSize, total)

  // Filtered users for mobile cards
  const filteredUsers = useMemo(() => {
    return users
  }, [users])

  // ─── Create Handler ───────────────────────────────────────────────────
  const handleCreate = async () => {
    const { valid } = validatePassword(createPassword)
    if (!createName.trim() || !createEmail.trim()) {
      toast.error('Name and email are required')
      return
    }
    if (!valid) {
      toast.error('Password does not meet requirements')
      return
    }
    setFormLoading(true)
    try {
      await usersApi.create({
        name: createName,
        email: createEmail,
        password: createPassword,
        role: createRole,
        phone: createPhone || undefined,
        department: createDept || undefined,
        jobTitle: createJobTitle || undefined,
      })
      toast.success('Team member added successfully')
      setCreateOpen(false)
      resetCreateForm()
      fetchUsers()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setFormLoading(false)
    }
  }

  function resetCreateForm() {
    setCreateName('')
    setCreateEmail('')
    setCreatePassword('')
    setCreateRole('user')
    setCreatePhone('')
    setCreateDept('')
    setCreateJobTitle('')
    setShowCreatePw(false)
  }

  // ─── Edit Handler ─────────────────────────────────────────────────────
  const openEdit = (u: TeamUser) => {
    setEditTarget(u)
    setEditName(u.name)
    setEditEmail(u.email)
    setEditRole(u.role)
    setEditPhone(u.phone ?? '')
    setEditDept(u.department ?? '')
    setEditJobTitle(u.jobTitle ?? '')
  }

  const handleEdit = async () => {
    if (!editTarget) return
    if (!editName.trim() || !editEmail.trim()) {
      toast.error('Name and email are required')
      return
    }
    setFormLoading(true)
    try {
      await usersApi.update(editTarget.id, {
        name: editName,
        email: editEmail,
        role: editRole,
        phone: editPhone || undefined,
        department: editDept || undefined,
        jobTitle: editJobTitle || undefined,
      })
      toast.success('Team member updated')
      setEditTarget(null)
      fetchUsers()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setFormLoading(false)
    }
  }

  // ─── Reset Password Handler ──────────────────────────────────────────
  const handleResetPassword = async () => {
    if (!resetTarget) return
    const { valid } = validatePassword(resetPw)
    if (!valid) {
      toast.error('Password does not meet requirements')
      return
    }
    if (resetPw !== resetPwConfirm) {
      toast.error('Passwords do not match')
      return
    }
    setFormLoading(true)
    try {
      await usersApi.resetPassword(resetTarget.id, { password: resetPw })
      toast.success('Password reset successfully')
      setResetTarget(null)
      setResetPw('')
      setResetPwConfirm('')
      setShowResetPw(false)
      setShowResetPwConfirm(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setFormLoading(false)
    }
  }

  // ─── Deactivate / Activate Handler ────────────────────────────────────
  const handleToggleActive = async () => {
    if (!deactivateTarget) return
    setActionLoading(true)
    try {
      await usersApi.update(deactivateTarget.id, { isActive: !deactivateTarget.isActive })
      toast.success(deactivateTarget.isActive ? 'User deactivated' : 'User activated')
      setDeactivateTarget(null)
      fetchUsers()
    } catch {
      toast.error('Failed to update user status')
    } finally {
      setActionLoading(false)
    }
  }

  // ─── Delete Handler ───────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return
    setActionLoading(true)
    try {
      await usersApi.delete(deleteTarget.id)
      toast.success('Team member deleted')
      setDeleteTarget(null)
      fetchUsers()
    } catch {
      toast.error('Failed to delete team member')
    } finally {
      setActionLoading(false)
    }
  }

  // ─── Password validation for reset ────────────────────────────────────
  const resetPwValid = validatePassword(resetPw).valid
  const resetPwMatch = resetPw === resetPwConfirm && resetPw.length > 0
  const createPwValid = validatePassword(createPassword).valid

  return (
    <motion.div {...fadeVariants} transition={{ duration: 0.25 }} className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Team Members</h1>
          <Badge variant="secondary" className="text-xs font-medium tabular-nums">
            {total}
          </Badge>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreateOpen(true)} className="bg-teal-600 text-white hover:bg-teal-700">
            <Plus className="size-4" />
            Add Member
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={filterRole} onValueChange={(v) => setFilterRole(v === '_all' ? '' : v)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="auditor">Auditor</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v === '_all' ? '' : v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Desktop Table */}
      <Card className="overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[60px]">Avatar</TableHead>
                <TableHead className="min-w-[200px]">Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Job Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="w-[160px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Users className="size-10" />
                      <p className="text-sm font-medium">No team members found</p>
                      <p className="text-xs">Try adjusting your search or filters</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => (
                  <TableRow key={u.id} className="group">
                    <TableCell>
                      {u.avatar ? (
                        <img
                          src={u.avatar}
                          alt={u.name}
                          className="size-8 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className={`flex items-center justify-center size-8 rounded-full text-white text-xs font-semibold ${getAvatarColor(u.name)}`}
                        >
                          {getInitials(u.name)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-xs font-medium ${ROLE_COLORS[u.role] ?? ''}`}
                      >
                        {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{u.department ?? '—'}</TableCell>
                    <TableCell className="text-sm">{u.jobTitle ?? '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={u.isActive ? 'default' : 'secondary'}
                        className={`text-xs font-medium ${
                          u.isActive
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {relativeDate(u.lastLogin)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => openEdit(u)}
                        >
                          <Pencil className="size-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => {
                            setResetTarget(u)
                            setResetPw('')
                            setResetPwConfirm('')
                          }}
                        >
                          <KeyRound className="size-4" />
                          <span className="sr-only">Reset Password</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`size-8 ${u.isActive ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30' : 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'}`}
                          onClick={() => setDeactivateTarget(u)}
                        >
                          <UserCog className="size-4" />
                          <span className="sr-only">{u.isActive ? 'Deactivate' : 'Activate'}</span>
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                            onClick={() => setDeleteTarget(u)}
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-medium">{startIdx}</span>-<span className="font-medium">{endIdx}</span> of{' '}
              <span className="font-medium">{total}</span>
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="px-2 text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            </Card>
          ))
        ) : filteredUsers.length === 0 ? (
          <Card className="p-8 text-center">
            <Users className="size-10 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium mt-2">No team members found</p>
          </Card>
        ) : (
          filteredUsers.map((u) => (
            <Card key={u.id} className="p-4">
              <div className="flex items-center gap-3">
                {u.avatar ? (
                  <img src={u.avatar} alt={u.name} className="size-10 rounded-full object-cover" />
                ) : (
                  <div
                    className={`flex items-center justify-center size-10 rounded-full text-white text-sm font-semibold ${getAvatarColor(u.name)}`}
                  >
                    {getInitials(u.name)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{u.name}</span>
                    <Badge
                      variant={u.isActive ? 'default' : 'secondary'}
                      className={`text-[10px] font-medium shrink-0 ${
                        u.isActive
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400'
                      }`}
                    >
                      {u.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="secondary"
                      className={`text-[10px] ${ROLE_COLORS[u.role] ?? ''}`}
                    >
                      {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                    </Badge>
                    {u.jobTitle && (
                      <span className="text-xs text-muted-foreground">{u.jobTitle}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3 pt-3 border-t justify-end">
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => openEdit(u)}>
                  <Pencil className="size-3 mr-1" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    setResetTarget(u)
                    setResetPw('')
                    setResetPwConfirm('')
                  }}
                >
                  <KeyRound className="size-3 mr-1" /> Reset PW
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`text-xs h-7 ${u.isActive ? 'text-amber-600' : 'text-emerald-600'}`}
                  onClick={() => setDeactivateTarget(u)}
                >
                  <UserCog className="size-3 mr-1" /> {u.isActive ? 'Deactivate' : 'Activate'}
                </Button>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 text-red-500"
                    onClick={() => setDeleteTarget(u)}
                  >
                    <Trash2 className="size-3 mr-1" /> Delete
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}

        {/* Mobile Pagination */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* ═══ Create User Dialog ═══ */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) { setCreateOpen(false); resetCreateForm() } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>Create a new account for a team member.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-name">Name <span className="text-red-500">*</span></Label>
                <Input
                  id="create-name"
                  placeholder="Full name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-email">Email <span className="text-red-500">*</span></Label>
                <Input
                  id="create-email"
                  type="email"
                  placeholder="email@company.com"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Password <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input
                  id="create-password"
                  type={showCreatePw ? 'text' : 'password'}
                  placeholder="Secure password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 size-7"
                  onClick={() => setShowCreatePw(!showCreatePw)}
                >
                  {showCreatePw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
              <PasswordRules password={createPassword} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={createRole} onValueChange={setCreateRole}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="auditor">Auditor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-phone">Phone</Label>
                <Input
                  id="create-phone"
                  placeholder="Phone number"
                  value={createPhone}
                  onChange={(e) => setCreatePhone(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-dept">Department</Label>
                <Input
                  id="create-dept"
                  placeholder="Department"
                  value={createDept}
                  onChange={(e) => setCreateDept(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-jobtitle">Job Title</Label>
                <Input
                  id="create-jobtitle"
                  placeholder="Job title"
                  value={createJobTitle}
                  onChange={(e) => setCreateJobTitle(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetCreateForm() }} disabled={formLoading}>
              Cancel
            </Button>
            <Button
              className="bg-teal-600 text-white hover:bg-teal-700"
              onClick={handleCreate}
              disabled={formLoading || !createPwValid || !createName.trim() || !createEmail.trim()}
            >
              {formLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
              Create Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Edit User Dialog ═══ */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>Update {editTarget?.name}&apos;s information.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name <span className="text-red-500">*</span></Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email <span className="text-red-500">*</span></Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="auditor">Auditor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-dept">Department</Label>
                <Input
                  id="edit-dept"
                  value={editDept}
                  onChange={(e) => setEditDept(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-jobtitle">Job Title</Label>
                <Input
                  id="edit-jobtitle"
                  value={editJobTitle}
                  onChange={(e) => setEditJobTitle(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={formLoading}>
              Cancel
            </Button>
            <Button
              className="bg-teal-600 text-white hover:bg-teal-700"
              onClick={handleEdit}
              disabled={formLoading || !editName.trim() || !editEmail.trim()}
            >
              {formLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Reset Password Dialog ═══ */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => { if (!open) { setResetTarget(null); setResetPw(''); setResetPwConfirm('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for <strong>{resetTarget?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reset-pw">New Password</Label>
              <div className="relative">
                <Input
                  id="reset-pw"
                  type={showResetPw ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={resetPw}
                  onChange={(e) => setResetPw(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 size-7"
                  onClick={() => setShowResetPw(!showResetPw)}
                >
                  {showResetPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
              <PasswordRules password={resetPw} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-pw-confirm">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="reset-pw-confirm"
                  type={showResetPwConfirm ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={resetPwConfirm}
                  onChange={(e) => setResetPwConfirm(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 size-7"
                  onClick={() => setShowResetPwConfirm(!showResetPwConfirm)}
                >
                  {showResetPwConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
              {resetPwConfirm.length > 0 && !resetPwMatch && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
              {resetPwConfirm.length > 0 && resetPwMatch && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Passwords match</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetTarget(null); setResetPw(''); setResetPwConfirm('') }} disabled={formLoading}>
              Cancel
            </Button>
            <Button
              className="bg-teal-600 text-white hover:bg-teal-700"
              onClick={handleResetPassword}
              disabled={formLoading || !resetPwValid || !resetPwMatch}
            >
              {formLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Deactivate / Activate Alert ═══ */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={(open) => { if (!open) setDeactivateTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deactivateTarget?.isActive ? 'Deactivate' : 'Activate'} Team Member
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {deactivateTarget?.isActive ? 'deactivate' : 'activate'}{' '}
              <strong>{deactivateTarget?.name}</strong>?
              {deactivateTarget?.isActive && ' They will no longer be able to log in.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleActive}
              disabled={actionLoading}
              className={deactivateTarget?.isActive
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }
            >
              {actionLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
              {deactivateTarget?.isActive ? 'Deactivate' : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ Delete Alert ═══ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This is a soft delete — their data
              will be retained but the account will be permanently deactivated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={actionLoading}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {actionLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
