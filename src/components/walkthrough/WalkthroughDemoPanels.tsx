"use client";

import {
    Activity,
    Bell,
    Calendar,
    Check,
    ChevronRight,
    ClipboardList,
    MessageSquare,
    Play,
    Scale,
    TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function WalkthroughDemoBadge() {
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-brand-300">
            Tour preview
        </span>
    );
}

export function WalkthroughDashboardWorkoutDemo() {
    return (
        <div id="tour-dashboard-workout" className="card p-5 sm:p-6 border-brand-500/20 bg-gradient-to-br from-surface-card to-brand-950/20">
            <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">Today</p>
                        <WalkthroughDemoBadge />
                    </div>
                    <h3 className="text-xl font-black text-fg">Upper Push — Week 3</h3>
                    <p className="text-sm text-fg-muted mt-1">Bench press, incline DB, cables · 6 exercises</p>
                </div>
                <span className="badge-success text-[10px]">Scheduled</span>
            </div>
            <button type="button" className="btn-primary w-full sm:w-auto pointer-events-none">
                <Play className="w-4 h-4" />
                Start Workout
            </button>
        </div>
    );
}

export function WalkthroughDashboardMetricsDemo() {
    return (
        <div id="tour-dashboard-metrics" className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            {[
                { label: "Weight", value: "77.2 kg", icon: Scale },
                { label: "Calories", value: "2,650", icon: Activity },
                { label: "Steps", value: "9,842", icon: TrendingUp },
                { label: "Sleep", value: "7.5 h", icon: Activity },
            ].map((item) => (
                <div key={item.label} className="stat-card border border-surface-border/60">
                    <div className="flex items-center justify-between gap-2">
                        <p className="stat-label">{item.label}</p>
                        {item.label === "Weight" ? <WalkthroughDemoBadge /> : null}
                    </div>
                    <p className="stat-value text-lg">{item.value}</p>
                    <p className="stat-delta text-success">Logged today</p>
                </div>
            ))}
        </div>
    );
}

export function WalkthroughDashboardActivityDemo() {
    return (
        <div id="tour-dashboard-activity" className="card p-5 border-surface-border/60">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-fg">Recent sessions</h3>
                <WalkthroughDemoBadge />
            </div>
            <div className="space-y-3">
                {[
                    { name: "Lower Strength", when: "Yesterday · 58 min", sets: "22 sets logged" },
                    { name: "Upper Push", when: "Mon · 52 min", sets: "PR on bench" },
                ].map((session) => (
                    <div key={session.name} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-muted/40 border border-surface-border/50">
                        <div>
                            <p className="font-semibold text-sm text-fg">{session.name}</p>
                            <p className="text-xs text-fg-muted">{session.when}</p>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-success">{session.sets}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function WalkthroughPlansDemo() {
    return (
        <div id="tour-plans-overview" className="card p-5 sm:p-6 border-brand-500/20">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">Active plan</p>
                        <WalkthroughDemoBadge />
                    </div>
                    <h3 className="text-2xl font-black text-fg">Hypertrophy Block A</h3>
                    <p className="text-sm text-fg-muted mt-1">4-day split · Assigned by Coach Tony</p>
                </div>
                <span className="badge-brand text-[10px]">Premium</span>
            </div>
            <div className="mt-5 grid sm:grid-cols-2 gap-3">
                {["Mon · Upper Push", "Wed · Lower Strength", "Fri · Upper Pull", "Sat · Legs"].map((day) => (
                    <div key={day} className="rounded-xl border border-surface-border/60 bg-surface-muted/30 px-3 py-2.5 text-sm font-semibold text-fg">
                        {day}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function WalkthroughCalendarDemo() {
    return (
        <div id="tour-calendar-overview" className="card p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-fg flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-brand-400" />
                    June 2026
                </h3>
                <WalkthroughDemoBadge />
            </div>
            <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-fg-subtle mb-2">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <span key={d}>{d}</span>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 28 }).map((_, i) => {
                    const day = i + 1;
                    const completed = [2, 5, 9, 12, 16].includes(day);
                    const missed = day === 7;
                    const scheduled = day === 19;
                    const checkIn = day === 21;
                    return (
                        <div
                            key={day}
                            className={cn(
                                "aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-bold border",
                                completed && "bg-success/15 border-success/30 text-success",
                                missed && "bg-danger/10 border-danger/20 text-danger/80",
                                scheduled && "bg-brand-500/15 border-brand-500/30 text-brand-300",
                                checkIn && "bg-warning/10 border-warning/30 text-warning",
                                !completed && !missed && !scheduled && !checkIn && "bg-surface-muted/20 border-surface-border/40 text-fg-muted"
                            )}
                        >
                            {day}
                        </div>
                    );
                })}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
                <span className="text-success">Completed</span>
                <span className="text-brand-300">Scheduled</span>
                <span className="text-danger/80">Missed</span>
                <span className="text-warning">Check-in due</span>
            </div>
        </div>
    );
}

export function WalkthroughCheckInsDemo() {
    return (
        <div id="tour-checkins-overview" className="card p-5 sm:p-6 border-brand-500/15">
            <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">Week 12 check-in</p>
                    <h3 className="text-lg font-black text-fg">Submitted · Reviewed</h3>
                </div>
                <WalkthroughDemoBadge />
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
                {["Front", "Side", "Back"].map((label) => (
                    <div key={label} className="aspect-[3/4] rounded-xl bg-surface-muted border border-surface-border/60 flex items-end justify-center pb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle">{label}</span>
                    </div>
                ))}
            </div>
            <div className="space-y-2 text-sm">
                <p className="text-fg-muted"><span className="text-fg font-semibold">77.0 kg</span> · Avg since last check-in</p>
                <p className="rounded-xl bg-brand-500/10 border border-brand-500/20 px-3 py-2 text-fg-muted">
                    <span className="font-semibold text-brand-300">Coach feedback:</span> Strong week — push load on bench if recovery feels good.
                </p>
            </div>
        </div>
    );
}

export function WalkthroughProgressDemo() {
    return (
        <div id="tour-progress-overview" className="space-y-4">
            <div className="card p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-fg">Bench press · estimated 1RM</h3>
                    <WalkthroughDemoBadge />
                </div>
                <div className="h-36 flex items-end gap-1.5">
                    {[62, 68, 71, 74, 78, 82, 85, 88, 92, 95].map((h, i) => (
                        <div
                            key={i}
                            className="flex-1 rounded-t-md bg-brand-500/30 border border-brand-500/20"
                            style={{ height: `${h}%` }}
                        />
                    ))}
                </div>
                <p className="text-xs text-success font-bold mt-3">+8 kg over 10 weeks · New PR 120 kg × 6</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
                {[
                    { label: "Bodyweight", value: "77.2 kg", delta: "+1.8 kg" },
                    { label: "Weekly volume", value: "42,500 kg", delta: "+6%" },
                    { label: "PR count", value: "5 this month", delta: "Bench, squat, row" },
                ].map((stat) => (
                    <div key={stat.label} className="stat-card">
                        <p className="stat-label">{stat.label}</p>
                        <p className="stat-value text-lg">{stat.value}</p>
                        <p className="stat-delta text-success">{stat.delta}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function WalkthroughChatDemo() {
    return (
        <div id="tour-chat-overview" className="card overflow-hidden border-brand-500/20">
            <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-brand-400" />
                    <p className="font-bold text-sm text-fg">Coach Tony</p>
                </div>
                <WalkthroughDemoBadge />
            </div>
            <div className="p-4 space-y-3 bg-surface-muted/20 min-h-[220px]">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface-muted border border-surface-border px-3 py-2 text-sm text-fg-muted">
                    Great check-in — add 2.5 kg to bench if bar speed stays crisp.
                </div>
                <div className="max-w-[85%] ml-auto rounded-2xl rounded-br-md bg-brand-500/20 border border-brand-500/30 px-3 py-2 text-sm text-fg">
                    Will do. Starting upper push now.
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface-muted border border-surface-border px-3 py-2 text-sm text-fg-muted flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-brand-400" />
                    Plan update · Week 3 deload removed
                </div>
            </div>
            <div className="px-4 py-3 border-t border-surface-border flex items-center gap-2 text-xs text-fg-subtle">
                <Bell className="w-3.5 h-3.5" />
                Unread coach messages appear here with quick replies.
            </div>
        </div>
    );
}

export function WalkthroughFinishBanner() {
    return (
        <div className="card p-4 border-success/25 bg-success/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center">
                    <Check className="w-5 h-5 text-success" />
                </div>
                <p className="text-sm text-fg-muted">
                    Tour complete — tap <span className="font-bold text-fg">Start Workout</span> above to begin.
                </p>
            </div>
            <ChevronRight className="w-4 h-4 text-success shrink-0" />
        </div>
    );
}
