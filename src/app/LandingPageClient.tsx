"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth, UserButton, SignInButton, SignUpButton } from "@clerk/nextjs";
import {
  Zap,
  BarChart3,
  MessageSquare,
  Shield,
  Check,
  Dumbbell,
  Target,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { landingMediaSlot } from "@/lib/landingMedia";
import { siteConfig } from "@/lib/site";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { LandingHeroTransformation } from "@/components/landing/LandingHeroTransformation";
import { LandingLiftsSection } from "@/components/landing/LandingLiftsSection";
import { LandingVideoWarmup } from "@/components/landing/LandingVideoWarmup";

const features = [
  {
    icon: Dumbbell,
    title: "Workout Plans",
    desc: "Follow coach-built programmes or create your own weekly splits.",
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
    desc: "Log sets, reps, and weight. Track PRs and estimated maxes over time.",
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
    helperText:
      "Premium is unlocked using an access code provided by your coach after you create your account.",
    highlight: true,
  },
];

export default function LandingPageClient() {
  const { isLoaded, isSignedIn } = useAuth();
  return (
    <div className="min-h-screen bg-surface text-fg overflow-hidden landing-page">
      <LandingVideoWarmup />

      {/* ─── Navbar ───────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 glass glass-border border-b border-surface-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-brand">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            </div>
            <span className="font-bold text-base sm:text-lg tracking-tight">
              <BrandLogo />
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {!isLoaded ? (
              <div className="h-8 w-24 bg-surface-muted animate-pulse rounded-lg" />
            ) : !isSignedIn ? (
              <>
                <SignInButton mode="modal" fallbackRedirectUrl="/onboarding">
                  <button className="btn-ghost text-sm">Sign In</button>
                </SignInButton>
                <SignUpButton mode="modal" fallbackRedirectUrl="/onboarding">
                  <button className="btn-primary btn-sm">Get Started</button>
                </SignUpButton>
              </>
            ) : (
              <>
                <Link href="/dashboard" className="btn-secondary btn-sm">Dashboard</Link>
                <UserButton userProfileMode="navigation" userProfileUrl="/settings" />
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ─── Hero ─────────────────────────────────── */}
      <section className="relative pt-28 pb-14 sm:pt-36 sm:pb-24 px-4 sm:px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <Image
            src={landingMediaSlot("photos", "celebration")}
            alt=""
            fill
            priority
            className="object-cover object-[center_28%] opacity-[0.12] scale-105"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-surface via-surface/95 to-surface" />
        </div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 left-1/4 w-[300px] h-[300px] bg-brand-800/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center animate-fade-in">
            <div className="badge-brand mb-4 sm:mb-6 mx-auto w-max text-[10px] sm:text-xs">
              <Zap className="w-3 h-3" />
              {siteConfig.motto}
            </div>

            <h1 className="text-[1.75rem] leading-[1.1] sm:text-5xl xl:text-7xl font-extrabold tracking-tight mb-4 sm:mb-6 sm:leading-[1.05]">
              Train smarter.<br />
              <span className="text-gradient">Track everything.</span>
            </h1>

            <p className="text-[0.9375rem] sm:text-xl text-fg-muted max-w-xl mx-auto mb-6 sm:mb-10 text-balance leading-relaxed">
              Use it on your own with built-in plans and logging — or connect with a coach when you want more.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-4 max-w-xs sm:max-w-none mx-auto">
              {!isLoaded ? (
                <div className="h-10 sm:h-12 w-40 sm:w-48 bg-surface-muted animate-pulse rounded-xl mx-auto" />
              ) : !isSignedIn ? (
                <SignUpButton mode="modal" fallbackRedirectUrl="/onboarding">
                  <button className="btn-primary sm:btn-lg w-full sm:w-auto">
                    Start for Free
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </SignUpButton>
              ) : (
                <Link href="/dashboard" className="btn-primary sm:btn-lg w-full sm:w-auto">
                  Go to Dashboard
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </Link>
              )}
              <Link href="#features" className="btn-secondary sm:btn-lg w-full sm:w-auto">
                See what&apos;s included
              </Link>
            </div>

            <p className="text-[10px] sm:text-xs text-fg-subtle mt-4 sm:mt-6 leading-relaxed px-2">
              No credit card required · Free forever plan available
            </p>

            <div className="mt-8 sm:mt-12 flex justify-center px-0 sm:px-0">
              <LandingHeroTransformation />
            </div>
          </div>
        </div>
      </section>

      <LandingLiftsSection />

      {/* ─── Features ─────────────────────────────── */}
      <section id="features" className="py-14 sm:py-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <p className="text-brand-400 font-semibold text-xs sm:text-sm uppercase tracking-widest mb-2 sm:mb-3">Features</p>
            <h2 className="heading-1 mb-4">Everything you need to excel</h2>
            <p className="subheading max-w-xl mx-auto">
              Built for athletes who are serious about results. Coaches who want to scale. No fluff, just performance.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((f, i) => (
              <div key={i} className="card-hover p-4 sm:p-6 group">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${f.bg} flex items-center justify-center mb-3 sm:mb-4 transition-transform duration-300 group-hover:scale-110`}>
                  <f.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${f.color}`} />
                </div>
                <h3 className="font-semibold text-sm sm:text-base text-fg mb-1.5 sm:mb-2">{f.title}</h3>
                <p className="text-xs sm:text-sm text-fg-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it Works ─────────────────────────── */}
      <section className="py-14 sm:py-24 px-4 sm:px-6 bg-surface-muted/30">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-brand-400 font-semibold text-xs sm:text-sm uppercase tracking-widest mb-2 sm:mb-3">Process</p>
          <h2 className="heading-1 mb-10 sm:mb-16">Up and running in minutes</h2>

          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            {[
              { n: "01", title: "Create your account", desc: "Sign up free. Complete a quick onboarding to personalise your experience." },
              { n: "02", title: "Choose your path", desc: "Use a prebuilt split, create your own plan, or enter a coach's access code." },
              { n: "03", title: "Start training", desc: "Log workouts, track progress, and chat with your coach — all from one dashboard." },
            ].map((s) => (
              <div key={s.n} className="flex flex-col items-center gap-3 sm:gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-brand flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-glow-sm">
                  {s.n}
                </div>
                <h3 className="font-semibold text-base sm:text-lg">{s.title}</h3>
                <p className="text-fg-muted text-xs sm:text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ──────────────────────────────── */}
      <section id="pricing" className="py-14 sm:py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <p className="text-brand-400 font-semibold text-xs sm:text-sm uppercase tracking-widest mb-2 sm:mb-3">Pricing</p>
            <h2 className="heading-1 mb-4">Simple, transparent access</h2>
            <p className="subheading">Premium is unlocked via a coach-provided access code.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 items-stretch">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`relative flex flex-col h-full rounded-2xl p-5 sm:p-8 border ${p.highlight
                  ? "border-brand-600/60 bg-surface-card shadow-glow-sm"
                  : "card"
                  }`}
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="badge-brand text-[10px] sm:text-xs px-2.5 sm:px-3 py-1">Recommended</span>
                  </div>
                )}
                <p className="text-fg-muted text-xs sm:text-sm mb-1">{p.name}</p>
                <p className="text-3xl sm:text-4xl font-extrabold mb-1">{p.price}</p>
                <p className="text-fg-subtle text-[10px] sm:text-xs mb-3 sm:mb-4">{p.period}</p>
                <p className="text-xs sm:text-sm text-fg-muted mb-4 sm:mb-6">{p.desc}</p>
                <ul className="space-y-2 sm:space-y-2.5 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 sm:gap-2.5 text-xs sm:text-sm">
                      <Check className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                      <span className="text-fg-muted">{f}</span>
                    </li>
                  ))}
                </ul>
                {"helperText" in p && p.helperText && (
                  <p className="mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-surface-border/40 text-[11px] sm:text-xs text-fg-subtle leading-relaxed">
                    {p.helperText}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────── */}
      <section className="py-14 sm:py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="card p-6 sm:p-12 relative overflow-hidden min-h-[240px] sm:min-h-[320px] flex flex-col items-center justify-center">
            <Image
              src={landingMediaSlot("photos", "celebration")}
              alt="Athlete celebrating on the platform"
              fill
              className="object-cover object-[center_28%] opacity-55"
              sizes="768px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface/95 via-surface/40 to-surface/20 pointer-events-none" />
            <div className="relative">
            <h2 className="heading-1 mb-3 sm:mb-4">Ready to get started?</h2>
            <p className="subheading mb-6 sm:mb-8 max-w-xl mx-auto">
              Create a free account and start logging workouts today. If you&apos;re working with a coach, you can redeem your access code during onboarding or later in Settings.
            </p>
            {!isLoaded ? (
              <div className="h-12 w-48 bg-surface-muted animate-pulse rounded-xl mx-auto" />
            ) : !isSignedIn ? (
              <SignUpButton mode="modal" fallbackRedirectUrl="/onboarding">
                <button className="btn-primary sm:btn-lg mx-auto w-max">
                  Get Started • It&apos;s Free
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </SignUpButton>
            ) : (
              <Link href="/dashboard" className="btn-primary sm:btn-lg mx-auto w-max">
                Back to Training
                <ArrowRight className="w-5 h-5" />
              </Link>
            )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────── */}
      <footer className="border-t border-surface-border py-6 sm:py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-brand flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-sm">{siteConfig.name}</span>
          </div>
          <p className="text-xs text-fg-subtle">© 2026 {siteConfig.name}. All rights reserved.</p>
          <div className="flex gap-4 text-xs text-fg-subtle">
            <Link href="/privacy" className="hover:text-fg transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-fg transition-colors">Terms</Link>
            <a href={`mailto:${siteConfig.contactEmail}`} className="hover:text-fg transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
