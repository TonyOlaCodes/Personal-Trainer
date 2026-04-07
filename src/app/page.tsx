"use client";

import Link from "next/link";
import { useAuth, UserButton, SignInButton, SignUpButton } from "@clerk/nextjs";
import {
  Zap,
  BarChart3,
  MessageSquare,
  Shield,
  ChevronRight,
  Check,
  Star,
  Dumbbell,
  Target,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Dumbbell,
    title: "Smart Workout Plans",
    desc: "Weekly evolving programs built by expert coaches or auto-generated for your goals.",
    color: "text-brand-400",
    bg: "bg-brand-950",
  },
  {
    icon: BarChart3,
    title: "Progress Analytics",
    desc: "Track PRs, bodyweight trends, and strength progressions with beautiful charts.",
    color: "text-success",
    bg: "bg-success-muted",
  },
  {
    icon: MessageSquare,
    title: "Direct Coach Chat",
    desc: "Real-time messaging with your coach. Share images, videos, and check-ins.",
    color: "text-warning",
    bg: "bg-warning-muted",
  },
  {
    icon: Shield,
    title: "Access Code System",
    desc: "Coaches assign tailored plans via unique codes. Instant upgrade when you're ready.",
    color: "text-brand-300",
    bg: "bg-brand-950",
  },
  {
    icon: Target,
    title: "Weekly Check-ins",
    desc: "Submit bodyweight, progress photos, and feedback. Coaches respond with guidance.",
    color: "text-success",
    bg: "bg-success-muted",
  },
  {
    icon: TrendingUp,
    title: "Workout Logger",
    desc: "Log every set, rep, and weight. See your PRs shatter in real time.",
    color: "text-warning",
    bg: "bg-warning-muted",
  },
];

const plans = [
  {
    name: "Free",
    price: "£0",
    period: "forever",
    desc: "Get started with prebuilt splits and self-managed plans.",
    features: [
      "Prebuilt splits (PPL, Arnold, Bro Split)",
      "Create unlimited custom plans",
      "Workout logging",
      "Calendar view",
      "Multiple plans saved",
    ],
    cta: "Start Free",
    href: "/sign-up",
    highlight: false,
  },
  {
    name: "Premium",
    price: "Via Code",
    period: "from your coach",
    desc: "Unlock the full power of personalised coaching.",
    features: [
      "Everything in Free",
      "Coach-assigned plans",
      "Full progress analytics",
      "Weekly check-ins",
      "Direct coach chat",
      "General community chat",
    ],
    cta: "Get Access Code",
    href: "/sign-up",
    highlight: true,
  },
];

const testimonials = [
  {
    name: "James K.",
    role: "Premium Client",
    text: "Lost 18kg in 5 months. The weekly check-ins and direct access to my coach made all the difference.",
    rating: 5,
  },
  {
    name: "Sarah M.",
    role: "Premium Client",
    text: "The analytics section is incredible. I can see exactly how my lifts are progressing week by week.",
    rating: 5,
  },
  {
    name: "Marcus T.",
    role: "Free User",
    text: "Even the free version is better than any other app I've used. The PPL split is perfectly structured.",
    rating: 5,
  },
];

export default function LandingPage() {
  const { isLoaded, isSignedIn } = useAuth();
  return (
    <div className="min-h-screen bg-surface text-fg overflow-hidden">
      {/* ─── Navbar ───────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 glass glass-border border-b border-surface-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-brand">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">FitCoach<span className="text-gradient"> Pro</span></span>
          </Link>

          <div className="flex items-center gap-3">
            {!isLoaded ? (
              <div className="h-8 w-24 bg-surface-muted animate-pulse rounded-lg" />
            ) : !isSignedIn ? (
              <>
                <SignInButton mode="modal" fallbackRedirectUrl="/dashboard">
                  <button className="btn-ghost text-sm hidden sm:flex">Sign In</button>
                </SignInButton>
                <SignUpButton mode="modal" fallbackRedirectUrl="/onboarding">
                  <button className="btn-primary btn-sm">Get Started</button>
                </SignUpButton>
              </>
            ) : (
              <>
                <Link href="/dashboard" className="btn-secondary btn-sm">Dashboard</Link>
                <UserButton />
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ─── Hero ─────────────────────────────────── */}
      <section className="relative pt-36 pb-24 px-6 text-center overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 left-1/4 w-[300px] h-[300px] bg-brand-800/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto animate-fade-in">
          <div className="badge-brand mb-6 mx-auto w-max">
            <Zap className="w-3 h-3" />
            Premium Fitness Coaching
          </div>

          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight mb-6 leading-[1.05]">
            Train smarter.<br />
            <span className="text-gradient">Progress faster.</span>
          </h1>

          <p className="text-lg sm:text-xl text-fg-muted max-w-2xl mx-auto mb-10 text-balance">
            The all-in-one platform for serious athletes and their coaches.
            Personalised plans, real-time analytics, and direct coach communication — all in one place.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {!isLoaded ? (
              <div className="h-12 w-48 bg-surface-muted animate-pulse rounded-xl" />
            ) : !isSignedIn ? (
              <SignUpButton mode="modal" fallbackRedirectUrl="/onboarding">
                <button className="btn-primary btn-lg w-full sm:w-auto">
                  Start for Free
                  <ArrowRight className="w-5 h-5" />
                </button>
              </SignUpButton>
            ) : (
              <Link href="/dashboard" className="btn-primary btn-lg w-full sm:w-auto">
                Go to Dashboard
                <ArrowRight className="w-5 h-5" />
              </Link>
            )}
            <Link href="#features" className="btn-secondary btn-lg w-full sm:w-auto">
              See what&apos;s included
            </Link>
          </div>

          <p className="text-xs text-fg-subtle mt-6">
            No credit card required · Free forever plan available
          </p>
        </div>

        {/* Dashboard preview */}
        <div className="relative mt-20 max-w-5xl mx-auto animate-slide-up animate-delay-200">
          <div className="card overflow-hidden border-surface-border/60">
            <div className="bg-gradient-to-b from-surface-card to-surface p-6 sm:p-10">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { label: "PR – Bench", val: "120 kg", delta: "+5kg" },
                  { label: "Workouts", val: "47", delta: "+12" },
                  { label: "Body Weight", val: "82.3 kg", delta: "-2.1kg" },
                  { label: "Streak", val: "14 days", delta: "🔥" },
                ].map((s) => (
                  <div key={s.label} className="stat-card">
                    <p className="stat-label">{s.label}</p>
                    <p className="stat-value text-lg">{s.val}</p>
                    <p className="stat-delta text-success">{s.delta}</p>
                  </div>
                ))}
              </div>
              {/* Simulated chart bars */}
              <div className="h-32 flex items-end gap-2 px-2">
                {[40, 55, 48, 70, 65, 80, 75, 90, 85, 95, 88, 100].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-md opacity-80 transition-all duration-300"
                    style={{
                      height: `${h}%`,
                      background: i === 11
                        ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                        : `rgba(99,102,241,${0.2 + i * 0.06})`,
                    }}
                  />
                ))}
              </div>
              <p className="text-center text-xs text-fg-subtle mt-2">Strength progression over 12 weeks</p>
            </div>
          </div>
          {/* Glow beneath */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-3/4 h-20 bg-brand-600/20 blur-3xl rounded-full pointer-events-none" />
        </div>
      </section>

      {/* ─── Features ─────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-brand-400 font-semibold text-sm uppercase tracking-widest mb-3">Features</p>
            <h2 className="heading-1 mb-4">Everything you need to excel</h2>
            <p className="subheading max-w-xl mx-auto">
              Built for athletes who are serious about results. Coaches who want to scale. No fluff, just performance.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="card-hover p-6 group">
                <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110`}>
                  <f.icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <h3 className="font-semibold text-fg mb-2">{f.title}</h3>
                <p className="text-sm text-fg-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it Works ─────────────────────────── */}
      <section className="py-24 px-6 bg-surface-muted/30">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-brand-400 font-semibold text-sm uppercase tracking-widest mb-3">Process</p>
          <h2 className="heading-1 mb-16">Up and running in minutes</h2>

          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { n: "01", title: "Create your account", desc: "Sign up free. Complete a quick onboarding to personalise your experience." },
              { n: "02", title: "Choose your path", desc: "Use a prebuilt split, create your own plan, or enter a coach's access code." },
              { n: "03", title: "Start training", desc: "Log workouts, track progress, and chat with your coach — all from one dashboard." },
            ].map((s) => (
              <div key={s.n} className="flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-brand flex items-center justify-center text-white font-bold text-lg shadow-glow-sm">
                  {s.n}
                </div>
                <h3 className="font-semibold text-lg">{s.title}</h3>
                <p className="text-fg-muted text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ──────────────────────────────── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-brand-400 font-semibold text-sm uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="heading-1 mb-4">Simple, transparent access</h2>
            <p className="subheading">Premium is unlocked via a coach-provided access code.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`relative rounded-2xl p-8 border ${p.highlight
                  ? "border-brand-600/60 bg-surface-card shadow-glow-sm"
                  : "card"
                  }`}
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="badge-brand text-xs px-3 py-1">Recommended</span>
                  </div>
                )}
                <p className="text-fg-muted text-sm mb-1">{p.name}</p>
                <p className="text-4xl font-extrabold mb-1">{p.price}</p>
                <p className="text-fg-subtle text-xs mb-4">{p.period}</p>
                <p className="text-sm text-fg-muted mb-6">{p.desc}</p>
                <ul className="space-y-2.5 mb-8">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                      <span className="text-fg-muted">{f}</span>
                    </li>
                  ))}
                </ul>
                {!isLoaded ? (
                  <div className="h-11 w-full bg-surface-muted animate-pulse rounded-xl" />
                ) : !isSignedIn ? (
                  <SignUpButton mode="modal" fallbackRedirectUrl="/onboarding">
                    <button className={cn("w-full h-11 rounded-xl font-bold flex items-center justify-center gap-2 transition-all", p.highlight ? "btn-primary" : "btn-secondary")}>
                      {p.cta}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </SignUpButton>
                ) : (
                  <Link href="/dashboard" className={cn("w-full h-11 rounded-xl font-bold flex items-center justify-center gap-2 transition-all", p.highlight ? "btn-primary" : "btn-secondary")}>
                    Go to Dashboard
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─────────────────────────── */}
      <section className="py-24 px-6 bg-surface-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-brand-400 font-semibold text-sm uppercase tracking-widest mb-3">Results</p>
            <h2 className="heading-1 mb-4">Loved by athletes</h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="card p-6">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-warning text-warning" />
                  ))}
                </div>
                <p className="text-sm text-fg-muted leading-relaxed mb-4">&ldquo;{t.text}&rdquo;</p>
                <div>
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-fg-subtle">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="card p-12 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-brand opacity-5 pointer-events-none" />
            <h2 className="heading-1 mb-4">Ready to transform?</h2>
            <p className="subheading mb-8">
              Join thousands of athletes already training smarter with FitCoach Pro.
            </p>
            {!isLoaded ? (
              <div className="h-12 w-48 bg-surface-muted animate-pulse rounded-xl mx-auto" />
            ) : !isSignedIn ? (
              <SignUpButton mode="modal" fallbackRedirectUrl="/onboarding">
                <button className="btn-primary btn-lg mx-auto w-max">
                  Get Started — it&apos;s free
                  <ArrowRight className="w-5 h-5" />
                </button>
              </SignUpButton>
            ) : (
              <Link href="/dashboard" className="btn-primary btn-lg mx-auto w-max">
                Back to Training
                <ArrowRight className="w-5 h-5" />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────── */}
      <footer className="border-t border-surface-border py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-brand flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-sm">FitCoach Pro</span>
          </div>
          <p className="text-xs text-fg-subtle">© 2026 FitCoach Pro. All rights reserved.</p>
          <div className="flex gap-4 text-xs text-fg-subtle">
            <Link href="#" className="hover:text-fg transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-fg transition-colors">Terms</Link>
            <Link href="#" className="hover:text-fg transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
