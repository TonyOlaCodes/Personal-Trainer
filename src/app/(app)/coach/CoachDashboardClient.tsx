"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Activity, Calendar,
    ChevronRight,
    Dumbbell, Loader2, AlertTriangle, MessageCircle,
    ClipboardCheck, Clock,
    Bell, ArrowUpRight, CheckCircle2, Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { resolveUploadUrl } from "@/lib/uploadUrls";
import { getPresenceIndicator, formatLastActiveText } from "@/lib/userPresence";
import { PendingReviewsModal, type PendingReviewItem } from "@/components/shared/PendingReviewsModal";
import { StreakBadge } from "@/components/shared/StreakBadge";
import { formatCoachPlanLabel } from "@/lib/coachPlans";
import {
    type CoachDashboardInsights,
    type ClientDashboardInsight,
    type UpcomingEvent,
} from "@/lib/coachDashboardInsights";

const CHECK_IN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const UPCOMING_PREVIEW_COUNT = 6;

interface Client {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    lastActiveAt?: string | null;
    activeSession?: { workoutName: string; logId: string; workoutId: string } | null;
    hasCheckInSchedule?: boolean;
    checkInSchedule: { day: number | null; frequencyWeeks: number | null; startDate: string | null };
    targetCalories: number | null;
    targetSteps: number | null;
    targetSleepHours: number | null;
    suggestedPlanId?: string | null;
    goal?: string | null;
    currentWeightKg?: number | null;
    targetWeightKg?: number | null;
    stats: { logs: number; checkins: number };
    recentLogs: { id: string; workoutName: string; date: string; setCount: number }[];
    recentCheckIns: { id: string; week: number; date: string; status: string; bodyweightKg?: number | null }[];
    bodyweightHistory: { date: string; weightKg: number }[];
}

interface RecentCheckIn {
    id: string;
    clientName: string;
    week: number;
    date: string;
    status: string;
}

interface Props {
    clients: Client[];
    recentCheckIns: RecentCheckIn[];
    pendingReviews: PendingReviewItem[];
    availablePlans: { id: string; name: string; type: string }[];
    insights: CoachDashboardInsights;
}

function roundWeightKg(n: number) {
    return Math.round(n * 10) / 10;
}

function buildClientWeightSeries(client: Client): { date: string; weightKg: number }[] {
    const byDate = new Map<string, number>();
    for (const row of client.bodyweightHistory) {
        byDate.set(row.date, row.weightKg);
    }
    for (const checkIn of client.recentCheckIns) {
        if (checkIn.bodyweightKg != null) {
            const date = checkIn.date.slice(0, 10);
            byDate.set(date, checkIn.bodyweightKg);
        }
    }
    return [...byDate.entries()]
        .map(([date, weightKg]) => ({ date, weightKg }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

function computeSevenDayWeightChange(history: { date: string; weightKg: number }[]): {
    changeKg: number;
    startWeight: number;
    endWeight: number;
} | null {
    if (history.length === 0) return null;

    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffKey = cutoff.toISOString().slice(0, 10);

    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1];
    if (latest.date < cutoffKey) return null;

    const inWindow = sorted.filter((row) => row.date >= cutoffKey);
    let baseline = inWindow[0] ?? latest;
    if (inWindow.length === 0) {
        const before = sorted.filter((row) => row.date <= cutoffKey);
        baseline = before.length > 0 ? before[before.length - 1]! : sorted[0]!;
    } else if (inWindow.length === 1) {
        const before = sorted.filter((row) => row.date < inWindow[0]!.date);
        if (before.length > 0) baseline = before[before.length - 1]!;
    } else {
        baseline = inWindow[0]!;
    }

    const changeKg = roundWeightKg(latest.weightKg - baseline.weightKg);
    return { changeKg, startWeight: baseline.weightKg, endWeight: latest.weightKg };
}

function isWeightChangeTowardGoal(
    changeKg: number,
    goal: string | null | undefined,
    targetWeightKg: number | null | undefined,
    startWeight: number,
    endWeight: number
): boolean | null {
    if (Math.abs(changeKg) < 0.05) return true;

    if (targetWeightKg != null && targetWeightKg > 0) {
        const startDistance = Math.abs(startWeight - targetWeightKg);
        const endDistance = Math.abs(endWeight - targetWeightKg);
        if (endDistance < startDistance - 0.05) return true;
        if (endDistance > startDistance + 0.05) return false;
    }

    switch (goal) {
        case "LOSE_WEIGHT":
            return changeKg < 0;
        case "GAIN_MUSCLE":
        case "STRENGTH":
            return changeKg > 0;
        case "RECOMPOSITION":
            return Math.abs(changeKg) <= 0.5;
        default:
            if (targetWeightKg != null && targetWeightKg > 0) {
                return Math.abs(endWeight - targetWeightKg) <= Math.abs(startWeight - targetWeightKg);
            }
            return null;
    }
}

function SevenDayWeightBadge({ client }: { client: Client }) {
    const series = buildClientWeightSeries(client);
    const delta = computeSevenDayWeightChange(series);
    if (!delta) return null;

    const towardGoal = isWeightChangeTowardGoal(
        delta.changeKg,
        client.goal,
        client.targetWeightKg,
        delta.startWeight,
        delta.endWeight
    );

    const formatted = `${delta.changeKg > 0 ? "+" : ""}${delta.changeKg.toFixed(1)} kg`;

    return (
        <span
            className={cn(
                "text-[10px] font-black px-2 py-0.5 rounded-md border tabular-nums shrink-0",
                towardGoal === true && "text-success bg-success/10 border-success/25",
                towardGoal === false && "text-red-400 bg-red-400/10 border-red-400/25",
                towardGoal === null && "text-fg-muted bg-surface-muted/50 border-surface-border"
            )}
            title="Weight change over the last 7 days"
        >
            {formatted}
        </span>
    );
}

function ClientInsightRow({
    insight,
    client,
}: {
    insight: ClientDashboardInsight | undefined;
    client: Client;
}) {
    if (!insight) return null;

    return (
        <div className="space-y-2 border-t border-surface-border pt-4">
            <div className="flex flex-wrap gap-2">
                {insight.todayWorkout.planned ? (
                    <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border",
                        insight.todayWorkout.completed
                            ? "bg-success/10 text-success border-success/20"
                            : "bg-warning/10 text-warning border-warning/20"
                    )}>
                        Today: {insight.todayWorkout.name}
                        {insight.todayWorkout.completed ? " ✓" : " · pending"}
                    </span>
                ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border bg-surface-muted/40 text-fg-subtle border-surface-border">
                        Rest day
                    </span>
                )}
                {insight.workoutStreak > 0 && (
                    <StreakBadge streak={insight.workoutStreak} size="sm" showLabel />
                )}
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <p className="text-[10px] text-fg-subtle uppercase font-bold tracking-widest">Check-in</p>
                    <p className={cn(
                        "text-xs font-semibold",
                        insight.checkInStatus === "overdue" && "text-warning",
                        insight.checkInStatus === "due_today" && "text-brand-400",
                        insight.checkInStatus !== "overdue" && insight.checkInStatus !== "due_today" && "text-fg"
                    )}>
                        {insight.checkInLabel}
                    </p>
                </div>
                <div>
                    <p className="text-[10px] text-fg-subtle uppercase font-bold tracking-widest">Adherence</p>
                    <p className="text-xs font-semibold text-fg">
                        {insight.compliancePercent != null
                            ? `${insight.compliancePercent}% this week`
                            : "—"}
                    </p>
                </div>
            </div>
            {insight.unreadMessages > 0 && (
                <p className="text-[10px] font-bold text-brand-400 flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" />
                    {insight.unreadMessages} unread message{insight.unreadMessages === 1 ? "" : "s"}
                </p>
            )}
        </div>
    );
}

export function CoachDashboardClient({ clients, recentCheckIns, pendingReviews, availablePlans, insights }: Props) {
    const router = useRouter();
    const [skippedClients, setSkippedClients] = useState<string[]>([]);
    const [savingSetup, setSavingSetup] = useState(false);
    const [showPendingReviews, setShowPendingReviews] = useState(false);
    const [showAllUpcoming, setShowAllUpcoming] = useState(false);

    const visibleUpcoming = useMemo(() => {
        const events = insights.upcomingEvents;
        if (showAllUpcoming) return events;
        return events.slice(0, UPCOMING_PREVIEW_COUNT);
    }, [insights.upcomingEvents, showAllUpcoming]);

    const hasMoreUpcoming = insights.upcomingEvents.length > UPCOMING_PREVIEW_COUNT;

    const upcomingByDate = useMemo(() => {
        const groups = new Map<string, UpcomingEvent[]>();
        for (const event of visibleUpcoming) {
            const rows = groups.get(event.dateLabel) ?? [];
            rows.push(event);
            groups.set(event.dateLabel, rows);
        }
        return groups;
    }, [visibleUpcoming]);

    const sortedClients = useMemo(() => {
        return [...clients].sort((a, b) => {
            const aAttention = insights.clientInsights[a.id]?.needsAttention ? 0 : 1;
            const bAttention = insights.clientInsights[b.id]?.needsAttention ? 0 : 1;
            if (aAttention !== bAttention) return aAttention - bAttention;
            return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
        });
    }, [clients, insights.clientInsights]);

    const pendingCheckIns = pendingReviews.length;
    const { totals } = insights;

    // Queue of clients who need onboarding setup and haven't been skipped
    const needsSetupClients = clients.filter(c => !c.hasCheckInSchedule && !skippedClients.includes(c.id));
    const currentSetupClient = needsSetupClients[0];

    // Local form states for wizard
    const [setupDay, setSetupDay] = useState(6);
    const [setupFreq, setSetupFreq] = useState(1);
    const [setupCal, setSetupCal] = useState("");
    const [setupSteps, setSetupSteps] = useState("");
    const [setupSleep, setSetupSleep] = useState("");
    const [setupWeight, setSetupWeight] = useState("");
    const [setupPlanId, setSetupPlanId] = useState("");

    // Pre-fill setup inputs when switching between clients
    useEffect(() => {
        if (currentSetupClient) {
            setSetupDay(currentSetupClient.checkInSchedule?.day !== null ? currentSetupClient.checkInSchedule.day : 6);
            setSetupFreq(currentSetupClient.checkInSchedule?.frequencyWeeks !== null ? currentSetupClient.checkInSchedule.frequencyWeeks : 1);
            setSetupCal(currentSetupClient.targetCalories ? String(currentSetupClient.targetCalories) : "");
            setSetupSteps(currentSetupClient.targetSteps ? String(currentSetupClient.targetSteps) : "");
            setSetupSleep(currentSetupClient.targetSleepHours ? String(currentSetupClient.targetSleepHours) : "");
            setSetupWeight(currentSetupClient.targetWeightKg ? String(currentSetupClient.targetWeightKg) : "");
            const suggested = currentSetupClient.suggestedPlanId ?? "";
            const validSuggested = suggested && availablePlans.some((plan) => plan.id === suggested)
                ? suggested
                : "";
            setSetupPlanId(validSuggested);
        }
    }, [currentSetupClient?.id, currentSetupClient?.suggestedPlanId, availablePlans]);

    const handleSaveSetup = async () => {
        if (!currentSetupClient) return;
        setSavingSetup(true);
        try {
            // 1. Save schedule
            const scheduleRes = await fetch("/api/coach/clients/checkin-schedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId: currentSetupClient.id,
                    day: setupDay,
                    frequencyWeeks: setupFreq,
                }),
            });
            if (!scheduleRes.ok) throw new Error("Failed to save check-in schedule");

            // 2. Save goals
            const goalsRes = await fetch("/api/coach/clients/goals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId: currentSetupClient.id,
                    targetCalories: setupCal ? Math.round(Number(setupCal)) : null,
                    targetSteps: setupSteps ? Math.round(Number(setupSteps)) : null,
                    targetSleepHours: setupSleep ? Number(setupSleep) : null,
                    targetWeightKg: setupWeight ? Number(setupWeight) : null,
                }),
            });
            if (!goalsRes.ok) throw new Error("Failed to save client targets");

            // 3. Save plan if selected
            if (setupPlanId) {
                const planRes = await fetch("/api/coach/clients/plan", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        clientId: currentSetupClient.id,
                        planId: setupPlanId,
                    }),
                });
                if (!planRes.ok) throw new Error("Failed to assign training plan");
            }

            // Success: advance to next client in the queue
            setSkippedClients(prev => [...prev, currentSetupClient.id]);
            router.refresh();
        } catch (e: any) {
            alert(e.message || "An error occurred during client setup");
        } finally {
            setSavingSetup(false);
        }
    };

    const handleSkipSetup = () => {
        if (currentSetupClient) {
            setSkippedClients(prev => [...prev, currentSetupClient.id]);
        }
    };

    // If there is a client needing setup, render the onboarding wizard!
    if (currentSetupClient) {
        return (
            <div className="max-w-2xl mx-auto space-y-6 animate-fade-in py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-fg tracking-tight">Onboard New Athlete</h2>
                        <p className="text-xs text-fg-muted mt-1">Configure customizable settings for your new client.</p>
                    </div>
                    <span className="badge-brand text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                        Pending Setup: {needsSetupClients.length} left
                    </span>
                </div>

                <div className="card p-6 md:p-8 space-y-6 border-brand-500/20 bg-brand-950/5 shadow-glow-brand-sm">
                    {/* Athlete Profile Summary */}
                    <div className="flex items-center gap-4 pb-6 border-b border-surface-border">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-brand flex items-center justify-center text-lg font-black text-white overflow-hidden shadow-glow-sm">
                            {currentSetupClient.avatarUrl ? (
                                <img src={resolveUploadUrl(currentSetupClient.avatarUrl)} alt="avatar" className="w-full h-full object-cover rounded-2xl" />
                            ) : (
                                getInitials(currentSetupClient.name)
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-fg">{currentSetupClient.name}</h3>
                            <p className="text-xs text-fg-subtle mt-0.5">{currentSetupClient.email}</p>
                            {currentSetupClient.goal && (
                                <span className="inline-block mt-2 badge-muted text-[8px] uppercase tracking-wider">
                                    Goal: {currentSetupClient.goal.replace("_", " ")}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-6">
                        {/* 1. Check-in Schedule */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-black text-brand-400 uppercase tracking-widest flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                1. Check-in Schedule
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <label className="space-y-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Check-in Day</span>
                                    <select
                                        value={setupDay}
                                        onChange={(e) => setSetupDay(Number(e.target.value))}
                                        className="input h-11 text-sm font-bold bg-surface-muted/30"
                                    >
                                        {CHECK_IN_DAYS.map((day, idx) => (
                                            <option key={day} value={idx}>{day}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Frequency</span>
                                    <select
                                        value={setupFreq}
                                        onChange={(e) => setSetupFreq(Number(e.target.value))}
                                        className="input h-11 text-sm font-bold bg-surface-muted/30"
                                    >
                                        <option value={1}>Weekly</option>
                                        <option value={2}>Every 2 weeks</option>
                                        <option value={4}>Every 4 weeks</option>
                                    </select>
                                </label>
                            </div>
                        </div>

                        {/* 2. Target Metrics */}
                        <div className="space-y-3 pt-2">
                            <h4 className="text-xs font-black text-brand-400 uppercase tracking-widest flex items-center gap-2">
                                <Activity className="w-4 h-4" />
                                2. Athlete Targets
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <label className="space-y-1.5">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Calories (kcal)</span>
                                    <input
                                        type="number"
                                        placeholder="e.g. 2500"
                                        value={setupCal}
                                        onChange={(e) => setSetupCal(e.target.value)}
                                        className="input h-11 text-sm font-bold bg-surface-muted/30 animate-pulse-slow"
                                    />
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Daily Steps</span>
                                    <input
                                        type="number"
                                        placeholder="e.g. 10000"
                                        value={setupSteps}
                                        onChange={(e) => setSetupSteps(e.target.value)}
                                        className="input h-11 text-sm font-bold bg-surface-muted/30"
                                    />
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Sleep (hrs)</span>
                                    <input
                                        type="number"
                                        step="0.5"
                                        placeholder="e.g. 8.0"
                                        value={setupSleep}
                                        onChange={(e) => setSetupSleep(e.target.value)}
                                        className="input h-11 text-sm font-bold bg-surface-muted/30"
                                    />
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Weight Target (kg)</span>
                                    <input
                                        type="number"
                                        step="0.1"
                                        placeholder="e.g. 75.0"
                                        value={setupWeight}
                                        onChange={(e) => setSetupWeight(e.target.value)}
                                        className="input h-11 text-sm font-bold bg-surface-muted/30"
                                    />
                                </label>
                            </div>
                        </div>

                        {/* 3. Assign Training Programme */}
                        <div className="space-y-3 pt-2">
                            <h4 className="text-xs font-black text-brand-400 uppercase tracking-widest flex items-center gap-2">
                                <Dumbbell className="w-4 h-4" />
                                3. Training Programme
                            </h4>
                            <label className="space-y-1.5 block">
                                <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Select Programme</span>
                                {setupPlanId && (
                                    <p className="text-[10px] text-brand-400/90 font-semibold">
                                        Pre-filled from invite — change below if needed.
                                    </p>
                                )}
                                <select
                                    value={setupPlanId}
                                    onChange={(e) => setSetupPlanId(e.target.value)}
                                    className="input h-11 text-sm font-bold bg-surface-muted/30"
                                >
                                    <option value="">No plan / Assign later</option>
                                    {availablePlans.map((plan) => (
                                        <option key={plan.id} value={plan.id}>{formatCoachPlanLabel(plan)}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="pt-6 border-t border-surface-border flex flex-col sm:flex-row items-center justify-between gap-4">
                        <button
                            type="button"
                            onClick={handleSkipSetup}
                            disabled={savingSetup}
                            className="text-xs font-black text-fg-subtle hover:text-fg uppercase tracking-widest transition-colors py-2 px-4 hover:bg-surface-muted/50 rounded-xl"
                        >
                            Complete Later
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveSetup}
                            disabled={savingSetup}
                            className="btn-primary w-full sm:w-auto px-8 h-12 text-xs font-black uppercase tracking-widest flex items-center gap-2 justify-center shadow-glow-brand"
                        >
                            {savingSetup ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Deploying Setup...
                                </>
                            ) : (
                                "Save & Deploy Athlete"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Default Coach Dashboard view if no setups are active
    return (
        <div className="space-y-8 animate-fade-in">
            <PendingReviewsModal
                open={showPendingReviews}
                onClose={() => setShowPendingReviews(false)}
                reviews={pendingReviews}
            />

            {/* Actionable stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Link
                    href="#clients"
                    className="stat-card transition-all hover:border-brand-500/40 hover:bg-brand-500/5"
                >
                    <Users className="w-4 h-4 text-brand-400 mb-1" />
                    <p className="stat-value">{clients.length}</p>
                    <p className="stat-label">Active Clients</p>
                </Link>
                <Link
                    href="#needs-attention"
                    className={cn(
                        "stat-card transition-all hover:border-brand-500/40 hover:bg-brand-500/5",
                        totals.clientsNeedingAttention > 0 && "border-warning/30"
                    )}
                >
                    <AlertTriangle className={cn(
                        "w-4 h-4 mb-1",
                        totals.clientsNeedingAttention > 0 ? "text-warning" : "text-fg-subtle"
                    )} />
                    <p className="stat-value">{totals.clientsNeedingAttention}</p>
                    <p className="stat-label">Need Attention</p>
                </Link>
                <button
                    type="button"
                    onClick={() => setShowPendingReviews(true)}
                    className={cn(
                        "stat-card text-left transition-all",
                        pendingCheckIns > 0
                            ? "hover:border-brand-500/40 hover:bg-brand-500/5 cursor-pointer border-brand-500/20"
                            : "cursor-pointer hover:bg-surface-muted/30"
                    )}
                >
                    <ClipboardCheck className="w-4 h-4 text-brand-400 mb-1" />
                    <p className="stat-value">{pendingCheckIns}</p>
                    <p className="stat-label">Check-ins to Review</p>
                </button>
                <Link
                    href="#clients"
                    className={cn(
                        "stat-card transition-all hover:border-brand-500/40 hover:bg-brand-500/5",
                        totals.activeWorkoutsNow > 0 && "border-success/20"
                    )}
                >
                    <Activity className="w-4 h-4 text-success mb-1" />
                    <p className="stat-value">{totals.activeWorkoutsNow}</p>
                    <p className="stat-label">In Workout Now</p>
                </Link>
            </div>

            {/* Needs Attention */}
            <section id="needs-attention" className="space-y-3 scroll-mt-6">
                <div className="flex items-center justify-between px-2">
                    <h3 className="heading-3 flex items-center gap-2">
                        <Bell className="w-5 h-5 text-warning" />
                        Needs Attention
                    </h3>
                    <Link href="/coach/invites" className="text-[10px] font-black text-brand-400 hover:text-brand-300 transition-colors uppercase tracking-widest">
                        Invite client +
                    </Link>
                </div>
                {insights.attentionItems.length === 0 ? (
                    <div className="card p-5 flex items-center gap-3 border-success/20 bg-success/5">
                        <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-fg">All caught up</p>
                            <p className="text-xs text-fg-muted">No clients need immediate action right now.</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {insights.attentionItems.map((item) => (
                            <Link
                                key={item.key}
                                href={item.href}
                                className={cn(
                                    "card p-4 flex items-center justify-between gap-3 transition-all hover:border-brand-500/40 group",
                                    item.urgent && "border-warning/30 bg-warning/5"
                                )}
                            >
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-fg group-hover:text-brand-400 transition-colors truncate">
                                        {item.label}
                                    </p>
                                    <p className="text-[10px] text-fg-subtle uppercase tracking-widest mt-0.5">
                                        Tap to view
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={cn(
                                        "text-xl font-black tabular-nums",
                                        item.urgent ? "text-warning" : "text-fg"
                                    )}>
                                        {item.count}
                                    </span>
                                    <ArrowUpRight className="w-4 h-4 text-fg-subtle group-hover:text-brand-400 transition-colors" />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            {/* Upcoming */}
            <section className="space-y-3">
                <div className="flex items-center justify-between px-2">
                    <h3 className="heading-3 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-brand-400" />
                        Upcoming
                    </h3>
                    <Link href="/coach/calendar" className="text-xs text-brand-400 hover:underline">Calendar</Link>
                </div>
                <div className="card p-4 sm:p-5">
                    <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-3">
                        Next 7 days
                    </p>
                    {insights.upcomingEvents.length === 0 ? (
                        <p className="text-sm text-fg-muted">Nothing scheduled in the next 7 days.</p>
                    ) : (
                        <div className="space-y-4">
                            {[...upcomingByDate.entries()].map(([dateLabel, events]) => (
                                <div key={dateLabel}>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle mb-2 px-1">
                                        {dateLabel}
                                    </p>
                                    <ul className="space-y-2">
                                        {events.map((event) => (
                                            <li key={event.id}>
                                                <Link
                                                    href={event.href}
                                                    className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl hover:bg-surface-muted/40 transition-colors group border border-transparent hover:border-surface-border"
                                                >
                                                    <div className="flex items-start gap-3 min-w-0">
                                                        <div className={cn(
                                                            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                                                            event.type === "checkin"
                                                                ? "bg-brand-400/10"
                                                                : "bg-success/10"
                                                        )}>
                                                            {event.type === "checkin" ? (
                                                                <ClipboardCheck className="w-4 h-4 text-brand-400" />
                                                            ) : (
                                                                <Dumbbell className="w-4 h-4 text-success" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-black text-fg truncate group-hover:text-brand-400 transition-colors">
                                                                {event.clientName}
                                                            </p>
                                                            <p className="text-xs text-fg-muted mt-0.5">
                                                                <span className={cn(
                                                                    "font-bold",
                                                                    event.type === "checkin" ? "text-brand-300" : "text-success"
                                                                )}>
                                                                    {event.typeLabel}
                                                                </span>
                                                                {" · "}
                                                                {event.label}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-fg-subtle group-hover:text-brand-400 shrink-0" />
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}
                    {hasMoreUpcoming && (
                        <button
                            type="button"
                            onClick={() => setShowAllUpcoming((prev) => !prev)}
                            className="w-full text-center text-xs font-bold text-brand-400 hover:text-brand-300 transition-colors pt-4 mt-2 border-t border-surface-border"
                        >
                            {showAllUpcoming
                                ? "Show less"
                                : `View more (${insights.upcomingEvents.length - UPCOMING_PREVIEW_COUNT} more)`}
                        </button>
                    )}
                </div>
            </section>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Client Roster */}
                <div id="clients" className="lg:col-span-2 space-y-4 scroll-mt-6">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="heading-3">My Clients</h3>
                        <span className="text-xs text-fg-subtle">{clients.length} active</span>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                        {sortedClients.length === 0 ? (
                            <div className="col-span-2 card p-10 text-center">
                                <p className="text-fg-muted">You have no clients assigned yet.</p>
                            </div>
                        ) : (
                            sortedClients.map((c) => {
                                const session = c.activeSession ?? null;
                                const presence = session ? null : getPresenceIndicator(c.lastActiveAt);
                                const insight = insights.clientInsights[c.id];
                                const lastActiveLabel = session
                                    ? `In workout · ${session.workoutName}`
                                    : formatLastActiveText(c.lastActiveAt);
                                return (
                                <Link
                                    key={c.id}
                                    href={`/coach/client/${c.id}`}
                                    className={cn(
                                        "card p-5 group transition-all",
                                        insight?.needsAttention
                                            ? "border-warning/25 hover:border-warning/40"
                                            : "hover:border-brand-600/40"
                                    )}
                                >
                                    <div className="flex items-center gap-4 mb-1">
                                        <div className="relative shrink-0">
                                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold text-white shadow-glow-sm overflow-hidden bg-gradient-brand">
                                                {c.avatarUrl ? <img src={resolveUploadUrl(c.avatarUrl)} alt="avatar" className="w-full h-full object-cover rounded-2xl" /> : getInitials(c.name)}
                                            </div>
                                            {session ? (
                                                <span
                                                    className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface-card bg-success animate-pulse"
                                                    title={`In workout: ${session.workoutName}`}
                                                />
                                            ) : presence ? (
                                                <span
                                                    className={cn(
                                                        "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface-card",
                                                        presence.dotClassName
                                                    )}
                                                    title={presence.label}
                                                />
                                            ) : null}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-bold text-fg group-hover:text-brand-400 transition-colors truncate">{c.name}</p>
                                                <SevenDayWeightBadge client={c} />
                                                {!c.hasCheckInSchedule && (
                                                    <span className="text-[8px] uppercase font-black px-2 py-0.5 rounded-full border border-warning/30 bg-warning/10 text-warning shrink-0">
                                                        Setup needed
                                                    </span>
                                                )}
                                                {insight?.needsAttention && (
                                                    <span className="text-[8px] uppercase font-black px-2 py-0.5 rounded-full border border-warning/30 bg-warning/10 text-warning shrink-0">
                                                        Needs attention
                                                    </span>
                                                )}
                                            </div>
                                            <p className={cn(
                                                "text-[10px] truncate",
                                                session ? "text-success font-bold flex items-center gap-1" : "text-fg-subtle"
                                            )}>
                                                {session && <Activity className="w-3 h-3 shrink-0" />}
                                                {lastActiveLabel}
                                            </p>
                                        </div>
                                    </div>
                                    <ClientInsightRow insight={insight} client={c} />
                                </Link>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Sidebar: Quick Reviews */}
                <div className="space-y-6">
                    <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="heading-3">Quick Reviews</h3>
                        <Link href="/checkins" className="text-xs text-brand-400 hover:underline">See all</Link>
                    </div>
                    <div className="space-y-3">
                        {recentCheckIns.map((ci) => (
                            <Link
                                key={ci.id}
                                href={`/checkins?highlight=${ci.id}`}
                                className={cn(
                                    "block card p-4 border transition-all",
                                    ci.status === "Pending" ? "border-brand-600/30 bg-brand-500/5 shadow-glow-brand-sm" : "hover:bg-surface-muted/30"
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Week {ci.week} Check-in</span>
                                            {ci.status === "Pending" ? (
                                                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse shadow-glow-brand" />
                                            ) : (
                                                <CheckCircle2 className="w-3 h-3 text-success/60" />
                                            )}
                                        </div>
                                        <p className="font-black text-fg truncate text-sm">{ci.clientName}</p>
                                    </div>
                                    <div className="text-right">
                                        {ci.status === "Pending" ? (
                                            <span className="badge-brand text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-widest">Review</span>
                                        ) : (
                                            <span className="badge text-success bg-success/10 border-success/20 text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-widest">Done</span>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-surface-border/50 flex items-center justify-between text-[10px] text-fg-muted font-black uppercase tracking-widest">
                                    <span className="text-fg-subtle italic">{formatDate(ci.date)}</span>
                                    <div className="flex items-center gap-1 group text-brand-400">
                                        {ci.status === "Pending" ? "Perform Review" : "View Submission"} 
                                        <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
