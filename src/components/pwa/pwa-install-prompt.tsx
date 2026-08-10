'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X, Smartphone, Monitor, Tablet } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function usePwaState() {
  const dismissed = typeof window !== 'undefined' ? !!localStorage.getItem('assethub_pwa_dismissed') : false
  const installed = typeof window !== 'undefined' ? window.matchMedia('(display-mode: standalone)').matches : false
  return { initiallyDismissed: dismissed, initiallyInstalled: installed }
}

export default function PwaInstallPrompt() {
  const { initiallyDismissed, initiallyInstalled } = usePwaState()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const isInstalled = initiallyInstalled
  const [dismissed, setDismissed] = useState(initiallyDismissed)

  const handleDismiss = useCallback(() => {
    setShowPrompt(false)
    setDismissed(true)
    localStorage.setItem('assethub_pwa_dismissed', '1')
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowPrompt(false)
    }
    setDeferredPrompt(null)
  }, [deferredPrompt])

  useEffect(() => {
    if (initiallyDismissed || initiallyInstalled) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setTimeout(() => setShowPrompt(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handler)

    const visitCount = parseInt(localStorage.getItem('assethub_visits') || '0', 10)
    localStorage.setItem('assethub_visits', String(visitCount + 1))
    if (visitCount >= 2) {
      setTimeout(() => setShowPrompt(true), 2000)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [initiallyDismissed, initiallyInstalled])

  useEffect(() => {
    const handler = () => setShowPrompt(false)
    window.addEventListener('appinstalled', handler)
    return () => window.removeEventListener('appinstalled', handler)
  }, [])

  if (isInstalled || dismissed || !showPrompt) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[380px] z-[9999]"
      >
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 border border-gray-200/80 overflow-hidden">
          <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">Install AssetHub</h3>
                  <p className="text-white/70 text-xs mt-0.5">Add to home screen for quick access</p>
                </div>
              </div>
              <button onClick={handleDismiss} className="text-white/60 hover:text-white transition-colors p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Smartphone className="w-3.5 h-3.5" />
                <Monitor className="w-3.5 h-3.5" />
                <Tablet className="w-3.5 h-3.5" />
                <span>Works on all devices</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleInstall}
                className="flex-1 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white border-0 h-10 text-sm font-medium rounded-xl"
              >
                <Download className="w-4 h-4 mr-1.5" />
                Install App
              </Button>
              <Button onClick={handleDismiss} variant="ghost" className="h-10 px-4 text-gray-500 hover:text-gray-700 rounded-xl text-sm">
                Not now
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}