"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Users, Activity, Calendar,
    ChevronRight, TrendingUp, HelpCircle, CheckCircle2,
    Dumbbell, Loader2
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { resolveUploadUrl } from "@/lib/uploadUrls";
import { getPresenceIndicator } from "@/lib/userPresence";
import { PendingReviewsModal, type PendingReviewItem } from "@/components/shared/PendingReviewsModal";

const CHECK_IN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Client {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    lastActiveAt?: string | null;
    isDeleted?: boolean;
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
}

export function CoachDashboardClient({ clients, recentCheckIns, pendingReviews, availablePlans }: Props) {
    const router = useRouter();
    const [skippedClients, setSkippedClients] = useState<string[]>([]);
    const [savingSetup, setSavingSetup] = useState(false);
    const [showPendingReviews, setShowPendingReviews] = useState(false);

    const sortedClients = useMemo(() => {
        return [...clients].sort((a, b) => {
            if (a.isDeleted !== b.isDeleted) return a.isDeleted ? 1 : -1;
            return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
        });
    }, [clients]);

    const pendingCheckIns = pendingReviews.length;
    const activeClients = clients.filter(c => !c.isDeleted);
    const deletedClients = clients.filter(c => c.isDeleted);

    // Queue of clients who need onboarding setup and haven't been skipped
    const needsSetupClients = activeClients.filter(c => !c.hasCheckInSchedule && !skippedClients.includes(c.id));
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

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="stat-card">
                    <div className="flex justify-between items-start">
                        <Users className="w-4 h-4 text-brand-400 mb-1" />
                        <Link href="/coach/invites" className="text-[10px] font-black text-brand-400 hover:text-brand-300 transition-colors uppercase tracking-widest">
                            Invite +
                        </Link>
                    </div>
                    <p className="stat-value">{activeClients.length}</p>
                    <p className="stat-label">Active Clients</p>
                </div>
                <button
                    type="button"
                    onClick={() => setShowPendingReviews(true)}
                    className={cn(
                        "stat-card text-left transition-all",
                        pendingCheckIns > 0
                            ? "hover:border-brand-500/40 hover:bg-brand-500/5 cursor-pointer"
                            : "cursor-pointer hover:bg-surface-muted/30"
                    )}
                >
                    <TrendingUp className="w-4 h-4 text-success mb-1" />
                    <p className="stat-value">{pendingCheckIns}</p>
                    <p className="stat-label">Pending Reviews</p>
                </button>
                <div className="stat-card">
                    <Activity className="w-4 h-4 text-warning mb-1" />
                    <p className="stat-value">{activeClients.reduce((acc, c) => acc + c.stats.logs, 0)}</p>
                    <p className="stat-label">Logs (Total)</p>
                </div>
                <div className="stat-card">
                    <Calendar className="w-4 h-4 text-brand-300 mb-1" />
                    <p className="stat-value">{activeClients.reduce((acc, c) => acc + c.stats.checkins, 0)}</p>
                    <p className="stat-label">Check-ins (Total)</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Client Roster */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="heading-3">My Clients</h3>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                        {sortedClients.length === 0 ? (
                            <div className="col-span-2 card p-10 text-center">
                                <p className="text-fg-muted">You have no clients assigned yet.</p>
                            </div>
                        ) : (
                            sortedClients.map((c) => {
                                const presence = c.isDeleted ? null : getPresenceIndicator(c.lastActiveAt);
                                return (
                                <Link
                                    key={c.id}
                                    href={`/coach/client/${c.id}`}
                                    className={cn(
                                        "card p-5 group transition-all",
                                        c.isDeleted
                                            ? "opacity-70 grayscale hover:border-surface-border"
                                            : "hover:border-brand-600/40"
                                    )}
                                >
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="relative shrink-0">
                                            <div className={cn(
                                                "w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold text-white shadow-glow-sm overflow-hidden",
                                                c.isDeleted ? "bg-surface-muted text-fg-subtle" : "bg-gradient-brand"
                                            )}>
                                                {c.avatarUrl ? <img src={resolveUploadUrl(c.avatarUrl)} alt="avatar" className="w-full h-full object-cover rounded-2xl" /> : getInitials(c.name)}
                                            </div>
                                            {presence && (
                                                <span
                                                    className={cn(
                                                        "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface-card",
                                                        presence.dotClassName
                                                    )}
                                                    title={presence.label}
                                                />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-fg group-hover:text-brand-400 transition-colors truncate">{c.name}</p>
                                                {c.isDeleted && (
                                                    <span className="badge-muted text-[9px] uppercase tracking-widest">Deleted</span>
                                                )}
                                                {!c.isDeleted && !c.hasCheckInSchedule && (
                                                    <span className="text-[8px] uppercase font-black px-2 py-0.5 rounded-full border border-warning/30 bg-warning/10 text-warning shrink-0">
                                                        Setup needed
                                                    </span>
                                                )}
                                            </div>
                                            {presence ? (
                                                <p className="text-[10px] text-fg-subtle truncate">{presence.label}</p>
                                            ) : (
                                                <p className="text-xs text-fg-muted truncate">{c.isDeleted ? "Inactive account" : c.email}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 border-t border-surface-border pt-4">
                                        <div>
                                            <p className="text-[10px] text-fg-subtle uppercase font-bold tracking-widest">Logs</p>
                                            <p className="text-sm font-semibold text-fg">{c.stats.logs}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-fg-subtle uppercase font-bold tracking-widest">Check-ins</p>
                                            <p className="text-sm font-semibold text-fg">{c.stats.checkins}</p>
                                        </div>
                                    </div>
                                </Link>
                                );
                            })
                        )}
                    </div>
                    {deletedClients.length > 0 && (
                        <p className="px-2 text-xs text-fg-subtle">
                            Deleted or deactivated clients are listed at the bottom for reference only; their account data has been removed.
                        </p>
                    )}
                </div>

                {/* Recent Check-ins Sidebar */}
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

                    <div className="card p-6 bg-surface-muted/30 border-2 border-dashed border-surface-border text-center grayscale opacity-60">
                        <HelpCircle className="w-8 h-8 mx-auto mb-3 text-fg-subtle" />
                        <p className="text-xs font-bold uppercase text-fg-subtle tracking-widest">Pro Analytics</p>
                        <p className="text-xs text-fg-subtle mt-1">Client compliance graphs coming soon</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
