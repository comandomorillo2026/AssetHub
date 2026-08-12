'use client'

import React, { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import {
  Shield,
  Eye,
  AlertTriangle,
  DollarSign,
  QrCode,
  LayoutDashboard,
  ClipboardCheck,
  FileWarning,
  WifiOff,
  Building2,
  UserPlus,
  PackagePlus,
  ScanLine,
  Check,
  ArrowRight,
  Play,
  ChevronRight,
  Landmark,
  University,
  Building,
  ShieldCheck,
  GraduationCap,
  CreditCard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useAppStore } from '@/lib/store'

/* ------------------------------------------------------------------ */
/*  ANIMATION HELPERS                                                  */
/* ------------------------------------------------------------------ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fadeUp: any = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fadeIn: any = {
  hidden: { opacity: 0 },
  visible: (i: number = 0) => ({
    opacity: 1,
    transition: { duration: 0.7, delay: i * 0.08, ease: 'easeOut' },
  }),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const scaleIn: any = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: (i: number = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
}

function AnimatedSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px 0px' })
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  SECTION HEADING                                                    */
/* ------------------------------------------------------------------ */
function SectionHeading({
  title,
  subtitle,
  light = false,
}: {
  title: string
  subtitle?: string
  light?: boolean
}) {
  return (
    <AnimatedSection className="text-center mb-16">
      <motion.h2
        variants={fadeUp}
        className={`text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight ${
          light ? 'text-white' : 'text-[#0a1628]'
        }`}
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p
          variants={fadeUp}
          custom={1}
          className={`mt-4 text-lg max-w-2xl mx-auto ${light ? 'text-white/70' : 'text-gray-500'}`}
        >
          {subtitle}
        </motion.p>
      )}
    </AnimatedSection>
  )
}

/* ------------------------------------------------------------------ */
/*  MAIN COMPONENT                                                     */
/* ------------------------------------------------------------------ */
export default function PortalView() {
  const navigate = useAppStore((s) => s.navigate)

  // Section refs for smooth scrolling
  const featuresRef = useRef<HTMLDivElement>(null)
  const howItWorksRef = useRef<HTMLDivElement>(null)
  const pricingRef = useRef<HTMLDivElement>(null)
  const faqRef = useRef<HTMLDivElement>(null)

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* ============================================================ */}
      {/*  1. NAVBAR                                                     */}
      {/* ============================================================ */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0a1628]/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/25">
                  <Shield className="w-5 h-5 text-white" strokeWidth={2.5} />
                </div>
                <div className="absolute -inset-1 rounded-lg bg-gradient-to-br from-teal-400/20 to-emerald-600/20 blur-sm -z-10" />
              </div>
              <span className="text-white font-bold text-lg tracking-tight">
                Asset<span className="text-teal-400">Hub</span>
              </span>
            </div>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              {[
                { label: 'Features', ref: featuresRef },
                { label: 'How It Works', ref: howItWorksRef },
                { label: 'Pricing', ref: pricingRef },
                { label: 'FAQ', ref: faqRef },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => scrollTo(item.ref)}
                  className="px-3.5 py-2 text-sm text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => navigate('login')}
                className="hidden sm:inline-flex text-white/70 hover:text-white hover:bg-white/10 border-0 text-sm"
              >
                Sign In
              </Button>
              <Button
                onClick={() => navigate('register-wizard')}
                className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white border-0 shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 transition-all duration-300 text-sm"
              >
                Get Started
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* ============================================================ */}
      {/*  2. HERO SECTION                                               */}
      {/* ============================================================ */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-[#0a1628]">
          {/* Mesh grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
              backgroundSize: '64px 64px',
            }}
          />
          {/* Radial glow top-right */}
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-teal-600/15 via-transparent to-transparent rounded-full blur-3xl" />
          {/* Radial glow bottom-left */}
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-emerald-600/10 via-transparent to-transparent rounded-full blur-3xl" />
          {/* Gold glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#d4a843]/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Copy */}
            <div>
              <AnimatedSection>
                <motion.div variants={fadeUp} custom={0}>
                  <Badge className="bg-white/10 text-teal-300 border-teal-500/30 hover:bg-white/15 mb-6 px-4 py-1.5 text-sm rounded-full backdrop-blur-sm">
                    <span className="mr-1.5">🇹🇹</span>
                    Built for the Caribbean
                  </Badge>
                </motion.div>

                <motion.h1
                  variants={fadeUp}
                  custom={1}
                  className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]"
                >
                  <span className="text-white">Stop Losing Track of</span>
                  <br />
                  <span className="bg-gradient-to-r from-teal-300 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
                    What You Own
                  </span>
                </motion.h1>

                <motion.p
                  variants={fadeUp}
                  custom={2}
                  className="mt-6 text-lg sm:text-xl text-white/60 leading-relaxed max-w-lg"
                >
                  The first asset management platform designed specifically for
                  Caribbean institutions — government, banks, schools, and beyond.
                  Know what you have. Always.
                </motion.p>

                <motion.div variants={fadeUp} custom={3} className="mt-8 flex flex-wrap gap-4">
                  <Button
                    onClick={() => navigate('register-wizard')}
                    size="lg"
                    className="bg-gradient-to-r from-[#d4a843] to-[#e8b84a] hover:from-[#e0b34a] hover:to-[#f0c45a] text-[#0a1628] font-semibold shadow-lg shadow-[#d4a843]/25 hover:shadow-[#d4a843]/40 transition-all duration-300 px-7 h-12 text-base rounded-xl"
                  >
                    Start Free Trial
                    <ArrowRight className="w-5 h-5 ml-1.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    className="text-white/70 hover:text-white hover:bg-white/10 border border-white/10 h-12 px-7 rounded-xl text-base backdrop-blur-sm"
                  >
                    <Play className="w-4 h-4 mr-2 fill-teal-400 text-teal-400" />
                    Watch Demo
                  </Button>
                </motion.div>

                <motion.div variants={fadeUp} custom={4} className="mt-8 flex items-center gap-6 text-sm text-white/40">
                  <span className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-teal-400" /> 14-day free trial
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-teal-400" /> No credit card
                  </span>
                </motion.div>
              </AnimatedSection>
            </div>

            {/* Right: Dashboard mockup */}
            <AnimatedSection>
              <motion.div variants={scaleIn} custom={2} className="relative">
                {/* Glow behind card */}
                <div className="absolute -inset-4 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 rounded-3xl blur-2xl" />

                {/* Dashboard card */}
                <div className="relative bg-gradient-to-b from-[#111d33] to-[#0d1526] rounded-2xl border border-white/10 p-6 shadow-2xl">
                  {/* Header bar */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-400/60" />
                      <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
                      <div className="w-3 h-3 rounded-full bg-green-400/60" />
                    </div>
                    <div className="text-xs text-white/30 font-mono">assethub.app/dashboard</div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { label: 'Total Assets', value: '12,847', color: 'text-teal-400' },
                      { label: 'Locations', value: '24', color: 'text-emerald-400' },
                      { label: 'Value', value: '$8.2M', color: 'text-[#d4a843]' },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="bg-white/5 rounded-xl p-3 border border-white/5"
                      >
                        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{stat.label}</div>
                        <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Fake chart bars */}
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5 mb-5">
                    <div className="text-xs text-white/40 mb-3">Monthly Inventory Completions</div>
                    <div className="flex items-end gap-2 h-20">
                      {[40, 55, 35, 70, 60, 85, 75, 90, 65, 80, 95, 88].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t-sm"
                          style={{
                            height: `${h}%`,
                            background: `linear-gradient(to top, #0f766e, ${i >= 9 ? '#d4a843' : '#14b8a6'})`,
                            opacity: i >= 9 ? 1 : 0.7,
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Recent activity with QR icon */}
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="text-xs text-white/40 mb-3">Recent Scans</div>
                    <div className="space-y-2.5">
                      {['Laptop #4821', 'Generator #093', 'Vehicle #117'].map((item, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-md bg-teal-500/15 flex items-center justify-center">
                              <QrCode className="w-3.5 h-3.5 text-teal-400" />
                            </div>
                            <span className="text-xs text-white/70">{item}</span>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-[10px] px-2 py-0 border-emerald-500/30 text-emerald-400 bg-emerald-500/10 h-5"
                          >
                            Verified
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatedSection>
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
      </section>

      {/* ============================================================ */}
      {/*  3. TRUST BAR                                                  */}
      {/* ============================================================ */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <motion.p variants={fadeIn} custom={0} className="text-center text-sm text-gray-400 uppercase tracking-widest mb-10 font-medium">
              Trusted by leading Caribbean institutions
            </motion.p>
            <motion.div
              variants={fadeIn}
              custom={1}
              className="flex flex-wrap justify-center items-center gap-8 sm:gap-12 lg:gap-16"
            >
              {[
                { label: 'Government', icon: Landmark },
                { label: 'Municipalities', icon: Building2 },
                { label: 'Banks', icon: University },
                { label: 'Insurance', icon: ShieldCheck },
                { label: 'Education', icon: GraduationCap },
                { label: 'Credit Unions', icon: CreditCard },
              ].map((inst) => (
                <div
                  key={inst.label}
                  className="flex items-center gap-2.5 text-gray-300 hover:text-gray-500 transition-colors duration-300 group"
                >
                  <inst.icon className="w-6 h-6 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                  <span className="text-sm font-semibold tracking-wide uppercase">{inst.label}</span>
                </div>
              ))}
            </motion.div>
          </AnimatedSection>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  4. PROBLEM SECTION                                            */}
      {/* ============================================================ */}
      <section className="relative py-24 sm:py-32 bg-[#0a1628] overflow-hidden">
        {/* Background accents */}
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-3xl -translate-y-1/2" />
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-orange-500/5 rounded-full blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,.15) 1px, transparent 0)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            title="The Problem"
            subtitle="Across the Caribbean, institutions are hemorrhaging value because they can't answer one simple question: where is it?"
            light
          />

          <div className="grid sm:grid-cols-3 gap-6 lg:gap-8">
            {[
              {
                icon: Eye,
                title: 'No Visibility',
                description:
                  "Spreadsheets and paper ledgers can't keep up. You don't know what you have, where it is, or if it even exists anymore.",
                iconColor: 'text-red-400',
                iconBg: 'bg-red-500/10',
              },
              {
                icon: AlertTriangle,
                title: 'Chaotic Audits',
                description:
                  'Physical inventories take weeks, tie up staff, and still produce inaccurate results. Auditors find discrepancies every time.',
                iconColor: 'text-orange-400',
                iconBg: 'bg-orange-500/10',
              },
              {
                icon: DollarSign,
                title: 'Millions Lost',
                description:
                  'Lost, stolen, or duplicated purchases cost Caribbean institutions millions annually. Insurance claims fail without proper records.',
                iconColor: 'text-amber-400',
                iconBg: 'bg-amber-500/10',
              },
            ].map((item, i) => (
              <AnimatedSection key={item.title}>
                <motion.div variants={fadeUp} custom={i} className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-b from-white/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <Card className="relative bg-white/[0.03] border-white/[0.06] backdrop-blur-sm hover:bg-white/[0.06] transition-all duration-500 h-full py-6">
                    <CardContent className="pt-0">
                      <div className={`w-12 h-12 rounded-xl ${item.iconBg} flex items-center justify-center mb-4`}>
                        <item.icon className={`w-6 h-6 ${item.iconColor}`} strokeWidth={1.5} />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                      <p className="text-sm text-white/50 leading-relaxed">{item.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  5. FEATURES SECTION                                           */}
      {/* ============================================================ */}
      <section ref={featuresRef} className="relative py-24 sm:py-32 bg-white overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-teal-50/50 rounded-full blur-3xl -translate-y-1/2" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            title="Everything You Need"
            subtitle="A complete asset management toolkit that works the way Caribbean institutions actually work — online or off."
          />

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: QrCode,
                title: 'QR Code Tracking',
                description:
                  'Every asset gets a unique QR code. Scan with any phone — no special hardware needed. Instant identification, anywhere.',
                gradient: 'from-teal-500 to-emerald-500',
              },
              {
                icon: LayoutDashboard,
                title: 'Real-Time Dashboard',
                description:
                  'Know what you have, where it is, right now. Live metrics, location breakdowns, and value tracking at a glance.',
                gradient: 'from-emerald-500 to-green-500',
              },
              {
                icon: ClipboardCheck,
                title: 'Smart Inventory',
                description:
                  'Complete physical inventories in minutes, not days. Guided workflows ensure nothing is missed and every scan is logged.',
                gradient: 'from-cyan-500 to-teal-500',
              },
              {
                icon: FileWarning,
                title: 'Discrepancy Reports',
                description:
                  'Instant alerts when assets are missing, misplaced, or unaccounted for. Catch problems before they become costly losses.',
                gradient: 'from-amber-500 to-orange-500',
              },
              {
                icon: WifiOff,
                title: 'Offline Capable',
                description:
                  'Works without internet — critical for rural locations and buildings with poor connectivity. Syncs automatically when reconnected.',
                gradient: 'from-violet-500 to-purple-500',
              },
              {
                icon: Building2,
                title: 'Multi-Site Management',
                description:
                  'Manage assets across all your locations from one place. Transfer, track, and report on every site in your organization.',
                gradient: 'from-rose-500 to-pink-500',
              },
            ].map((feature, i) => (
              <AnimatedSection key={feature.title}>
                <motion.div variants={fadeUp} custom={i} className="group relative h-full">
                  <Card className="relative h-full hover:shadow-xl hover:shadow-teal-500/5 transition-all duration-500 border-gray-200/80 hover:border-teal-200 py-6">
                    <CardContent className="pt-0">
                      <div className="relative mb-5">
                        <div
                          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center shadow-lg`}
                        >
                          <feature.icon className="w-6 h-6 text-white" strokeWidth={1.5} />
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold text-[#0a1628] mb-2 group-hover:text-teal-700 transition-colors">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  6. HOW IT WORKS                                               */}
      {/* ============================================================ */}
      <section ref={howItWorksRef} className="relative py-24 sm:py-32 bg-gradient-to-b from-gray-50 to-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            title="How It Works"
            subtitle="Up and running in under an hour. No consultants. No lengthy onboarding. Just results."
          />

          <div className="relative max-w-4xl mx-auto">
            {/* Connecting line (desktop) */}
            <div className="hidden lg:block absolute top-20 left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] h-0.5 bg-gradient-to-r from-teal-300 via-emerald-300 to-teal-300" />

            <div className="grid lg:grid-cols-3 gap-10 lg:gap-6">
              {[
                {
                  step: '01',
                  icon: UserPlus,
                  title: 'Register Your Organization',
                  description:
                    'Create your account in minutes. Configure your organization, invite your team, and set up your locations. No credit card required.',
                },
                {
                  step: '02',
                  icon: PackagePlus,
                  title: 'Add Your Assets',
                  description:
                    'Import via spreadsheet or add manually. Each asset gets a printable QR code. Categorize, locate, and value everything you own.',
                },
                {
                  step: '03',
                  icon: ScanLine,
                  title: 'Scan, Track & Report',
                  description:
                    'Walk through your facilities scanning QR codes with any phone. Discrepancies are flagged instantly. Reports generate themselves.',
                },
              ].map((item, i) => (
                <AnimatedSection key={item.step}>
                  <motion.div variants={fadeUp} custom={i} className="relative text-center">
                    {/* Step circle */}
                    <div className="relative inline-flex mb-6">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0a1628] to-[#162240] flex items-center justify-center shadow-xl shadow-[#0a1628]/20 border border-white/10">
                        <item.icon className="w-6 h-6 text-teal-400" strokeWidth={1.5} />
                      </div>
                      <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-[11px] font-bold text-white shadow-lg">
                        {item.step}
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-[#0a1628] mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">{item.description}</p>
                  </motion.div>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  7. PRICING SECTION                                            */}
      {/* ============================================================ */}
      <section ref={pricingRef} className="relative py-24 sm:py-32 bg-white overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-teal-50/40 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            title="Simple, Transparent Pricing"
            subtitle="No hidden fees. No per-scan charges. Choose the plan that fits your institution."
          />

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto items-start">
            {/* Starter */}
            <AnimatedSection>
              <motion.div variants={fadeUp} custom={0}>
                <Card className="h-full border-gray-200/80 hover:shadow-lg transition-shadow duration-300 py-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-[#0a1628]">Starter</CardTitle>
                    <CardDescription>For smaller organizations getting started with asset tracking.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm text-gray-500">TTD</span>
                      <span className="text-4xl font-extrabold text-[#0a1628]">$499</span>
                      <span className="text-sm text-gray-500">/month</span>
                    </div>
                    <ul className="space-y-3">
                      {[
                        'Up to 500 assets',
                        '10 users',
                        '5 locations',
                        'Email support',
                        'QR code generation',
                      ].map((feature) => (
                        <li key={feature} className="flex items-center gap-2.5 text-sm text-gray-600">
                          <Check className="w-4 h-4 text-teal-500 shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button
                      onClick={() => navigate('register-wizard')}
                      variant="outline"
                      className="w-full h-11 border-gray-300 text-[#0a1628] hover:bg-gray-50 hover:border-gray-400 rounded-xl text-sm font-medium"
                    >
                      Get Started
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            </AnimatedSection>

            {/* Professional — POPULAR */}
            <AnimatedSection>
              <motion.div variants={fadeUp} custom={1} className="relative md:-mt-4">
                {/* Glow behind popular card */}
                <div className="absolute -inset-1 bg-gradient-to-b from-teal-400/20 via-emerald-400/10 to-transparent rounded-2xl blur-sm" />
                <Card className="relative h-full border-2 border-teal-500/50 shadow-xl shadow-teal-500/10 py-0">
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white border-0 px-4 py-1 text-xs font-semibold shadow-lg shadow-teal-500/30">
                      Most Popular
                    </Badge>
                  </div>
                  <CardHeader className="pb-2 pt-8">
                    <CardTitle className="text-lg text-[#0a1628]">Professional</CardTitle>
                    <CardDescription>For growing institutions that need serious tracking power.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm text-gray-500">TTD</span>
                      <span className="text-4xl font-extrabold bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
                        $1,299
                      </span>
                      <span className="text-sm text-gray-500">/month</span>
                    </div>
                    <ul className="space-y-3">
                      {[
                        'Up to 5,000 assets',
                        '25 users',
                        '20 locations',
                        'Priority support',
                        'Advanced reports & analytics',
                        'Offline mode',
                        'Discrepancy alerts',
                      ].map((feature) => (
                        <li key={feature} className="flex items-center gap-2.5 text-sm text-gray-600">
                          <Check className="w-4 h-4 text-teal-500 shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button
                      onClick={() => navigate('register-wizard')}
                      className="w-full h-11 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white border-0 shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 transition-all duration-300 rounded-xl text-sm font-semibold"
                    >
                      Get Started
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            </AnimatedSection>

            {/* Enterprise */}
            <AnimatedSection>
              <motion.div variants={fadeUp} custom={2}>
                <Card className="h-full border-gray-200/80 hover:shadow-lg transition-shadow duration-300 py-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-[#0a1628]">Enterprise</CardTitle>
                    <CardDescription>For large organizations with complex requirements.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm text-gray-500">TTD</span>
                      <span className="text-4xl font-extrabold text-[#0a1628]">$2,999</span>
                      <span className="text-sm text-gray-500">/month</span>
                    </div>
                    <ul className="space-y-3">
                      {[
                        'Unlimited assets',
                        'Unlimited users',
                        'Unlimited locations',
                        'Dedicated account manager',
                        'Custom integrations & API',
                        'Advanced security & SSO',
                        'On-site training',
                      ].map((feature) => (
                        <li key={feature} className="flex items-center gap-2.5 text-sm text-gray-600">
                          <Check className="w-4 h-4 text-teal-500 shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button
                      onClick={() => navigate('register-wizard')}
                      variant="outline"
                      className="w-full h-11 border-gray-300 text-[#0a1628] hover:bg-gray-50 hover:border-gray-400 rounded-xl text-sm font-medium"
                    >
                      Get Started
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  8. FAQ SECTION                                                */}
      {/* ============================================================ */}
      <section ref={faqRef} className="py-24 sm:py-32 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            title="Frequently Asked Questions"
            subtitle="Everything you need to know about getting started with AssetHub."
          />

          <AnimatedSection>
            <motion.div variants={fadeUp} custom={0}>
              <Accordion type="single" collapsible className="space-y-3">
                {[
                  {
                    q: 'How long does setup take?',
                    a: 'Most organizations are fully operational within 1–2 hours. Register, import your asset list (we provide templates), print your QR codes, and start scanning. Our onboarding wizard walks you through every step.',
                  },
                  {
                    q: 'Do I need special hardware?',
                    a: 'No. AssetHub works with any smartphone camera. No barcode scanners, no special devices, no expensive equipment. Just print the QR codes we generate and scan them with the phone you already have.',
                  },
                  {
                    q: 'Is my data secure?',
                    a: 'Absolutely. We use AES-256 encryption at rest and TLS 1.3 in transit. Your data is hosted in secure, SOC 2 compliant data centers. We perform regular security audits and backups, and you retain full ownership of all your data at all times.',
                  },
                  {
                    q: 'Can I cancel anytime?',
                    a: 'Absolutely. There are no long-term contracts or cancellation penalties. You can cancel your subscription at any time from your account settings. Your data remains accessible for 30 days after cancellation.',
                  },
                  {
                    q: 'What about offline use?',
                    a: 'AssetHub is designed for Caribbean realities. The app works fully offline — scan assets, log discrepancies, complete inventories without any internet connection. Everything syncs automatically the moment you reconnect.',
                  },
                ].map((faq, i) => (
                  <AccordionItem
                    key={i}
                    value={`item-${i}`}
                    className="bg-white rounded-xl border border-gray-200/80 px-6 shadow-sm"
                  >
                    <AccordionTrigger className="text-[#0a1628] text-[15px] font-medium hover:no-underline py-5">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-gray-500 text-sm leading-relaxed pb-5">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          </AnimatedSection>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  9. CTA SECTION                                                */}
      {/* ============================================================ */}
      <section className="relative py-24 sm:py-32 bg-[#0a1628] overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#d4a843]/5 rounded-full blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
              backgroundSize: '64px 64px',
            }}
          />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimatedSection>
            <motion.h2
              variants={fadeUp}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight"
            >
              Ready to Take Control?
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={1}
              className="mt-5 text-lg text-white/60 max-w-xl mx-auto"
            >
              Start your 14-day free trial today. No credit card required. See why Caribbean
              institutions trust AssetHub to protect what matters.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="mt-10">
              <Button
                onClick={() => navigate('register-wizard')}
                size="lg"
                className="bg-gradient-to-r from-[#d4a843] to-[#e8b84a] hover:from-[#e0b34a] hover:to-[#f0c45a] text-[#0a1628] font-bold shadow-xl shadow-[#d4a843]/25 hover:shadow-[#d4a843]/40 transition-all duration-300 px-10 h-14 text-base rounded-2xl"
              >
                Get Started Now
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          </AnimatedSection>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  10. FOOTER                                                    */}
      {/* ============================================================ */}
      <footer className="bg-[#060d1a] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            {/* Branding */}
            <div className="flex flex-col items-center sm:items-start gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-white font-bold tracking-tight">
                  Asset<span className="text-teal-400">Hub</span>
                </span>
              </div>
              <p className="text-sm text-white/30">
                By <span className="text-white/50 font-medium">Zeitgeist Business Solution</span>
              </p>
              <p className="text-xs text-white/20 flex items-center gap-1.5">
                Made in Trinidad &amp; Tobago 🇹🇹
              </p>
            </div>

            {/* Links */}
            <div className="flex items-center gap-6 text-sm text-white/40">
              <button className="hover:text-white/70 transition-colors">Privacy Policy</button>
              <button className="hover:text-white/70 transition-colors">Terms of Service</button>
              <button className="hover:text-white/70 transition-colors">Contact Us</button>
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-8 pt-8 border-t border-white/5 text-center">
            <p className="text-xs text-white/20">
              © {new Date().getFullYear()} Zeitgeist Business Solution. All rights reserved.
            </p>
            {/* Discreet admin access */}
            <button
              onClick={() => navigate('super-admin')}
              className="mt-4 text-[10px] text-white/10 hover:text-white/30 transition-colors duration-500"
              title="Super Admin"
            >
              ⚙
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
