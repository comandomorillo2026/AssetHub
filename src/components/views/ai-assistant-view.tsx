'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Bot, Send, Settings, Circle, Loader2 } from 'lucide-react'

import { useAppStore } from '@/lib/store'
import { aiApi, settingsApi } from '@/lib/api'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'

interface ChatMessage {
  id: string
  role: 'system' | 'user' | 'assistant'
  content: string
  timestamp: Date
}

const QUICK_ACTIONS = [
  "What's my asset summary?",
  'Show maintenance due this week',
  'How many assets need depreciation?',
]

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-start gap-3"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0f766e] text-white">
        <Bot className="h-4 w-4" />
      </div>
      <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3">
        <div className="flex items-center gap-1">
          <motion.span
            className="h-2 w-2 rounded-full bg-slate-400"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
          />
          <motion.span
            className="h-2 w-2 rounded-full bg-slate-400"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
          />
          <motion.span
            className="h-2 w-2 rounded-full bg-slate-400"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
          />
        </div>
      </div>
    </motion.div>
  )
}

export default function AiAssistantView() {
  const navigate = useAppStore((s) => s.navigate)
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(true)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch AI enabled status
  useEffect(() => {
    let cancelled = false
    async function fetchSettings() {
      try {
        const data = await settingsApi.get()
        if (!cancelled) {
          setAiEnabled(data.aiEnabled ?? false)
        }
      } catch {
        if (!cancelled) setAiEnabled(false)
      } finally {
        if (!cancelled) setSettingsLoading(false)
      }
    }
    fetchSettings()
    return () => { cancelled = true }
  }, [])

  // Add welcome message once AI status is known
  useEffect(() => {
    if (aiEnabled !== null && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'system',
          content:
            "Hello! I'm your AssetHub AI assistant. I can help you with asset management, inventory questions, generating reports, and more. How can I help you today?",
          timestamp: new Date(),
        },
      ])
    }
  }, [aiEnabled, messages.length])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMsg])
      setInput('')
      setIsLoading(true)

      try {
        const data = await aiApi.chat(trimmed)
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.response || 'I was unable to generate a response.',
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, aiMsg])
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to get AI response')
        const errMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content:
            'Sorry, I encountered an error processing your request. Please try again.',
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errMsg])
      } finally {
        setIsLoading(false)
        inputRef.current?.focus()
      }
    },
    [isLoading],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  // ── Loading skeleton ────────────────────────────────────────────────
  if (settingsLoading) {
    return (
      <div className="flex h-full flex-col gap-4 p-4 md:p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="ml-auto h-5 w-20" />
        </div>
        <div className="flex-1 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className={`h-16 rounded-2xl ${i % 2 === 0 ? 'w-3/4' : 'w-1/2'}`} />
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 md:px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0f766e] text-white">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">AI Assistant</h1>
        </div>
        <div className="ml-2 flex items-center gap-1.5">
          <Circle
            className={`h-2.5 w-2.5 fill-current ${aiEnabled ? 'text-green-500' : 'text-red-500'}`}
          />
          <span className="text-xs text-muted-foreground">
            {aiEnabled ? 'Online' : 'Offline'}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-muted-foreground hover:text-foreground"
          onClick={() => navigate('settings')}
        >
          <Settings className="mr-1.5 h-4 w-4" />
          Settings
        </Button>
      </div>

      {/* AI not enabled card */}
      {!aiEnabled && (
        <div className="flex flex-1 items-center justify-center p-4 md:p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md"
          >
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                  <Bot className="h-7 w-7 text-slate-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    AI Assistant is not configured
                  </h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Go to Settings &gt; Integrations to set up your AI provider
                    and API key.
                  </p>
                </div>
                <Button
                  className="bg-[#0f766e] text-white hover:bg-[#0d6560]"
                  onClick={() => navigate('settings')}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Go to Settings
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Chat interface */}
      {aiEnabled && (
        <>
          {/* Messages */}
          <ScrollArea className="flex-1 px-4 md:px-6" ref={scrollRef}>
            <div className="mx-auto max-w-3xl space-y-4 py-4">
              <AnimatePresence initial={false}>
                {messages.map((msg) => {
                  const isUser = msg.role === 'user'
                  const isSystem = msg.role === 'system'

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
                    >
                      {/* Avatar */}
                      {!isUser && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0f766e] text-white">
                          <Bot className="h-4 w-4" />
                        </div>
                      )}

                      {/* Bubble */}
                      <div
                        className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          isUser
                            ? 'rounded-tr-sm bg-[#0f766e] text-white'
                            : isSystem
                              ? 'rounded-tl-sm bg-slate-100 text-slate-900'
                              : 'rounded-tl-sm bg-slate-100 text-slate-900'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </motion.div>
                  )
                })}
                {isLoading && <TypingIndicator />}
              </AnimatePresence>
            </div>
          </ScrollArea>

          {/* Quick actions + Input bar */}
          <div className="border-t border-border bg-background px-4 py-3 md:px-6">
            <div className="mx-auto max-w-3xl space-y-3">
              {/* Quick actions */}
              {messages.length <= 1 && !isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap gap-2"
                >
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action}
                      onClick={() => sendMessage(action)}
                      className="rounded-full border border-[#0f766e]/30 bg-[#0f766e]/5 px-3 py-1.5 text-xs font-medium text-[#0f766e] transition-colors hover:bg-[#0f766e]/10"
                    >
                      {action}
                    </button>
                  ))}
                </motion.div>
              )}

              {/* Input */}
              <div className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything about your assets..."
                  disabled={isLoading}
                  className="flex-1 rounded-xl border-slate-200 bg-slate-50 focus-visible:ring-[#0f766e]/30"
                />
                <Button
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-xl bg-[#0f766e] text-white hover:bg-[#0d6560] disabled:opacity-50"
                  disabled={!input.trim() || isLoading}
                  onClick={() => sendMessage(input)}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-center text-[11px] text-muted-foreground">
                AI responses may not always be accurate. Verify important information.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
