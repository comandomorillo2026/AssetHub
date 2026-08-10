'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Shield, Eye, EyeOff, Loader2, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { authApi } from '@/lib/api'
import { useAppStore } from '@/lib/store'

const ORG_TYPES = [
  { value: 'Government', label: 'Government' },
  { value: 'Private', label: 'Private' },
  { value: 'Education', label: 'Education' },
  { value: 'Insurance', label: 'Insurance' },
  { value: 'Credit Union', label: 'Credit Union' },
]

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function RegisterView() {
  const navigate = useAppStore((s) => s.navigate)
  const setAuth = useAppStore((s) => s.setAuth)

  const [tenantName, setTenantName] = useState('')
  const [tenantSlug, setTenantSlug] = useState('')
  const [tenantType, setTenantType] = useState('')
  const [country, setCountry] = useState('Trinidad and Tobago')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const autoSlug = useMemo(() => {
    return tenantName ? slugify(tenantName) : ''
  }, [tenantName])

  const handleTenantNameChange = useCallback((value: string) => {
    setTenantName(value)
    if (!tenantSlug || slugify(value) === tenantSlug) {
      setTenantSlug(slugify(value))
    }
  }, [tenantSlug])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!tenantName.trim()) {
      toast.error('Organization name is required')
      return
    }
    if (!tenantSlug.trim()) {
      toast.error('Organization slug is required')
      return
    }
    if (!tenantType) {
      toast.error('Please select an organization type')
      return
    }
    if (!fullName.trim()) {
      toast.error('Full name is required')
      return
    }
    if (!email.trim()) {
      toast.error('Email is required')
      return
    }
    if (!password.trim()) {
      toast.error('Password is required')
      return
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const res = await authApi.register({
        tenantName,
        tenantSlug,
        tenantType,
        name: fullName,
        email,
        password,
      })
      // Auto-login on success
      setAuth(res.user, res.token)
      toast.success('Organization created successfully!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed. Please try again.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-teal-50/40 px-4 py-8">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-teal-100/40 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-emerald-100/30 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-lg relative z-10"
      >
        {/* Brand Area */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-center mb-6"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0f766e] text-white mb-3 shadow-lg shadow-teal-700/20">
            <Shield className="w-8 h-8" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Create Your Organization
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Set up your AssetHub workspace in minutes
          </p>
        </motion.div>

        {/* Register Card */}
        <Card className="border-slate-200/80 shadow-xl shadow-slate-200/50">
          <CardContent className="px-6 py-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Organization Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#0f766e]" />
                  <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                    Organization Details
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tenantName" className="text-sm font-medium text-slate-700">
                      Organization Name
                    </Label>
                    <Input
                      id="tenantName"
                      type="text"
                      placeholder="e.g. Acme Corporation"
                      value={tenantName}
                      onChange={(e) => handleTenantNameChange(e.target.value)}
                      className="h-11 bg-white border-slate-300 focus:border-[#0f766e] focus:ring-[#0f766e]/20"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tenantSlug" className="text-sm font-medium text-slate-700">
                      Slug
                    </Label>
                    <div className="relative">
                      <Input
                        id="tenantSlug"
                        type="text"
                        placeholder="auto-generated"
                        value={tenantSlug}
                        onChange={(e) => setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        className="h-11 bg-white border-slate-300 focus:border-[#0f766e] focus:ring-[#0f766e]/20 pr-16"
                        disabled={loading}
                      />
                      {autoSlug && tenantSlug === autoSlug && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium">
                          auto
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">
                      Organization Type
                    </Label>
                    <Select value={tenantType} onValueChange={setTenantType} disabled={loading}>
                      <SelectTrigger className="h-11 bg-white border-slate-300 focus:border-[#0f766e] focus:ring-[#0f766e]/20">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {ORG_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country" className="text-sm font-medium text-slate-700">
                      Country
                    </Label>
                    <Input
                      id="country"
                      type="text"
                      value={country}
                      readOnly
                      className="h-11 bg-slate-50 border-slate-300 text-slate-600 cursor-default"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Account Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#0f766e]" />
                  <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                    Your Account
                  </h3>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-medium text-slate-700">
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-11 bg-white border-slate-300 focus:border-[#0f766e] focus:ring-[#0f766e]/20"
                    autoComplete="name"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="regEmail" className="text-sm font-medium text-slate-700">
                    Email Address
                  </Label>
                  <Input
                    id="regEmail"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 bg-white border-slate-300 focus:border-[#0f766e] focus:ring-[#0f766e]/20"
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="regPassword" className="text-sm font-medium text-slate-700">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="regPassword"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min. 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-11 bg-white border-slate-300 pr-10 focus:border-[#0f766e] focus:ring-[#0f766e]/20"
                        autoComplete="new-password"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`h-11 bg-white border-slate-300 pr-10 focus:border-[#0f766e] focus:ring-[#0f766e]/20 ${
                          confirmPassword && confirmPassword !== password
                            ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20'
                            : ''
                        }`}
                        autoComplete="new-password"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        tabIndex={-1}
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-[#0f766e] hover:bg-[#0d6960] text-white font-medium shadow-lg shadow-teal-700/20 transition-all duration-200"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Organization...
                  </>
                ) : (
                  <>
                    Create Organization
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            {/* Back to Login Link */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-sm text-center text-slate-500">
                Already have an organization?{' '}
                <button
                  type="button"
                  onClick={() => navigate('login')}
                  className="text-[#0f766e] hover:text-[#0d6960] font-semibold inline-flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </button>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-xs text-slate-400 mt-6"
        >
          &copy; {new Date().getFullYear()} Zeitgeist Business Solution. All rights reserved.
        </motion.p>
      </motion.div>
    </div>
  )
}
