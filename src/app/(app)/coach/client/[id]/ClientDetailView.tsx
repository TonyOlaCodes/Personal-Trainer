"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Activity, AlertTriangle, Calendar, ChevronRight, Edit3,
    Loader2, Pin, Plus, Search, Trash2, X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Link from "next/link";
import { ExerciseHistoryTooltipContent } from "@/components/shared/ExerciseHistoryTooltip";
import { deriveOneRMFromBestSet } from "@/lib/oneRepMax";
import { MAX_PINNED_EXERCISES, normalizePinnedExercises, orderExerciseNames } from "@/lib/pinnedExercises";
import { RecentSessionsExplorer } from "@/components/shared/RecentSessionsExplorer";
import { cn } from "@/lib/utils";
import { httpErrorMessage } from "@/lib/httpErrorMessage";
import { requestCoachCheckIn } from "@/lib/requestCoachCheckIn";
import { guessTrackingPreset } from "@/lib/exerciseTracking/guess";
import {
    ExerciseHistoryModal,
    useExerciseHistoryInspector,
} from "@/components/exercises/ExerciseHistoryInspector";
import type { CoachClientProfileInsights, CoachProfilePeriodKey } from "@/lib/coachClientProfileData";
import { ClientHeaderCard, CurrentWorkoutCard, NeedsAttentionCard } from "@/components/coach/clientProfile/ProfileTopSections";
import { CoachSummaryCard, LifestyleProgressSection } from "@/components/coach/clientProfile/CoachSummaryLifestyle";
import { ProgressTrendsCard } from "@/components/coach/clientProfile/ProgressTrendsCard";
import { LatestCheckInCard } from "@/components/coach/clientProfile/LatestCheckInCard";
import { RecentSessionsCard } from "@/components/coach/clientProfile/RecentSessionsCard";
import { CoachNotesCard } from "@/components/coach/clientProfile/CoachNotesCard";
import type { CoachClientNote } from "@/lib/coachClientNotes";

const CHECK_IN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CHECK_IN_FREQUENCIES = [
    { value: 1, label: "Weekly" },
    { value: 2, label: "Every 2 weeks" },
    { value: 4, label: "Every 4 weeks" },
];

interface Client {
    id: string;
    name?: string | null;
    email: string;
    role: string;
    assignedCoachName?: string | null;
    avatarUrl?: string | null;
    activePlan: { id: string; name: string } | null;
    experience?: string | null;
    goal?: string | null;
    trainingDaysPerWeek?: number | null;
    checkInSchedule: {
        day: number | null;
        frequencyWeeks: number | null;
        startDate: string | null;
    };
    targetWeightKg?: number | null;
    currentWeightKg?: number | null;
    targetCalories?: number | null;
    targetSteps?: number | null;
    targetSleepHours?: number | null;
    lastActiveAt?: string | null;
    hiddenGoals?: string[];
    isCoachPaused?: boolean;
}

interface WorkoutHistoryEntry {
    id: string;
    workoutId: string;
    workoutName: string;
    date: string;
    duration: number;
    volume: number;
    setCount?: number;
    prCount?: number;
}

interface Props {
    client: Client;
    currentUserId: string;
    availablePlans: { id: string; name: string; type: string }[];
    bodyweightHistory: { date: string; weightKg: number }[];
    workoutHistory: WorkoutHistoryEntry[];
    exerciseHistory: Record<string, Array<{ date: string; weight: number; reps: number; volume: number; oneRM: number }>>;
    exerciseLastDone: Record<string, number>;
    initialPinnedExercises?: string[];
    insights: CoachClientProfileInsights;
    checkInRequest: {
        weekNumber: number | null;
        periodDueDateKey: string | null;
        isOverdue: boolean;
        alreadyRequested?: boolean;
    };
    readOnly?: boolean;
}

export function ClientDetailView({
    client,
    currentUserId,
    availablePlans,
    bodyweightHistory,
    workoutHistory,
    exerciseHistory,
    exerciseLastDone,
    initialPinnedExercises = [],
    insights,
    checkInRequest,
    readOnly = false,
}: Props) {
    const canEdit = !readOnly;
    const router = useRouter();
    const [assigning, setAssigning] = useState(false);
    const [assignMode, setAssignMode] = useState<"MENU" | "LIST">("MENU");
    const [updating, setUpdating] = useState(false);
    const [shareCode, setShareCode] = useState("");
    const [importing, setImporting] = useState(false);
    const [removingPlan, setRemovingPlan] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [pausingClient, setPausingClient] = useState(false);
    const [isCoachPaused, setIsCoachPaused] = useState(Boolean(client.isCoachPaused));
    const [confirmEmail, setConfirmEmail] = useState("");
    const [checkInDay, setCheckInDay] = useState(client.checkInSchedule.day ?? 6);
    const [checkInFrequency, setCheckInFrequency] = useState(client.checkInSchedule.frequencyWeeks ?? 1);
    const [savingSchedule, setSavingSchedule] = useState(false);
    const [sendingCheckInRequest, setSendingCheckInRequest] = useState(false);
    const [checkInRequestSent, setCheckInRequestSent] = useState(Boolean(checkInRequest.alreadyRequested));
    const [checkInRequestError, setCheckInRequestError] = useState<string | null>(null);
    const [targetWeightKg, setTargetWeightKg] = useState(client.targetWeightKg != null ? String(client.targetWeightKg) : "");
    const [targetCalories, setTargetCalories] = useState(client.targetCalories != null ? String(client.targetCalories) : "");
    const [targetSteps, setTargetSteps] = useState(client.targetSteps != null ? String(client.targetSteps) : "");
    const [targetSleepHours, setTargetSleepHours] = useState(client.targetSleepHours != null ? String(client.targetSleepHours) : "");
    const [isEditingTargets, setIsEditingTargets] = useState(canEdit && client.checkInSchedule.day === null);
    const [periodKey, setPeriodKey] = useState<CoachProfilePeriodKey>("30d");
    const [notes, setNotes] = useState<CoachClientNote[]>(insights.coachNotes);
    const [showAllSessions, setShowAllSessions] = useState(false);
    const [sessionsInitialId, setSessionsInitialId] = useState<string | null>(null);
    const [selectedExercise, setSelectedExercise] = useState("");
    const [exerciseSearchQuery, setExerciseSearchQuery] = useState("");
    const [pinnedExercises, setPinnedExercises] = useState(() =>
        normalizePinnedExercises(initialPinnedExercises, Object.keys(exerciseHistory))
    );
    const { exerciseName: historyExercise, openHistory, closeHistory } = useExerciseHistoryInspector();

    useEffect(() => {
        setCheckInDay(client.checkInSchedule.day ?? 6);
        setCheckInFrequency(client.checkInSchedule.frequencyWeeks ?? 1);
        setTargetWeightKg(client.targetWeightKg != null ? String(client.targetWeightKg) : "");
        setTargetCalories(client.targetCalories != null ? String(client.targetCalories) : "");
        setTargetSteps(client.targetSteps != null ? String(client.targetSteps) : "");
        setTargetSleepHours(client.targetSleepHours != null ? String(client.targetSleepHours) : "");
        setIsEditingTargets(canEdit && client.checkInSchedule.day === null);
        setIsCoachPaused(Boolean(client.isCoachPaused));
        setNotes(insights.coachNotes);
    }, [client, canEdit, insights.coachNotes]);

    const period = insights.periods[periodKey];
    const isWeightHidden = client.hiddenGoals?.includes("weight") ?? false;

    const updatePlan = async (planId: string) => {
        if (!canEdit) return;
        setUpdating(true);
        try {
            const res = await fetch("/api/coach/clients/plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId: client.id, planId }),
            });
            if (res.ok) window.location.reload();
            else alert("Failed to update plan");
        } catch {
            alert("Network error.");
        } finally {
            setUpdating(false);
        }
    };

    const handleImport = async () => {
        if (!canEdit || !shareCode) return;
        setImporting(true);
        try {
            const res = await fetch("/api/plans/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: shareCode }),
            });
            if (res.ok) {
                const data = await res.json();
                const assignRes = await fetch("/api/coach/clients/plan", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ clientId: client.id, planId: data.id }),
                });
                if (!assignRes.ok) {
                    const assignData = await assignRes.json().catch(() => ({}));
                    alert(assignData.error ?? "Plan imported but could not assign to this client.");
                    return;
                }
                window.location.reload();
            } else {
                const data = await res.json().catch(() => ({}));
                alert(httpErrorMessage(res.status, data, "Import failed."));
            }
        } catch {
            alert("Network error.");
        } finally {
            setImporting(false);
        }
    };

    const removePlan = async () => {
        if (!canEdit || !client.activePlan) return;
        if (!confirm(`Remove "${client.activePlan.name}" from this client? Their workout history will be kept.`)) return;
        setRemovingPlan(true);
        try {
            const res = await fetch("/api/coach/clients/plan", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId: client.id }),
            });
            const data = await res.json();
            if (res.ok) window.location.reload();
            else alert(data.error ?? "Failed to remove plan");
        } catch {
            alert("Network error.");
        } finally {
            setRemovingPlan(false);
        }
    };

    const handleRemoveClient = async () => {
        if (!canEdit) return;
        if (confirmEmail.toLowerCase() !== client.email.toLowerCase()) {
            alert("Email mismatch. Operation aborted.");
            return;
        }
        setUpdating(true);
        try {
            const res = await fetch("/api/coach/clients/remove", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId: client.id }),
            });
            if (res.ok) router.push("/coach");
            else alert("Failed to remove client.");
        } catch {
            alert("Network error.");
        } finally {
            setUpdating(false);
        }
    };

    const handleTogglePauseClient = async () => {
        if (!canEdit || pausingClient) return;
        const nextPaused = !isCoachPaused;
        setPausingClient(true);
        try {
            const res = await fetch("/api/coach/clients/pause", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId: client.id, paused: nextPaused }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                alert(data.error ?? (nextPaused ? "Could not pause client." : "Could not resume client."));
                return;
            }
            setIsCoachPaused(Boolean(data.isCoachPaused ?? nextPaused));
            router.refresh();
        } catch {
            alert("Network error.");
        } finally {
            setPausingClient(false);
        }
    };

    const saveClientConfiguration = async () => {
        if (!canEdit) return;
        setSavingSchedule(true);
        try {
            const scheduleRes = await fetch("/api/coach/clients/checkin-schedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId: client.id, day: checkInDay, frequencyWeeks: checkInFrequency }),
            });
            if (!scheduleRes.ok) throw new Error("Failed to update check-in schedule.");
            const goalsRes = await fetch("/api/coach/clients/goals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId: client.id,
                    targetCalories: targetCalories.trim() === "" ? null : Math.round(Number(targetCalories)),
                    targetSteps: targetSteps.trim() === "" ? null : Math.round(Number(targetSteps)),
                    targetSleepHours: targetSleepHours.trim() === "" ? null : Number(targetSleepHours),
                    targetWeightKg: targetWeightKg.trim() === "" ? null : Number(targetWeightKg),
                }),
            });
            if (!goalsRes.ok) throw new Error("Failed to update targets.");
            router.refresh();
        } catch (error: unknown) {
            alert(error instanceof Error ? error.message : "Network error.");
        } finally {
            setSavingSchedule(false);
        }
    };

    useEffect(() => {
        setCheckInRequestSent(Boolean(checkInRequest.alreadyRequested));
    }, [checkInRequest.alreadyRequested]);

    const sendCheckInRequest = async () => {
        if (!canEdit || sendingCheckInRequest || checkInRequestSent) return;
        setSendingCheckInRequest(true);
        setCheckInRequestError(null);
        const result = await requestCoachCheckIn({
            clientId: client.id,
            weekNumber: checkInRequest.weekNumber,
            periodDueDateKey: checkInRequest.periodDueDateKey,
        });
        if (result.ok) {
            setCheckInRequestSent(true);
        } else {
            setCheckInRequestError(result.message);
        }
        setSendingCheckInRequest(false);
    };

    const exerciseListOrdered = useMemo(() => {
        const names = Object.keys(exerciseHistory);
        return orderExerciseNames(names, pinnedExercises, (a, b) => (exerciseLastDone[b] || 0) - (exerciseLastDone[a] || 0));
    }, [exerciseHistory, exerciseLastDone, pinnedExercises]);

    useEffect(() => {
        setPinnedExercises(normalizePinnedExercises(initialPinnedExercises, Object.keys(exerciseHistory)));
    }, [initialPinnedExercises, exerciseHistory]);

    useEffect(() => {
        if (!selectedExercise && exerciseListOrdered.length > 0) setSelectedExercise(exerciseListOrdered[0]);
    }, [exerciseListOrdered, selectedExercise]);

    const togglePinExercise = async (ex: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (readOnly) return;
        let nextPinned = [...pinnedExercises];
        if (pinnedExercises.includes(ex)) nextPinned = nextPinned.filter((name) => name !== ex);
        else {
            if (pinnedExercises.length >= MAX_PINNED_EXERCISES) {
                alert(`You can only pin up to ${MAX_PINNED_EXERCISES} exercises. Please unpin an exercise first.`);
                return;
            }
            nextPinned.push(ex);
        }
        const previous = pinnedExercises;
        setPinnedExercises(nextPinned);
        try {
            const res = await fetch("/api/user/pinned-exercises", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pinnedExercises: nextPinned, userId: client.id }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to save pinned exercises");
            }
        } catch (error) {
            setPinnedExercises(previous);
            alert(error instanceof Error ? error.message : "Failed to save pinned exercises");
        }
    };

    const getRegex = (q: string) => {
        try {
            return new RegExp(q.trim().split("").map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*"), "i");
        } catch {
            return new RegExp(q, "i");
        }
    };

    const exerciseListFiltered = useMemo(
        () => exerciseListOrdered.filter((ex) => (exerciseSearchQuery ? getRegex(exerciseSearchQuery).test(ex) : true)),
        [exerciseListOrdered, exerciseSearchQuery]
    );

    const selectedIsStrength = selectedExercise ? guessTrackingPreset(selectedExercise) === "strength" : false;
    const selectedExerciseHistory = useMemo(() => {
        const raw = exerciseHistory[selectedExercise] || [];
        return raw.map((session) => ({
            ...session,
            oneRM: selectedIsStrength ? deriveOneRMFromBestSet(session.weight, session.reps) : 0,
        }));
    }, [exerciseHistory, selectedExercise, selectedIsStrength]);
    const selectedExerciseStats = useMemo(() => {
        if (!selectedExercise || selectedExerciseHistory.length === 0) return null;
        return {
            currentMax: Math.max(...selectedExerciseHistory.map((h) => h.weight || 0)),
            estimatedMax: selectedIsStrength
                ? Math.max(...selectedExerciseHistory.map((h) => h.oneRM || 0))
                : null,
        };
    }, [selectedExercise, selectedExerciseHistory, selectedIsStrength]);

    const planAssignmentPanel = canEdit && assigning ? (
        <div className="mt-4 rounded-2xl border border-surface-border bg-surface-muted/50 p-4 animate-fade-in">
            {assignMode === "MENU" && (
                <div className="space-y-4">
                    <h4 className="text-sm font-black uppercase tracking-widest text-fg">Assign New Plan</h4>
                    <button type="button" onClick={() => setAssignMode("LIST")} className="w-full rounded-2xl p-4 flex items-center justify-between border border-brand-500/20 bg-brand-500/5">
                        <span className="text-sm font-black text-fg">Existing Programme</span>
                        <ChevronRight className="w-4 h-4 text-fg-subtle" />
                    </button>
                    <Link href={`/plans/create?clientId=${client.id}`} className="w-full rounded-2xl p-4 flex items-center justify-between border border-warning/20 bg-warning/5">
                        <span className="text-sm font-black text-fg">Create New Plan</span>
                        <ChevronRight className="w-4 h-4 text-fg-subtle" />
                    </Link>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <input type="text" placeholder="Share key" className="input flex-1 font-mono uppercase" value={shareCode} onChange={(e) => setShareCode(e.target.value)} />
                        <button type="button" onClick={() => void handleImport()} disabled={importing || !shareCode} className="btn-primary h-11 px-5">{importing ? "..." : "Import"}</button>
                    </div>
                    <button type="button" onClick={() => setAssigning(false)} className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-fg-subtle">Cancel</button>
                </div>
            )}
            {assignMode === "LIST" && (
                <div className="space-y-3">
                    <button type="button" onClick={() => setAssignMode("MENU")} className="text-[10px] font-black uppercase tracking-widest text-fg-muted">Back</button>
                    <div className="grid gap-2 max-h-[300px] overflow-y-auto no-scrollbar">
                        {availablePlans.length === 0 ? (
                            <p className="p-6 text-center text-[10px] font-bold uppercase tracking-widest text-fg-subtle">No plans found.</p>
                        ) : availablePlans.map((plan) => (
                            <button key={plan.id} type="button" onClick={() => void updatePlan(plan.id)} disabled={updating} className="flex items-center justify-between p-3 rounded-xl border border-surface-border hover:bg-surface-elevated">
                                <span className="font-bold text-sm text-fg">{plan.name}</span>
                                <span className="text-[8px] bg-brand-500/10 text-brand-400 px-1.5 py-0.5 rounded uppercase font-black">{plan.type}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    ) : null;

    const explorerSessions = insights.recentSessions.map((session) => ({
        id: session.id,
        workoutName: session.workoutName,
        date: session.date,
        setCount: session.setCount,
    }));

    return (
        <div className="space-y-6 animate-fade-in">
            <RecentSessionsExplorer
                open={showAllSessions}
                onClose={() => {
                    setShowAllSessions(false);
                    setSessionsInitialId(null);
                }}
                title={`${client.name ?? "Client"} Workouts`}
                subtitle="Full workout history"
                fetchHistoryOnOpen
                historyUserId={client.id}
                sessions={explorerSessions}
                initialSessionId={sessionsInitialId}
                canAddCoachNote={canEdit}
                canEditSession={canEdit}
                editClientId={client.id}
                alignToAppShell
            />

            {readOnly && (
                <div className="card p-4 border-warning/30 bg-warning/5 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-fg">View only — account inactive</p>
                        <p className="text-xs text-fg-muted mt-1">History is available, but plans, goals, messages, and settings cannot be changed.</p>
                    </div>
                </div>
            )}

            <ClientHeaderCard
                client={{
                    id: client.id,
                    name: client.name,
                    email: client.email,
                    avatarUrl: client.avatarUrl,
                    assignedCoachName: client.assignedCoachName,
                    goal: client.goal,
                    experience: client.experience,
                    trainingDaysPerWeek: client.trainingDaysPerWeek,
                    lastActiveAt: client.lastActiveAt,
                    activeSessionName: insights.activeWorkout?.name ?? null,
                }}
                isCoachPaused={isCoachPaused}
                canEdit={canEdit}
            />

            {insights.activeWorkout && <CurrentWorkoutCard workout={insights.activeWorkout} />}

            <NeedsAttentionCard
                items={insights.attention}
                canEdit={canEdit}
                sendingCheckInRequest={sendingCheckInRequest}
                checkInRequestSent={checkInRequestSent}
                checkInRequestError={checkInRequestError}
                onRequestCheckIn={sendCheckInRequest}
            />

            <CoachSummaryCard
                period={period}
                periodKey={periodKey}
                onPeriodChange={setPeriodKey}
                streak={insights.currentStreak}
                weightDirection={insights.weightDirection}
            />

            <div className="grid lg:grid-cols-2 gap-4">
                <div className="card p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">Active Plan</p>
                            <h3 className="text-lg font-black text-fg truncate">{insights.planProgress?.name ?? client.activePlan?.name ?? "No plan assigned"}</h3>
                            {insights.planProgress && (
                                <p className="text-xs text-fg-muted mt-1">
                                    {insights.planProgress.currentWeek != null
                                        ? `Week ${insights.planProgress.currentWeek} / ${insights.planProgress.totalWeeks}`
                                        : `${insights.planProgress.totalWeeks} week programme`}
                                    {insights.planProgress.weekScheduled > 0
                                        ? ` · ${insights.planProgress.weekCompleted} / ${insights.planProgress.weekScheduled} this week`
                                        : ""}
                                </p>
                            )}
                        </div>
                        <Link
                            href={`/coach/calendar?clientId=${client.id}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-brand-500/30 text-brand-400"
                            aria-label="Open client calendar"
                        >
                            <Calendar className="w-4 h-4" />
                        </Link>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {client.activePlan && (
                            <Link href={`/plans/create?id=${client.activePlan.id}&view=true&clientId=${client.id}`} className="btn-secondary h-9 px-3 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1">
                                View / Edit Plan <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                        )}
                        {canEdit && (
                            <button type="button" onClick={() => { setAssigning(true); setAssignMode("MENU"); }} className="btn-secondary h-9 px-3 text-[10px] font-black uppercase tracking-widest">
                                <Plus className="w-3.5 h-3.5" /> Assign New Plan
                            </button>
                        )}
                        {canEdit && client.activePlan && (
                            <button type="button" onClick={() => void removePlan()} disabled={removingPlan} className="h-9 px-3 text-[10px] font-black uppercase tracking-widest text-fg-subtle hover:text-danger">
                                {removingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Remove Plan"}
                            </button>
                        )}
                    </div>
                    {planAssignmentPanel}
                </div>

                <div id="goals-schedule" className={cn("card p-5 space-y-4 scroll-mt-24", client.checkInSchedule.day === null ? "border-warning/30 bg-warning/5" : "")}>
                    <div className="flex items-center justify-between">
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-fg">Goals & Schedule</h3>
                        {canEdit && client.checkInSchedule.day !== null && (
                            <button type="button" onClick={() => setIsEditingTargets((prev) => !prev)} className="text-brand-400 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1">
                                {isEditingTargets ? <><X className="w-3 h-3" /> Cancel</> : <><Edit3 className="w-3 h-3" /> Edit</>}
                            </button>
                        )}
                    </div>
                    {!canEdit || (!isEditingTargets && client.checkInSchedule.day !== null) ? (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-surface-muted/30 rounded-xl border border-surface-border/50">
                                <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Bodyweight target</p>
                                <p className="text-sm font-black text-fg mt-1">{client.targetWeightKg != null ? `${client.targetWeightKg.toFixed(1)} kg` : "—"}</p>
                                <p className="text-[10px] text-fg-muted font-bold uppercase tracking-widest mt-1">
                                    {insights.weightDirection === "GAINING" ? "Gaining" : insights.weightDirection === "LOSING" ? "Losing" : insights.weightDirection === "MAINTAINING" ? "Maintaining" : "Direction unset"}
                                </p>
                            </div>
                            <div className="p-3 bg-surface-muted/30 rounded-xl border border-surface-border/50">
                                <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Calories</p>
                                <p className="text-sm font-black text-fg mt-1">{client.targetCalories != null ? `${client.targetCalories.toLocaleString()} kcal` : "—"}</p>
                            </div>
                            <div className="p-3 bg-surface-muted/30 rounded-xl border border-surface-border/50">
                                <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Steps</p>
                                <p className="text-sm font-black text-fg mt-1">{client.targetSteps != null ? client.targetSteps.toLocaleString() : "—"}</p>
                            </div>
                            <div className="p-3 bg-surface-muted/30 rounded-xl border border-surface-border/50">
                                <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Sleep</p>
                                <p className="text-sm font-black text-fg mt-1">{client.targetSleepHours != null ? `${client.targetSleepHours.toFixed(1)} hrs` : "—"}</p>
                            </div>
                            <div className="p-3 border border-brand-500/10 bg-brand-500/5 rounded-xl col-span-2 flex items-center justify-between">
                                <div>
                                    <p className="text-[8px] font-black uppercase tracking-widest text-fg-subtle">Check-in day</p>
                                    <p className="text-xs font-black text-fg">{client.checkInSchedule.day != null ? CHECK_IN_DAYS[client.checkInSchedule.day] : "Not set"}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-fg-subtle">Frequency</p>
                                    <p className="text-xs font-black text-brand-400">{CHECK_IN_FREQUENCIES.find((item) => item.value === client.checkInSchedule.frequencyWeeks)?.label || "—"}</p>
                                </div>
                            </div>
                            {client.trainingDaysPerWeek != null && (
                                <p className="col-span-2 text-xs text-fg-muted">Training frequency: {client.trainingDaysPerWeek} days / week</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <label className="space-y-1 block">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Check-in day</span>
                                    <select value={checkInDay} onChange={(e) => setCheckInDay(Number(e.target.value))} className="input h-10 text-xs font-bold">
                                        {CHECK_IN_DAYS.map((day, idx) => <option key={day} value={idx}>{day}</option>)}
                                    </select>
                                </label>
                                <label className="space-y-1 block">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Frequency</span>
                                    <select value={checkInFrequency} onChange={(e) => setCheckInFrequency(Number(e.target.value))} className="input h-10 text-xs font-bold">
                                        {CHECK_IN_FREQUENCIES.map((freq) => <option key={freq.value} value={freq.value}>{freq.label}</option>)}
                                    </select>
                                </label>
                                <label className="space-y-1 block">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Calories</span>
                                    <input type="number" value={targetCalories} onChange={(e) => setTargetCalories(e.target.value)} className="input h-10 text-xs font-bold" />
                                </label>
                                <label className="space-y-1 block">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Steps</span>
                                    <input type="number" value={targetSteps} onChange={(e) => setTargetSteps(e.target.value)} className="input h-10 text-xs font-bold" />
                                </label>
                                <label className="space-y-1 block">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Sleep</span>
                                    <input type="number" step="0.5" value={targetSleepHours} onChange={(e) => setTargetSleepHours(e.target.value)} className="input h-10 text-xs font-bold" />
                                </label>
                                <label className="space-y-1 block">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Weight goal</span>
                                    <input type="number" step="0.1" value={targetWeightKg} onChange={(e) => setTargetWeightKg(e.target.value)} className="input h-10 text-xs font-bold" />
                                </label>
                            </div>
                            <button type="button" onClick={async () => { await saveClientConfiguration(); setIsEditingTargets(false); }} disabled={savingSchedule} className="btn-primary w-full h-10 text-xs font-black uppercase tracking-widest">
                                {savingSchedule ? "Saving..." : "Save Configuration"}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <LifestyleProgressSection period={period} />

            <ProgressTrendsCard
                bodyweightHistory={bodyweightHistory}
                workoutHistory={workoutHistory}
                currentWeightKg={period.bodyweightCurrentKg ?? client.currentWeightKg ?? null}
                targetWeightKg={client.targetWeightKg ?? null}
                weightHidden={isWeightHidden}
                weightDirection={insights.weightDirection}
                periodChangeKg={period.bodyweightChangeKg}
                periodLabel={period.label}
                onOpenSession={(id) => {
                    setSessionsInitialId(id);
                    setShowAllSessions(true);
                }}
            />

            <LatestCheckInCard
                checkIn={insights.latestCheckIn}
                overdue={checkInRequest.isOverdue}
                canEdit={canEdit}
                canViewPhotos={insights.canViewCheckInPhotos}
                sendingCheckInRequest={sendingCheckInRequest}
                checkInRequestSent={checkInRequestSent}
                onRequestCheckIn={sendCheckInRequest}
            />

            <RecentSessionsCard
                sessions={insights.recentSessions}
                onOpen={(id) => {
                    setSessionsInitialId(id);
                    setShowAllSessions(true);
                }}
            />

            <section className="space-y-4 border-t border-surface-border pt-8">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-brand-400 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Exercise Progression
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-8 card overflow-hidden">
                        <div className="p-5 border-b border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h4 className="text-base font-black text-fg">{selectedExercise || "Select an exercise"}</h4>
                                <p className="text-[10px] text-fg-muted font-bold uppercase tracking-wide mt-0.5">Canonical exercise history</p>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                                {selectedExercise && (
                                    <button type="button" onClick={() => openHistory(selectedExercise)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-brand-400 bg-brand-500/10 border border-brand-500/20">
                                        View full history
                                    </button>
                                )}
                                {selectedExerciseStats && (
                                    <>
                                        {selectedExerciseStats.estimatedMax != null && (
                                            <div className="text-center px-3 py-1.5 rounded-xl bg-warning/10 border border-warning/20">
                                                <p className="text-[9px] font-black text-warning/70 uppercase tracking-widest">Est. Max</p>
                                                <p className="text-sm font-black text-warning">{selectedExerciseStats.estimatedMax}<span className="text-[9px] ml-0.5">kg</span></p>
                                            </div>
                                        )}
                                        <div className="text-center px-3 py-1.5 rounded-xl bg-brand-500/10 border border-brand-500/20">
                                            <p className="text-[9px] font-black text-brand-400/70 uppercase tracking-widest">Current best</p>
                                            <p className="text-sm font-black text-brand-400">{selectedExerciseStats.currentMax}<span className="text-[9px] ml-0.5">kg</span></p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="p-5">
                            {selectedExercise ? (
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={selectedExerciseHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="exGrad" x1="0" x2="0" y1="0" y2="1">
                                                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                                            <XAxis dataKey="date" stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                                            <Tooltip content={({ active, payload, label }) => (
                                                active && payload?.[0] ? <ExerciseHistoryTooltipContent label={label} data={payload[0].payload} /> : null
                                            )} />
                                            <Area type="monotone" dataKey="weight" stroke="#818cf8" strokeWidth={3} fill="url(#exGrad)" />
                                            {selectedIsStrength && (
                                                <Line type="monotone" dataKey="oneRM" stroke="#FACC15" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                            )}
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-[240px] flex items-center justify-center text-sm text-fg-muted">No exercise history recorded for this client.</div>
                            )}
                        </div>
                    </div>
                    <div className="lg:col-span-4 card flex flex-col h-[412px] overflow-hidden">
                        <div className="p-4 border-b border-surface-border">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-subtle" />
                                <input className="pl-9 pr-4 py-2.5 w-full bg-surface-elevated border border-surface-border rounded-xl text-xs font-bold outline-none text-fg" placeholder="Search exercises..." value={exerciseSearchQuery} onChange={(e) => setExerciseSearchQuery(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
                            {exerciseListFiltered.map((ex) => {
                                const hist = exerciseHistory[ex] || [];
                                const latest = hist[hist.length - 1];
                                const isActive = selectedExercise === ex;
                                const isPinned = pinnedExercises.includes(ex);
                                return (
                                    <div
                                        key={ex}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setSelectedExercise(ex)}
                                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedExercise(ex); }}
                                        className={cn("w-full flex items-center justify-between p-3 rounded-xl cursor-pointer", isActive ? "bg-brand-500/10 border border-brand-500/20" : "hover:bg-surface-elevated border border-transparent")}
                                    >
                                        <div className="min-w-0">
                                            <p className={cn("text-xs font-black truncate", isActive ? "text-brand-400" : "text-fg")}>{ex}</p>
                                            <p className="text-[10px] text-fg-muted truncate">Best: {latest?.weight ?? "—"}kg · {hist.length} sessions</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {!readOnly && (
                                                <button type="button" onClick={(e) => void togglePinExercise(ex, e)} className={cn("p-1.5 rounded-lg", isPinned ? "text-brand-400" : "text-fg-subtle")}>
                                                    <Pin className={cn("w-3.5 h-3.5", isPinned && "fill-brand-400")} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>

            <CoachNotesCard
                notes={notes}
                canEdit={canEdit}
                currentUserId={currentUserId}
                onCreate={async (text) => {
                    const res = await fetch("/api/coach/clients/notes", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ clientId: client.id, text }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data.error ?? "Could not add note");
                    setNotes((prev) => [data.note, ...prev]);
                }}
                onUpdate={async (id, text) => {
                    const res = await fetch("/api/coach/clients/notes", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id, text }),
                    });
                    if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        throw new Error(data.error ?? "Could not update note");
                    }
                    setNotes((prev) => prev.map((note) => note.id === id ? { ...note, text, updatedAt: new Date().toISOString() } : note));
                }}
                onDelete={async (id) => {
                    if (!confirm("Delete this private note?")) return;
                    const res = await fetch("/api/coach/clients/notes", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id }),
                    });
                    if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        alert(data.error ?? "Could not delete note");
                        return;
                    }
                    setNotes((prev) => prev.filter((note) => note.id !== id));
                }}
            />

            {canEdit && (
                <div className="border-t border-surface-border pt-8 space-y-4">
                    <div className="card p-5 border-surface-border bg-surface-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h4 className="text-sm font-black text-fg uppercase tracking-widest">{isCoachPaused ? "Client Paused" : "Pause Client"}</h4>
                            <p className="text-xs text-fg-muted max-w-md mt-2">
                                {isCoachPaused
                                    ? "Missed workout and check-in alerts are silenced for you. Their account still works normally."
                                    : "Temporarily silence missed workout and check-in alerts. Their account, plan, chat and history stay intact."}
                            </p>
                        </div>
                        <button type="button" onClick={() => void handleTogglePauseClient()} disabled={pausingClient} className={cn("btn-secondary text-[10px] font-black uppercase tracking-widest h-10 px-6", isCoachPaused && "border-success/30 text-success")}>
                            {pausingClient ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            {isCoachPaused ? "Resume Client" : "Pause Client"}
                        </button>
                    </div>
                    <div className="card p-5 border-danger-500/20 bg-danger-500/5">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <h4 className="text-sm font-black text-danger uppercase tracking-widest flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" /> Danger Zone
                                </h4>
                                <p className="text-xs text-fg-muted max-w-md mt-2">Remove this client from your coaching list. History is kept; they will no longer see your assigned plans.</p>
                            </div>
                            {!removing ? (
                                <button type="button" onClick={() => setRemoving(true)} className="btn-secondary border-danger-500/30 text-danger text-[10px] font-black uppercase tracking-widest h-10 px-6">Remove Client</button>
                            ) : (
                                <div className="w-full sm:w-auto space-y-3">
                                    <input type="email" placeholder={client.email} className="input input-sm border-danger-500/30 font-mono text-xs" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} />
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => void handleRemoveClient()} disabled={updating || !confirmEmail} className="btn-primary bg-danger border-danger flex-1 text-[10px] font-black uppercase tracking-widest h-10">Authorize Removal</button>
                                        <button type="button" onClick={() => { setRemoving(false); setConfirmEmail(""); }} className="btn-secondary flex-1 text-[10px] font-black uppercase tracking-widest h-10">Cancel</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <ExerciseHistoryModal exerciseName={historyExercise} clientId={client.id} onClose={closeHistory} />
        </div>
    );
}
