'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, Eye, EyeOff, Loader2, ArrowRight, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { authApi } from '@/lib/api'
import { useAppStore } from '@/lib/store'

export default function LoginView() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tenantSlug, setTenantSlug] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  /* 2FA step */
  const [pending2FA, setPending2FA] = useState<{ userId: string; tenantId: string } | null>(null)
  const [twoFactorToken, setTwoFactorToken] = useState('')
  const [twoFactorLoading, setTwoFactorLoading] = useState(false)

  const setAuth = useAppStore((s) => s.setAuth)
  const navigate = useAppStore((s) => s.navigate)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!email.trim()) {
      toast.error('Email is required')
      return
    }
    if (!password.trim()) {
      toast.error('Password is required')
      return
    }
    if (!tenantSlug.trim()) {
      toast.error('Organization slug is required')
      return
    }

    setLoading(true)
    try {
      const res = await authApi.login(email, password, tenantSlug)

      // If 2FA is required, show the token input
      if (res.requiresTwoFactor) {
        setPending2FA({ userId: res.userId, tenantId: res.tenantId })
        toast.info('Two-factor authentication required')
        return
      }

      setAuth(res.user, res.accessToken, res.refreshToken)
      toast.success('Welcome back!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  async function handle2FAVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!twoFactorToken.trim() || twoFactorToken.length !== 6) {
      toast.error('Enter the 6-digit code from your authenticator app')
      return
    }
    if (!pending2FA) return

    setTwoFactorLoading(true)
    try {
      const res = await authApi.login2FA(pending2FA.userId, pending2FA.tenantId, twoFactorToken)
      setAuth(res.user, res.accessToken, res.refreshToken)
      setPending2FA(null)
      setTwoFactorToken('')
      toast.success('Welcome back!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid code. Try again.')
    } finally {
      setTwoFactorLoading(false)
    }
  }

  function handleBackToLogin() {
    setPending2FA(null)
    setTwoFactorToken('')
  }

  /* ── 2FA Token Input ── */
  if (pending2FA) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-teal-50/40 px-4 py-8">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-teal-100/40 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-emerald-100/30 blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md relative z-10"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0f766e] text-white mb-4 shadow-lg shadow-teal-700/20">
              <Shield className="w-9 h-9" strokeWidth={2} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">AssetHub</h1>
          </div>

          <Card className="border-slate-200/80 shadow-xl shadow-slate-200/50">
            <CardHeader className="pb-2 pt-6 px-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-amber-50">
                  <Smartphone className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Two-Factor Authentication</h2>
                  <p className="text-sm text-slate-500">Enter the 6-digit code from your authenticator app</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <form onSubmit={handle2FAVerify} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="totp-token" className="text-sm font-medium text-slate-700">
                    Authentication Code
                  </Label>
                  <Input
                    id="totp-token"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    placeholder="000000"
                    value={twoFactorToken}
                    onChange={(e) => setTwoFactorToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="h-14 text-2xl text-center tracking-[0.5em] font-mono bg-white border-slate-300 focus:border-[#0f766e] focus:ring-[#0f766e]/20"
                    autoFocus
                    disabled={twoFactorLoading}
                  />
                  <p className="text-xs text-slate-400 text-center">Google Authenticator, Authy, or any TOTP-compatible app</p>
                </div>

                <Button
                  type="submit"
                  disabled={twoFactorLoading || twoFactorToken.length !== 6}
                  className="w-full h-11 bg-[#0f766e] hover:bg-[#0d6960] text-white font-medium shadow-lg shadow-teal-700/20 transition-all duration-200"
                >
                  {twoFactorLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Sign In'
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-slate-500 hover:text-slate-700"
                  onClick={handleBackToLogin}
                >
                  Back to login
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  /* ── Normal Login ── */
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
        className="w-full max-w-md relative z-10"
      >
        {/* Brand Area */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0f766e] text-white mb-4 shadow-lg shadow-teal-700/20">
            <Shield className="w-9 h-9" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            AssetHub
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Zeitgeist Business Solution
          </p>
        </motion.div>

        {/* Login Card */}
        <Card className="border-slate-200/80 shadow-xl shadow-slate-200/50">
          <CardHeader className="pb-2 pt-6 px-6">
            <h2 className="text-xl font-semibold text-slate-900">Sign in to your account</h2>
            <p className="text-sm text-slate-500">
              Enter your credentials to access your organization
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tenant Slug */}
              <div className="space-y-2">
                <Label htmlFor="tenantSlug" className="text-sm font-medium text-slate-700">
                  Organization Slug
                </Label>
                <Input
                  id="tenantSlug"
                  type="text"
                  placeholder="e.g. acme-corp"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="h-11 bg-white border-slate-300 focus:border-[#0f766e] focus:ring-[#0f766e]/20"
                  autoComplete="organization"
                  disabled={loading}
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 bg-white border-slate-300 focus:border-[#0f766e] focus:ring-[#0f766e]/20"
                  autoComplete="email"
                  disabled={loading}
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 bg-white border-slate-300 pr-10 focus:border-[#0f766e] focus:ring-[#0f766e]/20"
                    autoComplete="current-password"
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

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-[#0f766e] hover:bg-[#0d6960] text-white font-medium shadow-lg shadow-teal-700/20 transition-all duration-200 mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            {/* Register Link */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <p className="text-sm text-center text-slate-500">
                Don&apos;t have an organization?{' '}
                <button
                  type="button"
                  onClick={() => navigate('register')}
                  className="text-[#0f766e] hover:text-[#0d6960] font-semibold inline-flex items-center gap-1 transition-colors"
                >
                  Create new organization
                  <ArrowRight className="w-3.5 h-3.5" />
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
