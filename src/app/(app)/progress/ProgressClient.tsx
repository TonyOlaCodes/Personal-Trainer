"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    ReferenceLine
} from "recharts";
import {
    TrendingUp, TrendingDown, Loader2,
    Dumbbell, Activity, Search, ChevronRight,
    Scale, Zap, BarChart2,
    Flame, ArrowUpRight, ArrowDownRight, X, Utensils, Footprints, Moon,
    Pin, Minus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/hooks/useScrollLock";
import { workoutFeelingEmoji } from "@/lib/workoutFeeling";
import { PremiumLockScreen } from "@/components/shared/PremiumLockScreen";
import { ReturnLink } from "@/components/shared/ReturnLink";
import { ExerciseHistoryTooltipContent } from "@/components/shared/ExerciseHistoryTooltip";
import { deriveOneRMFromBestSet } from "@/lib/exerciseHistory";
import { MAX_PINNED_EXERCISES, normalizePinnedExercises, orderExerciseNames } from "@/lib/pinnedExercises";
import { useWorkoutStatsRefresh } from "@/hooks/useWorkoutStatsRefresh";
import { format, startOfWeek } from "date-fns";

interface Props {
    userRole: string;
    hiddenGoals: string[];
}

type BodyweightHistoryPoint = { date: string; dateKey: string; weight: number };

const BW_TIMEFRAMES = [
    { days: 7 as const, label: "Week", periodLabel: "this week" },
    { days: 30 as const, label: "Month", periodLabel: "this month" },
    { days: 365 as const, label: "Year", periodLabel: "this year" },
];

function filterBodyweightHistory(history: BodyweightHistoryPoint[], days: number) {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - days);
    return history.filter((entry) => new Date(entry.dateKey) >= cutoff);
}

function getBodyweightPeriodChange(history: BodyweightHistoryPoint[], days: number) {
    if (history.length === 0) return null;

    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - days);

    const inPeriod = history.filter((entry) => new Date(entry.dateKey) >= cutoff);
    if (inPeriod.length === 0) return null;

    const endWeight = inPeriod[inPeriod.length - 1].weight;
    const beforePeriod = history.filter((entry) => new Date(entry.dateKey) < cutoff);
    const startWeight = inPeriod.length >= 2
        ? inPeriod[0].weight
        : beforePeriod.length > 0
            ? beforePeriod[beforePeriod.length - 1].weight
            : inPeriod[0].weight;

    const change = endWeight - startWeight;
    const periodLabel = BW_TIMEFRAMES.find((frame) => frame.days === days)?.periodLabel ?? "in this period";

    return { change, startWeight, endWeight, periodLabel };
}

type VolumeTrend = "up" | "down" | "same";

function getVolumeWeekComparison(current: number, previous: number) {
    const deltaKg = Math.round(current - previous);
    if (deltaKg === 0) {
        return {
            trend: "same" as VolumeTrend,
            deltaKg: 0,
            pct: 0,
            hasPriorWeek: previous > 0 || current > 0,
        };
    }

    const pct = previous > 0 ? Math.round((deltaKg / previous) * 100) : null;
    return {
        trend: (deltaKg > 0 ? "up" : "down") as VolumeTrend,
        deltaKg,
        pct,
        hasPriorWeek: previous > 0,
    };
}

function VolumeComparisonBadge({
    current,
    previous,
    className,
    vsLabel = "previous week",
}: {
    current: number;
    previous: number;
    className?: string;
    vsLabel?: string;
}) {
    const comparison = getVolumeWeekComparison(current, previous);
    const sign = comparison.deltaKg > 0 ? "+" : "";

    return (
        <div
            className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[10px] font-bold",
                comparison.trend === "up" && "bg-success/10 text-success",
                comparison.trend === "down" && "bg-danger/10 text-danger",
                comparison.trend === "same" && "bg-surface-muted text-fg-muted",
                className
            )}
        >
            {comparison.trend === "up" && <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />}
            {comparison.trend === "down" && <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />}
            {comparison.trend === "same" && <Minus className="w-3.5 h-3.5 shrink-0" />}
            <span>
                {comparison.trend === "same" ? (
                    `Same as ${vsLabel}`
                ) : comparison.hasPriorWeek && comparison.pct !== null ? (
                    <>
                        {sign}{comparison.pct}% ({sign}{comparison.deltaKg.toLocaleString()} kg) vs {vsLabel}
                    </>
                ) : (
                    <>{sign}{comparison.deltaKg.toLocaleString()} kg vs {vsLabel}</>
                )}
            </span>
        </div>
    );
}

function isWeightChangeTowardGoal(
    changeKg: number,
    goal: string | null | undefined,
    target: number | null | undefined,
    startWeight: number,
    endWeight: number
) {
    if (changeKg === 0) return true;

    if (target != null && target > 0) {
        const startDistance = Math.abs(startWeight - target);
        const endDistance = Math.abs(endWeight - target);
        if (endDistance < startDistance) return true;
        if (endDistance > startDistance) return false;
    }

    switch (goal) {
        case "LOSE_WEIGHT":
            return changeKg < 0;
        case "GAIN_MUSCLE":
        case "STRENGTH":
            return changeKg > 0;
        case "RECOMPOSITION":
            if (target != null && target > 0) {
                return Math.abs(endWeight - target) <= Math.abs(startWeight - target);
            }
            return changeKg < 0;
        default:
            if (target != null && target > 0) {
                return Math.abs(endWeight - target) < Math.abs(startWeight - target);
            }
            return changeKg < 0;
    }
}

export function ProgressClient({ userRole, hiddenGoals }: Props) {
    const isPremium = ["PREMIUM", "COACH", "SUPER_ADMIN"].includes(userRole);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedExercise, setSelectedExercise] = useState<string>("");
    const [exerciseSearchQuery, setExerciseSearchQuery] = useState("");
    const [bwDays, setBwDays] = useState<7 | 30 | 365>(30);
    const [showExerciseModal, setShowExerciseModal] = useState(false);
    const [volTimeframe, setVolTimeframe] = useState<"daily" | "weekly" | "monthly" | "yearly">("weekly");
    const [selectedWeekIndex, setSelectedWeekIndex] = useState<number | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);
    const [pinnedExercises, setPinnedExercises] = useState<string[]>([]);
    const hasLoadedOnceRef = useRef(false);

    useScrollLock(showExerciseModal && Boolean(selectedExercise));

    useEffect(() => {
        setIsHydrated(true);
    }, []);

    const persistPinnedExercises = useCallback(async (nextPinned: string[]) => {
        const res = await fetch("/api/user/pinned-exercises", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pinnedExercises: nextPinned }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Failed to save pinned exercises");
        }
    }, []);

    const loadStats = useCallback(async (options?: { silent?: boolean }) => {
        if (!isPremium) {
            setLoading(false);
            return;
        }

        if (!options?.silent) setLoading(true);

        try {
            const res = await fetch("/api/stats", { cache: "no-store" });
            const d = await res.json();
            setData(d);

            const exercises = Object.keys(d?.exerciseHistory ?? {});
            let pinned = normalizePinnedExercises(d?.pinnedExercises, exercises);

            if (!hasLoadedOnceRef.current && pinned.length === 0 && typeof window !== "undefined") {
                const stored = localStorage.getItem("pinned_exercises");
                if (stored) {
                    try {
                        const legacy = normalizePinnedExercises(JSON.parse(stored), exercises);
                        if (legacy.length > 0) {
                            pinned = legacy;
                            await persistPinnedExercises(legacy);
                            localStorage.removeItem("pinned_exercises");
                        }
                    } catch {
                        // ignore invalid legacy storage
                    }
                }
            }

            setPinnedExercises(pinned);
            setSelectedExercise((prev) => {
                if (prev && exercises.includes(prev)) return prev;
                if (pinned.length > 0) return pinned[0];
                return exercises[0] ?? "";
            });

            if (d?.volumes?.weekly?.length) {
                setSelectedWeekIndex((prev) =>
                    prev === null || !options?.silent ? d.volumes.weekly.length - 1 : prev
                );
            }

            hasLoadedOnceRef.current = true;
        } catch {
            // keep prior data on silent refresh failure
        } finally {
            setLoading(false);
        }
    }, [isPremium, persistPinnedExercises]);

    useEffect(() => {
        void loadStats();
    }, [loadStats]);

    useWorkoutStatsRefresh(isPremium, loadStats);

    const weeklyVolumes = useMemo(() => data?.volumes?.weekly ?? [], [data]);
    const activeWeekIndex = selectedWeekIndex ?? Math.max(0, weeklyVolumes.length - 1);
    const selectedWeekVolume = weeklyVolumes[activeWeekIndex] ?? null;
    const previousWeekVolume = activeWeekIndex > 0 ? (weeklyVolumes[activeWeekIndex - 1]?.volume ?? 0) : 0;

    const currentWeekStartKey = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const isCurrentCalendarWeek = selectedWeekVolume?.weekStart === currentWeekStartKey;
    const volumeComparisonPeriod = data?.weeklySummary?.volumeComparisonPeriod as string | undefined;
    const weekToDateVsLabel = volumeComparisonPeriod ? `${volumeComparisonPeriod} last week` : "same days last week";
    const selectedWeekComparisonCurrent = isCurrentCalendarWeek
        ? (data?.weeklySummary?.totalVolume ?? selectedWeekVolume?.volume ?? 0)
        : (selectedWeekVolume?.volume ?? 0);
    const selectedWeekComparisonPrevious = isCurrentCalendarWeek
        ? (data?.weeklySummary?.lastWeekVolume ?? 0)
        : previousWeekVolume;
    const selectedWeekComparisonLabel = isCurrentCalendarWeek ? weekToDateVsLabel : "previous week";

    const togglePinExercise = async (ex: string, e: React.MouseEvent) => {
        e.stopPropagation();
        let nextPinned = [...pinnedExercises];
        if (pinnedExercises.includes(ex)) {
            nextPinned = nextPinned.filter(name => name !== ex);
        } else {
            if (pinnedExercises.length >= MAX_PINNED_EXERCISES) {
                alert(`You can only pin up to ${MAX_PINNED_EXERCISES} exercises. Please unpin an exercise first.`);
                return;
            }
            nextPinned.push(ex);
        }
        setPinnedExercises(nextPinned);
        try {
            await persistPinnedExercises(nextPinned);
        } catch (error) {
            setPinnedExercises(pinnedExercises);
            alert(error instanceof Error ? error.message : "Failed to save pinned exercises");
        }
    };

    const getRegex = (q: string) => {
        try {
            return new RegExp(q.trim().split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*'), 'i');
        } catch { return new RegExp(q, 'i'); }
    };

    const exerciseList = useMemo(() => {
        if (!data) return [];
        const names = Object.keys(data?.exerciseHistory ?? {});
        const filtered = names.filter(ex => exerciseSearchQuery ? getRegex(exerciseSearchQuery).test(ex) : true);
        return orderExerciseNames(filtered, pinnedExercises);
    }, [data, exerciseSearchQuery, pinnedExercises]);

    const selectedExerciseHistory = useMemo(() => {
        const raw: any[] = (data?.exerciseHistory ?? {})[selectedExercise] || [];
        return raw.map((session) => ({
            ...session,
            oneRM: deriveOneRMFromBestSet(session.weight, session.reps),
        }));
    }, [data, selectedExercise]);

    const selectedExerciseStats = useMemo(() => {
        if (!selectedExercise || selectedExerciseHistory.length === 0) return null;
        return {
            currentMax: Math.max(...selectedExerciseHistory.map((h) => h.weight || 0)),
            estimatedMax: Math.max(...selectedExerciseHistory.map((h) => h.oneRM || 0)),
        };
    }, [selectedExercise, selectedExerciseHistory]);

    const bodyweightHistory = useMemo(
        () => (data?.bodyweight?.history ?? []) as BodyweightHistoryPoint[],
        [data]
    );

    const filteredBodyweightHistory = useMemo(
        () => filterBodyweightHistory(bodyweightHistory, bwDays),
        [bodyweightHistory, bwDays]
    );

    const bodyweightPeriodStats = useMemo(() => {
        const period = getBodyweightPeriodChange(bodyweightHistory, bwDays);
        if (!period) return null;

        return {
            ...period,
            towardGoal: isWeightChangeTowardGoal(
                period.change,
                data?.bodyweight?.goal,
                data?.bodyweight?.target,
                period.startWeight,
                period.endWeight
            ),
        };
    }, [bodyweightHistory, bwDays, data?.bodyweight?.goal, data?.bodyweight?.target]);

    const bodyweightData = useMemo(
        () => filteredBodyweightHistory.map((d) => ({
            ...d,
            target: data?.bodyweight?.target ?? null,
        })),
        [filteredBodyweightHistory, data?.bodyweight?.target]
    );

    if (!isHydrated) return null;

    if (!isPremium) {
        return (
            <div className="p-4 sm:p-10">
                <PremiumLockScreen
                    title="Progress Analytics"
                    description="Advanced progress tracking is available to Premium members. Upgrade for strength charts, PR tracking, and session history."
                />
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
                <Loader2 className="w-10 h-10 text-brand-400 animate-spin" />
                <p className="text-fg-muted animate-pulse font-medium">Loading progress...</p>
            </div>
        );
    }

    if (!data || data.totalWorkouts === 0) {
        return (
            <div className="p-12 text-center card max-w-2xl mx-auto mt-12 bg-surface-muted/30">
                <Dumbbell className="w-12 h-12 text-brand-400/40 mx-auto mb-4" />
                <h3 className="heading-3 mb-2">Build Your First Data Point</h3>
                <p className="text-sm text-fg-muted mb-6">Complete a workout to see your progress come to life.</p>
                <Link href="/dashboard" className="btn-primary mx-auto">Start Today&apos;s Workout</Link>
            </div>
        );
    }

    const consistencyPct = (data?.consistency?.target ?? 0) > 0
        ? Math.min(Math.round(((data?.consistency?.thisWeek ?? 0) / (data?.consistency?.target ?? 4)) * 100), 100) : 0;

    const formatHabitValue = (value: number | null | undefined, unit: string) => {
        if (value === null || value === undefined) return "--";
        const formatted = unit === "hrs" ? value.toFixed(1) : Math.round(value).toLocaleString();
        return `${formatted}${unit === "hrs" ? "h" : ""}`;
    };
    const habitCards = [
        {
            key: "calories",
            label: "Calories",
            icon: Utensils,
            unit: "kcal",
            color: "text-warning",
            bg: "bg-warning/10",
            border: "border-warning/20",
            metric: data.dailyMetrics?.calories,
        },
        {
            key: "steps",
            label: "Steps",
            icon: Footprints,
            unit: "steps",
            color: "text-success",
            bg: "bg-success/10",
            border: "border-success/20",
            metric: data.dailyMetrics?.steps,
        },
        {
            key: "sleep",
            label: "Sleep",
            icon: Moon,
            unit: "hrs",
            color: "text-brand-400",
            bg: "bg-brand-500/10",
            border: "border-brand-500/20",
            metric: data.dailyMetrics?.sleep,
        },
    ].filter(card => !hiddenGoals?.includes(card.key));

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in mb-24 lg:mb-12">

            {/* ── WEEKLY PULSE ── */}
            <section>
                <h2 className="text-xs font-black text-fg-subtle uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-brand-400" />
                    Weekly Pulse
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {/* Consistency Ring */}
                    <div className="card p-5 flex items-center gap-4">
                        <div className="relative w-14 h-14 shrink-0">
                            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                <path
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none" stroke="#1E293B" strokeWidth="3"
                                />
                                <path
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none" stroke={consistencyPct >= 100 ? "#10B981" : "#8B5CF6"} strokeWidth="3"
                                    strokeDasharray={`${consistencyPct}, 100`}
                                    strokeLinecap="round"
                                    className="transition-all duration-1000 ease-out"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs font-black text-fg">{data?.consistency?.thisWeek ?? 0}/{data?.consistency?.target ?? 4}</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-fg-subtle uppercase tracking-widest">Workouts</p>
                            <p className="text-xs text-fg-muted mt-0.5">
                                {consistencyPct >= 100 ? "On track! 🔥" : `${(data?.consistency?.target ?? 4) - (data?.consistency?.thisWeek ?? 0)} to go`}
                            </p>
                        </div>
                    </div>

                    {/* Volume This Week */}
                    <div className="card p-5">
                        <p className="text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-1">Training Volume · This Week</p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black text-fg">
                                {(data.weeklySummary?.totalVolume ?? 0).toLocaleString()}
                            </span>
                            <span className="text-[10px] font-bold text-fg-muted">kg</span>
                        </div>
                        <div className="mt-2">
                            <VolumeComparisonBadge
                                current={data.weeklySummary?.totalVolume ?? 0}
                                previous={data.weeklySummary?.lastWeekVolume ?? 0}
                                vsLabel={weekToDateVsLabel}
                            />
                        </div>
                    </div>

                </div>
            </section>

            {/* ── LAST WORKOUT ── */}
            {data.lastWorkout && (
                <section className="card p-5 sm:p-6 bg-gradient-to-br from-brand-500/5 to-transparent border-brand-500/10">
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
                                <Dumbbell className="w-5 h-5 text-brand-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-fg">{data.lastWorkout.name}</h3>
                                <p className="text-[10px] font-bold text-fg-muted uppercase tracking-widest">{data.lastWorkout.date}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                             {data.lastWorkout.id && (
                                <ReturnLink 
                                    href={`/plans/log/view/${data.lastWorkout.id}`}
                                    className="btn-ghost btn-sm text-[10px] uppercase font-black tracking-widest text-brand-400 border border-brand-500/10 hover:border-brand-500/30"
                                >
                                    Review
                                </ReturnLink>
                             )}
                            {data.lastWorkout.feeling && (
                                <div className="text-lg">{workoutFeelingEmoji(data.lastWorkout.feeling)}</div>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="bg-surface-muted/50 rounded-xl p-3 text-center">
                            <p className="text-lg font-black text-fg">{data.lastWorkout.totalSets}</p>
                            <p className="text-[9px] font-bold text-fg-subtle uppercase tracking-widest">Sets</p>
                        </div>
                        <div className="bg-surface-muted/50 rounded-xl p-3 text-center">
                            <p className="text-lg font-black text-fg">
                                {(data.lastWorkout?.totalVolume ?? 0).toLocaleString()}
                                <span className="text-[10px] text-fg-muted ml-0.5">kg</span>
                            </p>
                            <p className="text-[9px] font-bold text-fg-subtle uppercase tracking-widest">Volume</p>
                        </div>
                        <div className="bg-surface-muted/50 rounded-xl p-3 text-center">
                            <p className="text-lg font-black text-fg">{data.lastWorkout.duration || "--"}</p>
                            <p className="text-[9px] font-bold text-fg-subtle uppercase tracking-widest">Mins</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {(data.lastWorkout?.exercises ?? []).map((ex: string) => (
                            <span key={ex} className="px-2.5 py-1 bg-surface-muted/60 rounded-lg text-[10px] font-bold text-fg-muted uppercase tracking-wider">
                                {ex}
                            </span>
                        ))}
                    </div>
                </section>
            )}

            {/* ── BODYWEIGHT TREND ── */}
            {bodyweightData.length > 0 && !hiddenGoals?.includes("weight") ? (
                <section className="card p-5 sm:p-6">
                    {/* Top bar: title + timeframe toggle */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
                        <div className="flex items-center gap-3">
                            <Scale className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-0.5">Bodyweight Trend</p>
                                {/* ── BIG current weight ── */}
                                <div className="flex items-end gap-3">
                                    <h3 className="text-4xl font-black text-fg tracking-tighter leading-none">
                                        {data?.bodyweight?.current ? data.bodyweight.current.toFixed(1) : "--"}
                                        <span className="text-lg font-bold text-fg-muted ml-1">kg</span>
                                    </h3>
                                    {/* Period delta badge */}
                                    {bodyweightPeriodStats && bodyweightPeriodStats.change !== 0 && (
                                        <span className={cn(
                                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-black mb-1",
                                            bodyweightPeriodStats.towardGoal
                                                ? "bg-success/10 text-success"
                                                : "bg-red-500/10 text-red-400"
                                        )}>
                                            {bodyweightPeriodStats.change > 0
                                                ? <TrendingUp className="w-3 h-3" />
                                                : <TrendingDown className="w-3 h-3" />}
                                            {bodyweightPeriodStats.change > 0 ? "+" : ""}
                                            {bodyweightPeriodStats.change.toFixed(1)} kg {bodyweightPeriodStats.periodLabel}
                                        </span>
                                    )}
                                </div>
                                {/* Target line */}
                                {data?.bodyweight?.target && (
                                    <p className="text-[10px] text-fg-muted mt-1.5">
                                        Goal: <span className="text-red-400 font-bold">{data.bodyweight.target.toFixed(1)} kg</span>
                                        <span className="mx-1 text-fg-subtle">·</span>
                                        <span className={cn("font-bold", Math.abs((data?.bodyweight?.current ?? 0) - (data?.bodyweight?.target ?? 0)) < 2 ? "text-success" : "text-fg-muted")}>
                                            {Math.abs((data?.bodyweight?.current ?? 0) - (data?.bodyweight?.target ?? 0)).toFixed(1)} kg away
                                        </span>
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-3">
                            <div className="flex bg-surface-muted p-1 rounded-xl self-start sm:self-auto">
                                {BW_TIMEFRAMES.map(({ days, label }) => (
                                    <button
                                        key={days}
                                        onClick={() => setBwDays(days)}
                                        className={cn(
                                            "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                            bwDays === days ? "bg-surface-card text-brand-400 shadow-sm" : "text-fg-subtle hover:text-fg"
                                        )}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            {/* Period change */}
                            <div className="text-right">
                                <p className="text-[9px] font-black text-fg-subtle uppercase tracking-widest">
                                    {BW_TIMEFRAMES.find((frame) => frame.days === bwDays)?.label ?? "Period"} change
                                </p>
                                <p className={cn(
                                    "text-sm font-black",
                                    bodyweightPeriodStats
                                        ? bodyweightPeriodStats.towardGoal ? "text-success" : "text-red-400"
                                        : "text-fg"
                                )}>
                                    {bodyweightPeriodStats
                                        ? `${bodyweightPeriodStats.change > 0 ? "+" : ""}${bodyweightPeriodStats.change.toFixed(1)} kg`
                                        : "—"}
                                </p>
                            </div>
                        </div>
                    </div>


                    <div className="h-[260px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={bodyweightData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="bwGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                                <XAxis dataKey="date" stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis 
                                    stroke="#4B5563" 
                                    fontSize={10} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    domain={[
                                        (min: number) => data?.bodyweight?.target ? Math.min(min, data.bodyweight.target) - 2 : min - 2,
                                        (max: number) => data?.bodyweight?.target ? Math.max(max, data.bodyweight.target) + 2 : max + 2
                                    ]} 
                                />
                                <Tooltip
                                    formatter={(value: any) => [`${Number(value).toFixed(2)}kg`, "Weight"]}
                                    contentStyle={{ backgroundColor: "#0F172A", borderRadius: "12px", border: "1px solid #1E293B", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}
                                    itemStyle={{ fontWeight: 800 }}
                                    labelStyle={{ color: "#6B7280", fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.1em" }}
                                />
                                {data?.bodyweight?.target && (
                                    <ReferenceLine
                                        y={data.bodyweight.target}
                                        stroke="#EF4444"
                                        strokeDasharray="4 4"
                                        strokeWidth={2}
                                        label={{ 
                                            value: `GOAL: ${data.bodyweight.target.toFixed(1)}kg`, 
                                            position: "insideTopRight", 
                                            fill: "#EF4444", 
                                            fontSize: 9, 
                                            fontWeight: 900,
                                            offset: 6
                                        }}
                                    />
                                )}
                                <Area type="monotone" dataKey="weight" name="Weight" stroke="#8B5CF6" strokeWidth={3} fill="url(#bwGrad)" dot={{ r: 3, fill: "#8B5CF6", strokeWidth: 0 }} activeDot={{ r: 6, fill: "#A78BFA", strokeWidth: 0 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                        {habitCards.map(({ key, label, icon: Icon, unit, color, bg, border, metric }) => {
                            const current = metric?.current ?? null;
                            const target = metric?.target ?? null;
                            const weeklyAverage = metric?.weeklyAverage ?? null;
                            const previousAverage = metric?.previousWeeklyAverage ?? null;
                            const change = weeklyAverage !== null && previousAverage !== null
                                ? Math.round((weeklyAverage - previousAverage) * 10) / 10
                                : null;
                            const isUp = (change ?? 0) >= 0;

                            return (
                                <div key={key} className={cn("rounded-2xl border p-4 bg-surface-muted/30", border)}>
                                    <div className="flex items-center justify-between gap-3 mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", bg)}>
                                                <Icon className={cn("w-4 h-4", color)} />
                                            </div>
                                            <p className="text-[10px] font-black text-fg-subtle uppercase tracking-widest">{label}</p>
                                        </div>
                                        {change !== null && (
                                            <span className={cn(
                                                "inline-flex items-center gap-1 text-[10px] font-black",
                                                isUp ? "text-success" : "text-danger"
                                            )}>
                                                {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                {change > 0 ? "+" : ""}{unit === "hrs" ? change.toFixed(1) : Math.round(change).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-end justify-between gap-3">
                                        <div>
                                            <p className="text-2xl font-black text-fg leading-none">
                                                {formatHabitValue(current, unit)}
                                                {unit !== "hrs" && unit !== "steps" && <span className="text-[10px] font-bold text-fg-muted ml-1">{unit}</span>}
                                            </p>
                                            <p className="text-[10px] font-bold text-fg-muted mt-1">Latest log</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-fg-subtle uppercase tracking-widest">Avg</p>
                                            <p className="text-xs font-black text-fg">{formatHabitValue(weeklyAverage, unit)}</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-surface-border/60 flex items-center justify-between">
                                        <span className="text-[9px] font-black text-fg-subtle uppercase tracking-widest">Goal</span>
                                        <span className={cn("text-xs font-black", target ? color : "text-fg-muted")}>
                                            {formatHabitValue(target, unit)}
                                            {target && unit === "kcal" ? " kcal" : target && unit === "steps" ? " steps" : ""}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            ) : (
                habitCards.length > 0 && (
                    <section className="card p-5 sm:p-6">
                        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-surface-border/50">
                            <Activity className="w-5 h-5 text-brand-400" />
                            <div>
                                <p className="text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-0.5">Daily Metrics Trend</p>
                                <h3 className="text-lg font-black text-fg tracking-tight">Habit Targets</h3>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {habitCards.map(({ key, label, icon: Icon, unit, color, bg, border, metric }) => {
                                const current = metric?.current ?? null;
                                const target = metric?.target ?? null;
                                const weeklyAverage = metric?.weeklyAverage ?? null;
                                const previousAverage = metric?.previousWeeklyAverage ?? null;
                                const change = weeklyAverage !== null && previousAverage !== null
                                    ? Math.round((weeklyAverage - previousAverage) * 10) / 10
                                    : null;
                                const isUp = (change ?? 0) >= 0;

                                return (
                                    <div key={key} className={cn("rounded-2xl border p-4 bg-surface-muted/30", border)}>
                                        <div className="flex items-center justify-between gap-3 mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", bg)}>
                                                    <Icon className={cn("w-4 h-4", color)} />
                                                </div>
                                                <p className="text-[10px] font-black text-fg-subtle uppercase tracking-widest">{label}</p>
                                            </div>
                                            {change !== null && (
                                                <span className={cn(
                                                    "inline-flex items-center gap-1 text-[10px] font-black",
                                                    isUp ? "text-success" : "text-danger"
                                                )}>
                                                    {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                    {change > 0 ? "+" : ""}{unit === "hrs" ? change.toFixed(1) : Math.round(change).toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-end justify-between gap-3">
                                            <div>
                                                <p className="text-2xl font-black text-fg leading-none">
                                                    {formatHabitValue(current, unit)}
                                                    {unit !== "hrs" && unit !== "steps" && <span className="text-[10px] font-bold text-fg-muted ml-1">{unit}</span>}
                                                </p>
                                                <p className="text-[10px] font-bold text-fg-muted mt-1">Latest log</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] font-black text-fg-subtle uppercase tracking-widest">Avg</p>
                                                <p className="text-xs font-black text-fg">{formatHabitValue(weeklyAverage, unit)}</p>
                                            </div>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-surface-border/60 flex items-center justify-between">
                                            <span className="text-[9px] font-black text-fg-subtle uppercase tracking-widest">Goal</span>
                                            <span className={cn("text-xs font-black", target ? color : "text-fg-muted")}>
                                                {formatHabitValue(target, unit)}
                                                {target && unit === "kcal" ? " kcal" : target && unit === "steps" ? " steps" : ""}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )
            )}



            {/* ── TRAINING VOLUME ── */}
                        {/* ── EXERCISE HISTORY ── */}
            <section>
                <h2 className="text-xs font-black text-fg-subtle uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-brand-400" />
                    Exercise History
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Chart */}
                    <div className="lg:col-span-8 card overflow-hidden">
                        <div className="p-5 border-b border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <h3 className="text-base font-black text-fg tracking-tight">{selectedExercise || "Select an exercise"}</h3>
                                <p className="text-[10px] text-fg-muted font-medium mt-0.5">Performance curve over time</p>
                            </div>
                            {selectedExerciseStats && (
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="text-center px-3 py-1.5 rounded-xl bg-warning/10 border border-warning/20">
                                        <p className="text-[9px] font-black text-warning/70 uppercase tracking-widest">Est. Max</p>
                                        <p className="text-sm font-black text-warning">{selectedExerciseStats.estimatedMax}<span className="text-[9px] ml-0.5 font-bold">kg</span></p>
                                    </div>
                                    <div className="text-center px-3 py-1.5 rounded-xl bg-brand-500/10 border border-brand-500/20">
                                        <p className="text-[9px] font-black text-brand-400/70 uppercase tracking-widest">Current Max</p>
                                        <p className="text-sm font-black text-brand-400">{selectedExerciseStats.currentMax}<span className="text-[9px] ml-0.5 font-bold">kg</span></p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-5 sm:p-6">
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={selectedExerciseHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="exGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                                        <XAxis dataKey="date" stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                                        <Tooltip
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <ExerciseHistoryTooltipContent
                                                            label={label}
                                                            data={payload[0].payload}
                                                        />
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Area
                                            type="monotone" dataKey="weight" stroke="#8B5CF6" strokeWidth={3}
                                            fill="url(#exGrad)"
                                            dot={{ r: 4, fill: "#8B5CF6", stroke: "#0F172A", strokeWidth: 2 }}
                                            activeDot={{ r: 6, fill: "#A78BFA", strokeWidth: 0 }}
                                            animationDuration={800}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="oneRM"
                                            stroke="#FACC15"
                                            strokeWidth={2}
                                            strokeDasharray="5 5"
                                            dot={false}
                                            activeDot={false}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Exercise Library */}
                    <div className="lg:col-span-4 card flex flex-col max-h-[460px]">
                        <div className="p-4 border-b border-surface-border">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-subtle" />
                                <input
                                    type="text"
                                    className="pl-9 pr-4 py-2.5 w-full bg-surface-elevated border border-surface-border rounded-xl text-xs font-bold outline-none focus:border-brand-500/50 transition-all"
                                    placeholder="Search exercises..."
                                    value={exerciseSearchQuery}
                                    onChange={(e) => setExerciseSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
                            {exerciseList.map(ex => {
                                const hist = (data?.exerciseHistory ?? {})[ex] ?? [];
                                const latest = hist.length > 0 ? hist[hist.length - 1] : null;
                                const isActive = selectedExercise === ex;
                                const isPinned = pinnedExercises.includes(ex);
                                return (
                                    <div
                                        key={ex}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => { setSelectedExercise(ex); setShowExerciseModal(false); }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                setSelectedExercise(ex);
                                                setShowExerciseModal(false);
                                            }
                                        }}
                                        className={cn(
                                            "w-full flex items-center justify-between p-3 rounded-xl transition-all text-left cursor-pointer group",
                                            isActive ? "bg-brand-500/10 border border-brand-500/20" : "hover:bg-surface-elevated border border-transparent"
                                        )}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", isActive ? "bg-brand-500 text-white" : "bg-surface-muted text-fg-subtle")}>
                                                <Dumbbell className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className={cn("text-xs font-black truncate", isActive ? "text-brand-400" : "text-fg")}>{ex}</p>
                                                <p className="text-[10px] text-fg-muted truncate">Best: {latest?.weight ?? "--"}kg · {hist?.length ?? 0} sessions</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={(e) => togglePinExercise(ex, e)}
                                                className={cn(
                                                    "p-1.5 rounded-lg transition-all hover:bg-surface-muted/80",
                                                    isPinned ? "text-brand-400 opacity-100" : "text-fg-subtle opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                )}
                                                title={isPinned ? "Unpin exercise" : "Pin exercise"}
                                            >
                                                <Pin className={cn("w-3.5 h-3.5", isPinned && "fill-brand-400")} />
                                            </button>
                                            <ChevronRight className={cn("w-4 h-4 shrink-0 transition-opacity", isActive ? "text-brand-400 opacity-100" : "opacity-0")} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>

            {/* Training Volume */}
            <section className="card p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <BarChart2 className="w-5 h-5 text-success" />
                        <h3 className="text-sm font-black text-fg uppercase tracking-widest">Training Volume</h3>
                    </div>
                    <div className="flex bg-surface-muted p-1 rounded-xl self-start shrink-0">
                        {(["daily", "weekly", "monthly", "yearly"] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => setVolTimeframe(t)}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                    volTimeframe === t ? "bg-surface-card text-brand-400 shadow-sm" : "text-fg-subtle hover:text-fg"
                                )}
                            >
                                {t.charAt(0)}
                            </button>
                        ))}
                    </div>
                </div>

                {volTimeframe === "weekly" && selectedWeekVolume && (
                    <div className="mb-6 p-4 rounded-2xl bg-surface-muted/30 border border-surface-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">
                                Week of {selectedWeekVolume.label}
                            </p>
                            <p className="text-2xl font-black text-fg mt-1">
                                {selectedWeekVolume.volume.toLocaleString()}
                                <span className="text-sm font-bold text-fg-muted ml-1">kg</span>
                            </p>
                        </div>
                        <VolumeComparisonBadge
                            current={selectedWeekComparisonCurrent}
                            previous={selectedWeekComparisonPrevious}
                            vsLabel={selectedWeekComparisonLabel}
                        />
                    </div>
                )}

                <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data?.volumes?.[volTimeframe] || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                            <XAxis dataKey="label" stroke="#4B5563" fontSize={9} tickLine={false} axisLine={false} />
                            <YAxis stroke="#4B5563" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v} />
                            <Tooltip
                                contentStyle={{ backgroundColor: "#0F172A", borderRadius: "12px", border: "1px solid #1E293B" }}
                                formatter={(value) => [`${Number(value ?? 0).toLocaleString()} kg`, "Volume"]}
                                cursor={{ fill: '#8B5CF610' }}
                                labelStyle={{ color: "#6B7280", fontSize: 10, fontWeight: 800 }}
                            />
                            <Bar
                                dataKey="volume"
                                radius={[6, 6, 0, 0]}
                                barSize={volTimeframe === 'daily' ? 12 : 28}
                                onClick={(_, index) => {
                                    if (volTimeframe === "weekly" && typeof index === "number") {
                                        setSelectedWeekIndex(index);
                                    }
                                }}
                                className={volTimeframe === "weekly" ? "cursor-pointer" : undefined}
                            >
                                {(data?.volumes?.[volTimeframe] || []).map((_: unknown, index: number) => {
                                    const isHighlighted = volTimeframe === "weekly"
                                        ? index === activeWeekIndex
                                        : index === (data?.volumes?.[volTimeframe] || []).length - 1;
                                    return (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={isHighlighted ? "#8B5CF6" : "#1E293B"}
                                            stroke={isHighlighted ? "#8B5CF6" : "#374151"}
                                            strokeWidth={1}
                                        />
                                    );
                                })}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <p className="text-[9px] text-fg-subtle font-bold uppercase tracking-widest mt-3 text-center">
                    {volTimeframe === "weekly"
                        ? "Tap a week to compare volume with the previous week"
                        : `Total kg moved per ${volTimeframe.replace('ly', '').replace('i', 'y')} — latest period highlighted`}
                </p>
            </section>

            {/* ── EXERCISE DETAIL MODAL ── */}
            {showExerciseModal && selectedExercise && (
                <div className="fixed inset-0 z-50 flex overflow-hidden overscroll-none items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowExerciseModal(false)}>
                    <div className="bg-surface-card border border-surface-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto overscroll-contain" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-6 border-b border-surface-border sticky top-0 bg-surface-card/95 backdrop-blur-md z-10">
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-black text-fg tracking-tight">{selectedExercise}</h3>
                                <p className="text-[10px] text-fg-muted font-bold uppercase tracking-widest mt-1">
                                    {selectedExerciseHistory.length} sessions logged
                                </p>
                            </div>
                            {selectedExerciseStats && (
                                <div className="flex items-center gap-2 mr-3">
                                    <div className="text-center px-2.5 py-1.5 rounded-xl bg-warning/10 border border-warning/20">
                                        <p className="text-[8px] font-black text-warning/70 uppercase tracking-widest">Est. Max</p>
                                        <p className="text-sm font-black text-warning leading-tight">{selectedExerciseStats.estimatedMax}<span className="text-[8px] ml-0.5 font-bold">kg</span></p>
                                    </div>
                                    <div className="text-center px-2.5 py-1.5 rounded-xl bg-brand-500/10 border border-brand-500/20">
                                        <p className="text-[8px] font-black text-brand-400/70 uppercase tracking-widest">Current Max</p>
                                        <p className="text-sm font-black text-brand-400 leading-tight">{selectedExerciseStats.currentMax}<span className="text-[8px] ml-0.5 font-bold">kg</span></p>
                                    </div>
                                </div>
                            )}
                            <button onClick={() => setShowExerciseModal(false)} className="w-8 h-8 rounded-lg bg-surface-muted hover:bg-surface-elevated flex items-center justify-center transition-colors shrink-0">
                                <X className="w-4 h-4 text-fg-muted" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Graph */}
                            <div className="h-[240px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={selectedExerciseHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="modalGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                                        <XAxis dataKey="date" stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <ExerciseHistoryTooltipContent
                                                            label={label}
                                                            data={payload[0].payload}
                                                        />
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Area type="monotone" dataKey="weight" stroke="#8B5CF6" strokeWidth={3} fill="url(#modalGrad)" dot={{ r: 4, fill: "#8B5CF6", stroke: "#0F172A", strokeWidth: 2 }} activeDot={{ r: 6, fill: "#A78BFA", strokeWidth: 0 }} />
                                        <Line type="monotone" dataKey="oneRM" stroke="#FACC15" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Session History Table */}
                            <div>
                                <h4 className="text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-3">Session Log</h4>
                                <div className="space-y-2">
                                    {selectedExerciseHistory.slice().reverse().map((session: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-surface-elevated/50 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-bold text-fg-subtle w-16 whitespace-nowrap">{session.date}</span>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-fg">{session.weight}kg × {session.reps}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] font-bold text-yellow-500/80">Est. 1RM: {session.oneRM}kg</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
