"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
    ChevronLeft, ChevronRight,
    Info, Clock,
    Layout, History,
    PlayCircle,
    Zap, Hash, Flame,
    PencilLine,
    MessageSquare, ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReturnLink } from "@/components/shared/ReturnLink";
import { cn, toDateKey, parseLogDate, formatDate } from "@/lib/utils";
import { shiftAppDateKey, weekdayFromDateKey } from "@/lib/appTimezone";
import { useCurrentDate } from "@/hooks/useCurrentDate";
import {
    getPlanDayOffset,
    getPlanEndDateKey,
    getPlanProgramWeekNumber,
    getPlanScheduleMode,
    getPlanStartDateKey,
    isDateAfterPlanEnd,
    isDateBeforePlanStart,
    type PlanScheduleRevisionRecord,
} from "@/lib/planSchedule";
import { groupLogSetsByExercise } from "@/lib/logSetGrouping";
import { serializePlanWeeksForSchedule } from "@/lib/planScheduleHistory";
import {
    resolvePlannedWorkoutWithExercisesForDate,
    sortPlannedExercises,
} from "@/lib/plannedWorkoutResolve";
import { isScheduledTrainingWorkout } from "@/lib/planTrainingTarget";
import {
    resolveWorkoutDayStatus,
    WORKOUT_DAY_STATUS_STYLES,
    type WorkoutDayStatus,
} from "@/lib/workoutDayStatus";
import { CalendarComplianceSummary } from "@/components/calendar/CalendarComplianceSummary";
import type { CalendarComplianceInput } from "@/lib/calendarCompliance";

/* ─────────────────────────── Types ─────────────────────────── */
interface PlanExercise {
    id: string;
    name: string;
    sets: number;
    reps: string;
    order?: number;
    weightTargetKg?: number | null;
    setTargets?: Array<{
        setNumber: number;
        weightKg?: number | null;
        reps?: number | null;
    }>;
}
interface PlanWorkout {
    dayNumber: number;
    dayOfWeek?: number | null;
    name: string;
    id: string;
    exercises: PlanExercise[];
    /** Historical/log reconstructions that omit exercises still count as training. */
    isScheduledTraining?: boolean;
}
interface PlanWeek { weekNumber: number; workouts: PlanWorkout[]; }
interface ActivePlan { id?: string; name: string; weeks: PlanWeek[]; }

interface CalendarCell {
    dateKey: string;
    day: number;
    inCurrentMonth: boolean;
}

interface LogSet {
    exerciseId: string;
    exerciseName: string;
    exerciseOrder?: number | null;
    setNumber: number;
    reps?: number | null;
    weightKg?: number | null;
    rpe?: number | null;
}
interface LoggedDate { 
    id: string;
    date: string; // YYYY-MM-DD
    workoutName: string; 
    workoutId: string;
    duration?: number | null;
    sets: LogSet[]; 
}

interface InProgressSession {
    id: string;
    date: string;
    workoutId: string;
    workoutName: string;
}

export interface CalendarView {
    year: number;
    month: number;
}

interface Props {
    activePlan: ActivePlan | null;
    planStartedAt: string | null;
    loggedDates: LoggedDate[];
    inProgressSessions: InProgressSession[];
    scheduleRevisions?: PlanScheduleRevisionRecord[];
    excusedMissedWorkoutKeys?: string[];
    historicalMissedSessions?: Array<{ dateKey: string; workoutId: string; workoutName: string }>;
    /** One-off session overrides keyed by `${dateKey}:${workoutId}` */
    sessionOverrides?: Record<
        string,
        {
            workoutName: string | null;
            exercises: PlanExercise[];
        }
    >;
    coachView?: {
        clientId: string;
        clientName: string;
        planId: string | null;
    };
    view?: CalendarView;
    onViewChange?: (view: CalendarView) => void;
    initialSelectedDateKey?: string;
    focusSelection?: boolean;
    coachId?: string | null;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

type DayWorkoutStatus = WorkoutDayStatus;

const STATUS_CONFIG = WORKOUT_DAY_STATUS_STYLES;

function matchingCompletedLog(logs: LoggedDate[], planned: PlanWorkout | null): LoggedDate | null {
    if (planned && isScheduledTrainingWorkout(planned)) {
        return logs.find((log) => log.workoutId === planned.id) ?? null;
    }
    return logs[0] ?? null;
}

function matchingActiveSession(
    sessions: InProgressSession[],
    planned: PlanWorkout | null
): InProgressSession | null {
    if (planned && isScheduledTrainingWorkout(planned)) {
        return sessions.find((session) => session.workoutId === planned.id) ?? null;
    }
    return sessions[0] ?? null;
}

function resolveDayStatus(input: {
    log: LoggedDate | null;
    dayInProgress: InProgressSession | null;
    planned: PlanWorkout | null;
    isPast: boolean;
    isTodayDay: boolean;
    isExcused: boolean;
}): DayWorkoutStatus {
    return resolveWorkoutDayStatus({
        hasCompletedLog: Boolean(input.log),
        hasActiveSession: Boolean(input.dayInProgress),
        hasScheduledTraining: isScheduledTrainingWorkout(input.planned),
        isPast: input.isPast,
        isToday: input.isTodayDay,
        isExcused: input.isExcused,
    });
}

function displayWorkoutName(name: string): string {
    return name.trim();
}

export function CalendarClient({
    activePlan,
    planStartedAt,
    loggedDates,
    inProgressSessions,
    scheduleRevisions = [],
    excusedMissedWorkoutKeys = [],
    historicalMissedSessions = [],
    sessionOverrides = {},
    coachView,
    view: controlledView,
    onViewChange,
    initialSelectedDateKey,
    focusSelection = false,
    coachId = null,
}: Props) {
    const isCoachView = Boolean(coachView);
    const router = useRouter();
    const planId = coachView?.planId ?? activePlan?.id ?? null;
    const now = useCurrentDate();
    const todayKey = toDateKey(now);
    const prevTodayKeyRef = useRef(todayKey);

    const [internalView, setInternalView] = useState<CalendarView>(() => {
        const [y, m] = todayKey.split("-").map(Number);
        return { year: y, month: m - 1 };
    });
    const isControlled = controlledView !== undefined && onViewChange !== undefined;
    const view = isControlled ? controlledView! : internalView;
    const setView = (updater: CalendarView | ((prev: CalendarView) => CalendarView)) => {
        const next = typeof updater === "function" ? updater(view) : updater;
        if (isControlled) onViewChange!(next);
        else setInternalView(next);
    };
    const [selectedDateKey, setSelectedDateKey] = useState<string>(initialSelectedDateKey ?? todayKey);
    const detailPanelRef = useRef<HTMLDivElement>(null);
    const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

    useEffect(() => {
        if (!initialSelectedDateKey) return;
        setSelectedDateKey(initialSelectedDateKey);
        const [y, m] = initialSelectedDateKey.split("-").map(Number);
        setView({ year: y, month: m - 1 });
    }, [initialSelectedDateKey]);

    useEffect(() => {
        if (!focusSelection || !initialSelectedDateKey) return;
        if (selectedDateKey !== initialSelectedDateKey) return;
        if (window.innerWidth < 1024) setMobileDetailOpen(true);
        const timer = window.setTimeout(() => {
            detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 150);
        return () => window.clearTimeout(timer);
    }, [focusSelection, initialSelectedDateKey, selectedDateKey]);

    useEffect(() => {
        const prevTodayKey = prevTodayKeyRef.current;
        if (prevTodayKey === todayKey) return;
        prevTodayKeyRef.current = todayKey;
        setSelectedDateKey((current) => (current === prevTodayKey ? todayKey : current));
        setView((current) => {
            const [prevYear, prevMonth] = prevTodayKey.split("-").map(Number);
            const [ty, tm] = todayKey.split("-").map(Number);
            if (current.year === prevYear && current.month === prevMonth - 1) {
                return { year: ty, month: tm - 1 };
            }
            return current;
        });
    }, [todayKey]);

    /* ─── Data Mappers ─── */
    const logMap = useMemo(() => {
        const map: Record<string, LoggedDate[]> = {};
        loggedDates.forEach((l) => {
            if (!map[l.date]) map[l.date] = [];
            map[l.date].push(l);
        });
        return map;
    }, [loggedDates]);

    const inProgressByDate = useMemo(() => {
        const map: Record<string, InProgressSession[]> = {};
        inProgressSessions.forEach((session) => {
            if (!map[session.date]) map[session.date] = [];
            map[session.date].push(session);
        });
        return map;
    }, [inProgressSessions]);

    const historicalMissedByDate = useMemo(() => {
        // Keep every frozen miss so past scheduled days stay Missed even after
        // plan edits, switches, or end — never drop them just because the live
        // plan start moved.
        const map = new Map<string, { workoutId: string; workoutName: string }>();
        for (const session of historicalMissedSessions) {
            map.set(session.dateKey, session);
        }
        return map;
    }, [historicalMissedSessions]);

    const [localExcusedKeys, setLocalExcusedKeys] = useState(excusedMissedWorkoutKeys);
    const [statusUpdating, setStatusUpdating] = useState(false);

    useEffect(() => {
        setLocalExcusedKeys(excusedMissedWorkoutKeys);
    }, [excusedMissedWorkoutKeys]);

    const excusedKeys = useMemo(
        () => new Set(localExcusedKeys),
        [localExcusedKeys]
    );

    const isWorkoutExcused = useCallback((dateKey: string, workoutId: string) => {
        return excusedKeys.has(`${dateKey}:${workoutId}`);
    }, [excusedKeys]);

    const planWeekCount = activePlan?.weeks.length ?? 0;
    const planScheduleMode = getPlanScheduleMode(planWeekCount);

    const planEndDateKey = useMemo(
        () => (planStartedAt && planWeekCount > 1 ? getPlanEndDateKey(planStartedAt, planWeekCount) : null),
        [planStartedAt, planWeekCount]
    );

    const todayDate = useMemo(() => parseLogDate(todayKey), [todayKey]);

    const currentProgramWeek = useMemo(() => {
        if (!planStartedAt || planWeekCount <= 1) return null;
        const diffDays = getPlanDayOffset(planStartedAt, todayDate);
        return getPlanProgramWeekNumber(planWeekCount, diffDays);
    }, [planStartedAt, planWeekCount, todayDate]);

    const isPlanComplete = planEndDateKey !== null && todayKey > planEndDateKey;

    const getProgramWeekForDateKey = useCallback((dateKey: string) => {
        if (!planStartedAt || planWeekCount <= 1) return null;
        const diffDays = getPlanDayOffset(planStartedAt, parseLogDate(dateKey));
        return getPlanProgramWeekNumber(planWeekCount, diffDays);
    }, [planStartedAt, planWeekCount]);

    const serializedPlanWeeks = useMemo(
        () => (activePlan
            ? serializePlanWeeksForSchedule(
                activePlan.weeks.map((week) => ({
                    weekNumber: week.weekNumber,
                    workouts: week.workouts.map((workout) => ({
                        id: workout.id,
                        name: workout.name,
                        dayNumber: workout.dayNumber,
                        dayOfWeek: workout.dayOfWeek ?? null,
                        exercises: workout.exercises.map((exercise) => ({
                            id: exercise.id,
                            name: exercise.name,
                            sets: exercise.sets,
                            reps: exercise.reps,
                            weightTargetKg: exercise.weightTargetKg ?? null,
                        })),
                    })),
                }))
            )
            : []),
        [activePlan]
    );

    const resolvePlannedWorkoutForDate = useCallback((date: Date, dateKey?: string): PlanWorkout | null => {
        const key = dateKey ?? toDateKey(date);
        const planStartKey = planStartedAt ? getPlanStartDateKey(planStartedAt) : null;

        const workoutFromLog = (): PlanWorkout | null => {
            const session = logMap[key]?.[0];
            if (!session) return null;
            return {
                id: session.workoutId,
                name: session.workoutName,
                dayNumber: 0,
                dayOfWeek: null,
                exercises: [],
                isScheduledTraining: true,
            };
        };

        const workoutFromHistorical = (): PlanWorkout | null => {
            const historical = historicalMissedByDate.get(key);
            if (!historical) return null;
            return {
                id: historical.workoutId,
                name: historical.workoutName,
                dayNumber: 0,
                dayOfWeek: null,
                exercises: [],
                isScheduledTraining: true,
            };
        };

        if (planStartKey && isDateBeforePlanStart(planStartedAt!, key)) {
            return workoutFromLog();
        }

        if (!planStartedAt || serializedPlanWeeks.length === 0) {
            if (planStartedAt && planWeekCount > 1 && isDateAfterPlanEnd(planStartedAt, planWeekCount, key)) {
                return workoutFromLog();
            }
            return workoutFromLog() ?? workoutFromHistorical();
        }

        const resolved = resolvePlannedWorkoutWithExercisesForDate({
            startedAt: planStartedAt,
            weeks: serializedPlanWeeks,
            scheduleRevisions,
            date,
            today: todayDate,
            dateKey: key,
        });
        if (resolved) {
            const override = sessionOverrides[`${key}:${resolved.id}`];
            return {
                id: resolved.id,
                name: override?.workoutName?.trim() || resolved.name,
                dayNumber: resolved.dayNumber,
                dayOfWeek: resolved.dayOfWeek,
                exercises: sortPlannedExercises(
                    (override?.exercises?.length
                        ? override.exercises.map((ex, index) => ({
                            id: ex.id,
                            name: ex.name,
                            sets: ex.sets,
                            reps: ex.reps,
                            order: ex.order ?? index,
                            weightTargetKg: ex.weightTargetKg ?? null,
                            setTargets: ex.setTargets,
                        }))
                        : resolved.exercises.map((ex, index) => ({
                            id: ex.id,
                            name: ex.name,
                            sets: ex.sets,
                            reps: ex.reps,
                            order: ex.order ?? index,
                            weightTargetKg: ex.weightTargetKg ?? null,
                            setTargets: ex.setTargets,
                        }))) as PlanExercise[]
                ),
            };
        }

        if (planWeekCount > 1 && isDateAfterPlanEnd(planStartedAt, planWeekCount, key)) {
            return workoutFromLog();
        }

        return workoutFromLog() ?? workoutFromHistorical();
    }, [serializedPlanWeeks, scheduleRevisions, planStartedAt, todayDate, historicalMissedByDate, logMap, planWeekCount, sessionOverrides]);

    /* ─── Calendar Generation (Europe/Dublin date keys) ─── */
    const monthPrefix = `${view.year}-${String(view.month + 1).padStart(2, "0")}`;
    const monthStartKey = `${monthPrefix}-01`;
    const startDow = (weekdayFromDateKey(monthStartKey) + 6) % 7;
    const gridStartKey = shiftAppDateKey(monthStartKey, -startDow);
    const nextMonthKey = view.month === 11
        ? `${view.year + 1}-01-01`
        : `${view.year}-${String(view.month + 2).padStart(2, "0")}-01`;
    const monthEndKey = shiftAppDateKey(nextMonthKey, -1);
    const endDow = (weekdayFromDateKey(monthEndKey) + 6) % 7;
    const gridEndKey = shiftAppDateKey(monthEndKey, 6 - endDow);

    const cells: CalendarCell[] = [];
    for (let key = gridStartKey; key <= gridEndKey; key = shiftAppDateKey(key, 1)) {
        cells.push({
            dateKey: key,
            day: Number(key.slice(8, 10)),
            inCurrentMonth: key.startsWith(monthPrefix),
        });
    }

    /* ─── Selected Day Helpers ─── */
    const selectedDate = useMemo(() => {
        const [y, m, d] = selectedDateKey.split("-").map(Number);
        return new Date(y, m - 1, d);
    }, [selectedDateKey]);
    const selectedLogs = logMap[selectedDateKey] ?? [];
    const selectedPlanned = resolvePlannedWorkoutForDate(selectedDate, selectedDateKey);
    const selectedMatchingLog = matchingCompletedLog(selectedLogs, selectedPlanned);
    // An active session must stay resumable even when the day is scheduled as rest or
    // the plan has since moved a different workout onto this date.
    const resumeSession = useMemo(() => {
        const sessions = inProgressByDate[selectedDateKey] ?? [];
        if (sessions.length === 0) return null;
        if (selectedPlanned) {
            const matching = sessions.find((s) => s.workoutId === selectedPlanned.id);
            if (matching) return matching;
        }
        return sessions[0];
    }, [inProgressByDate, selectedDateKey, selectedPlanned]);
    const workoutLogHref = selectedPlanned
        ? `/plans/log/${selectedPlanned.id}?date=${selectedDateKey}${coachView ? `&clientId=${coachView.clientId}` : ""}`
        : "";
    const workoutPreviewHref = selectedPlanned
        ? `/plans/log/${selectedPlanned.id}?date=${encodeURIComponent(selectedDateKey)}${coachView ? `&clientId=${coachView.clientId}&mode=review` : "&mode=preview"}`
        : "";
    const workoutStartHref = selectedPlanned && !coachView
        ? `/plans/log/${selectedPlanned.id}?date=${encodeURIComponent(selectedDateKey)}&autostart=1`
        : "";
    const coachLiveHref = selectedPlanned && coachView
        ? `/plans/log/${selectedPlanned.id}?date=${selectedDateKey}&clientId=${coachView.clientId}&mode=live`
        : "";
    const editSessionHref = selectedPlanned
        ? coachView
            ? `/coach/calendar/session?clientId=${encodeURIComponent(coachView.clientId)}&date=${encodeURIComponent(selectedDateKey)}&workoutId=${encodeURIComponent(selectedPlanned.id)}`
            : `/calendar/session?date=${encodeURIComponent(selectedDateKey)}&workoutId=${encodeURIComponent(selectedPlanned.id)}`
        : "";
    const coachEditPlanHref = planId && coachView
        ? `/plans/create?id=${planId}&clientId=${coachView.clientId}`
        : "";
    const selectedIsExcused = Boolean(
        selectedPlanned
        && selectedDateKey < todayKey
        && !selectedMatchingLog
        && isWorkoutExcused(selectedDateKey, selectedPlanned.id)
    );
    const selectedIsAfterPlan = Boolean(
        planStartedAt
        && planWeekCount > 1
        && isDateAfterPlanEnd(planStartedAt, planWeekCount, selectedDateKey)
    );

    const selectedStatus: DayWorkoutStatus = useMemo(() => {
        const primaryLog = selectedMatchingLog;
        const isPast = selectedDateKey < todayKey;
        const isTodayDay = selectedDateKey === todayKey;
        const isExcused = Boolean(
            selectedPlanned
            && isPast
            && !primaryLog
            && isWorkoutExcused(selectedDateKey, selectedPlanned.id)
        );
        return resolveDayStatus({
            log: primaryLog,
            dayInProgress: resumeSession,
            planned: selectedPlanned,
            isPast,
            isTodayDay,
            isExcused,
        });
    }, [
        selectedMatchingLog,
        selectedDateKey,
        todayKey,
        selectedPlanned,
        resumeSession,
        isWorkoutExcused,
    ]);

    const selectedStatusStyle = STATUS_CONFIG[selectedStatus];
    /** Edit Session is for scheduled targets only — never for live logs or excused days. */
    const canEditSession =
        Boolean(editSessionHref) &&
        selectedStatus !== "in-progress" &&
        selectedStatus !== "completed" &&
        selectedStatus !== "excused" &&
        !resumeSession;

    const updateWorkoutStatus = useCallback(async (status: "excused" | "missed") => {
        if (!coachView || !selectedPlanned || statusUpdating) return;

        setStatusUpdating(true);
        const key = `${selectedDateKey}:${selectedPlanned.id}`;

        try {
            const res = await fetch("/api/coach/workout-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId: coachView.clientId,
                    dateKey: selectedDateKey,
                    workoutId: selectedPlanned.id,
                    status,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error ?? "Failed to update workout status");
            }

            setLocalExcusedKeys((prev) => {
                if (status === "excused") {
                    return prev.includes(key) ? prev : [...prev, key];
                }
                return prev.filter((item) => item !== key);
            });
            router.refresh();
        } catch (err) {
            console.error("[CalendarClient] workout status update failed", err);
            alert(err instanceof Error ? err.message : "Could not update workout status");
        } finally {
            setStatusUpdating(false);
        }
    }, [coachView, selectedPlanned, selectedDateKey, statusUpdating, router]);

    const formatTargetWeight = (weightKg?: number | null) => {
        if (weightKg == null || weightKg <= 0) return null;
        const rounded = Number.isInteger(weightKg) ? weightKg : Math.round(weightKg * 10) / 10;
        return `${rounded}kg`;
    };

    const complianceInput = useMemo<CalendarComplianceInput>(
        () => ({
            activePlan,
            planStartedAt,
            loggedDates,
            scheduleRevisions,
            excusedMissedWorkoutKeys: localExcusedKeys,
            historicalMissedSessions,
        }),
        [
            activePlan,
            planStartedAt,
            loggedDates,
            scheduleRevisions,
            localExcusedKeys,
            historicalMissedSessions,
        ]
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
            {/* ── Main Grid ── */}
            <div className="lg:col-span-8 space-y-6">
                <div className="flex min-w-0 flex-col gap-3 px-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                        {!isCoachView && (
                            <p className="text-[10px] font-black tracking-[0.2em] text-brand-400 uppercase">Interactive Calendar</p>
                        )}
                        <h2 className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 text-2xl font-black text-fg sm:text-3xl">
                            {MONTHS[view.month]}
                            <span className="text-brand-400/30 font-light">{view.year}</span>
                        </h2>
                        {activePlan && planStartedAt && (
                            planScheduleMode === "repeat" ? (
                                !isCoachView ? (
                                    <p className="text-[10px] font-bold text-fg-muted uppercase tracking-widest">
                                        Repeating weekly · same schedule every week
                                    </p>
                                ) : null
                            ) : (
                                <p className="text-[10px] font-bold text-fg-muted uppercase tracking-widest">
                                    {planWeekCount}-week program
                                    {currentProgramWeek && !isPlanComplete && (
                                        <> · Week {currentProgramWeek} of {planWeekCount}</>
                                    )}
                                    {planEndDateKey && (
                                        <>
                                            {" · "}
                                            {isPlanComplete
                                                ? "Program complete"
                                                : `Ends ${formatDate(planEndDateKey)}`}
                                        </>
                                    )}
                                </p>
                            )
                        )}
                    </div>
                    <div className="grid grid-cols-[2rem_minmax(4.5rem,1fr)_2rem] items-center gap-1.5 rounded-2xl border border-surface-border bg-surface-muted/50 p-1.5 sm:flex sm:shrink-0">
                        <button 
                            onClick={() => setView(v => { const d = new Date(v.year, v.month-1); return { year: d.getFullYear(), month: d.getMonth() }; })} 
                            className="w-8 h-8 rounded-xl bg-surface hover:bg-surface-elevated flex items-center justify-center transition-all border border-surface-border text-fg-muted active:scale-90"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => {
                                const [y, m] = todayKey.split("-").map(Number);
                                setView({ year: y, month: m - 1 });
                                setSelectedDateKey(todayKey);
                            }}
                            className="h-8 rounded-xl border border-surface-border bg-surface px-4 text-[10px] font-black uppercase tracking-widest text-fg transition-all hover:bg-brand-950/30 hover:text-brand-400 active:scale-95"
                        >
                            Today
                        </button>
                        <button 
                            onClick={() => setView(v => { const d = new Date(v.year, v.month+1); return { year: d.getFullYear(), month: d.getMonth() }; })} 
                            className="w-8 h-8 rounded-xl bg-surface hover:bg-surface-elevated flex items-center justify-center transition-all border border-surface-border text-fg-muted active:scale-90"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <CalendarComplianceSummary
                    complianceInput={complianceInput}
                    calendarView={view}
                    now={now}
                />

                <div className="card overflow-hidden shadow-glow-sm border-brand-500/10">
                    <div className="grid grid-cols-7 bg-surface-muted/20 border-b border-surface-border">
                        {DAYS.map(d => (
                            <div key={d} className="py-2 sm:py-3 text-center text-[10px] font-black uppercase tracking-widest text-fg-subtle border-r border-surface-border/50 last:border-r-0">
                                {d}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 bg-surface-card/30 backdrop-blur-md">
                        {cells.map((cell) => {
                            const { dateKey, day, inCurrentMonth } = cell;
                            const dateObj = parseLogDate(dateKey);
                            const dayLogs = logMap[dateKey] ?? [];
                            const planned = resolvePlannedWorkoutForDate(dateObj, dateKey);
                            const log = matchingCompletedLog(dayLogs, planned);
                            const dayInProgress = log
                                ? null
                                : matchingActiveSession(inProgressByDate[dateKey] ?? [], planned);
                            const isPast = dateKey < todayKey;
                            const isTodayDay = dateKey === todayKey;
                            const selected = dateKey === selectedDateKey;
                            const isAfterPlan = Boolean(
                                planStartedAt
                                && planWeekCount > 1
                                && isDateAfterPlanEnd(planStartedAt, planWeekCount, dateKey)
                            );
                            const isBeforePlan = Boolean(
                                planStartedAt && isDateBeforePlanStart(planStartedAt, dateKey)
                            );
                            const programWeek = planned ? getProgramWeekForDateKey(dateKey) : null;
                            const isExcused = Boolean(
                                planned && isPast && !log && isWorkoutExcused(dateKey, planned.id)
                            );
                            const status = resolveDayStatus({
                                log,
                                dayInProgress,
                                planned,
                                isPast,
                                isTodayDay,
                                isExcused,
                            });
                            const statusStyle = STATUS_CONFIG[status];
                            const workoutLabel = log
                                ? displayWorkoutName(log.workoutName)
                                : dayInProgress
                                    ? displayWorkoutName(dayInProgress.workoutName)
                                    : planned
                                        ? displayWorkoutName(planned.name)
                                        : null;

                            return (
                                <button 
                                    key={dateKey} 
                                    onClick={() => {
                                        setSelectedDateKey(dateKey);
                                        if (window.innerWidth < 1024) {
                                            setMobileDetailOpen(true);
                                        }
                                    }}
                                    className={cn(
                                        "min-h-[76px] sm:min-h-[120px] lg:min-h-[130px] p-1 sm:p-1.5 lg:p-2 border-b border-r border-surface-border/50 last:border-r-0 transition-all group flex flex-col items-start gap-0.5 sm:gap-1 relative overflow-hidden",
                                        "cursor-pointer hover:bg-surface-muted/20",
                                        !inCurrentMonth && "bg-surface-muted/10 opacity-55 hover:opacity-80",
                                        selected && "bg-brand-950/20",
                                        isAfterPlan && "bg-surface-muted/15 opacity-60",
                                        isBeforePlan && "opacity-70"
                                    )}
                                >
                                    <div className="w-full flex justify-between items-start">
                                        <span className={cn(
                                            "text-[11px] sm:text-sm font-black flex items-center justify-center w-5 h-5 sm:w-7 sm:h-7 rounded-lg transition-all",
                                            isTodayDay ? "bg-brand-400 text-white shadow-glow-brand" : (selected ? "bg-fg text-surface" : "text-fg-subtle group-hover:text-fg"),
                                            !inCurrentMonth && !isTodayDay && !selected && "text-fg-subtle/60"
                                        )}>
                                            {day}
                                        </span>
                                        {status !== "rest" && (
                                            <div className={cn("w-1.5 h-1.5 rounded-full mt-1 mr-0.5 shrink-0", statusStyle.dot)} />
                                        )}
                                    </div>

                                    <div className="w-full space-y-1 mt-auto min-w-0">
                                        {workoutLabel ? (
                                            <div className="space-y-1">
                                                {programWeek && status !== "completed" && (
                                                    <span className="hidden sm:block text-[8px] font-black uppercase tracking-widest text-fg-subtle/80">
                                                        Week {programWeek}
                                                    </span>
                                                )}
                                                <div className={cn("h-1 rounded-full overflow-hidden", statusStyle.barBg)}>
                                                    <div className={cn("h-full", statusStyle.barFill, status === "in-progress" ? "w-2/3" : "w-full")} />
                                                </div>
                                                <span className={cn(
                                                    "text-[8px] sm:text-[9px] font-black uppercase tracking-tighter truncate block leading-tight",
                                                    statusStyle.text
                                                )}>
                                                    {workoutLabel}
                                                    {dayLogs && dayLogs.length > 1 ? ` +${dayLogs.length - 1}` : ""}
                                                </span>
                                            </div>
                                        ) : null}
                                    </div>

                                    {selected && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-400 shadow-glow-brand" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Day details ── */}
            <div
                ref={detailPanelRef}
                className={cn(
                    "lg:col-span-4 space-y-6 lg:sticky lg:top-10 lg:h-fit scroll-mt-4",
                    mobileDetailOpen ? "block" : "hidden lg:block"
                )}
            >
                <div className={cn(
                    "card p-6 border-brand-500/20 bg-gradient-to-br from-surface-card to-brand-950/10 shadow-glow-sm min-h-[320px] lg:min-h-[400px]",
                    selectedStatus === "missed"
                        && !selectedIsExcused
                        && "border-danger/40 ring-2 ring-danger/30 streak-fire-glow"
                )}>
                    <div className="flex items-start justify-between mb-6 gap-3">
                        <div className="min-w-0">
                            <p className="text-[10px] font-black text-fg-muted uppercase tracking-widest mb-1">
                                {selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                            </p>
                            <span className={cn(
                                "inline-flex text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border",
                                selectedStatusStyle.badge
                            )}>
                                {selectedStatusStyle.label}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setMobileDetailOpen(false)}
                            className="lg:hidden w-8 h-8 rounded-lg border border-surface-border flex items-center justify-center text-fg-muted shrink-0"
                            aria-label="Close day details"
                        >
                            <ChevronUp className="w-4 h-4 rotate-180" />
                        </button>
                    </div>

                    <div className="space-y-6 animate-slide-up">
                        {selectedLogs.length > 0 ? (
                            <div className="space-y-6">
                                {selectedLogs.map((sessionLog) => {
                                    const exerciseGroups = groupLogSetsByExercise(sessionLog.sets);
                                    const totalSets = sessionLog.sets.length;
                                    const previewExercises = exerciseGroups.slice(0, 4);
                                    const moreExercises = exerciseGroups.length - previewExercises.length;

                                    return (
                                        <div key={sessionLog.id} className="space-y-5">
                                            <div className={cn("p-4 rounded-2xl border", selectedStatusStyle.panelBg, selectedStatusStyle.panelBorder)}>
                                                <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", selectedStatusStyle.panelLabel)}>
                                                    {displayWorkoutName(sessionLog.workoutName)}
                                                </p>
                                                <div className="flex flex-wrap gap-4 mt-3">
                                                    <div>
                                                        <p className="text-[9px] font-black text-fg-subtle uppercase">Total sets</p>
                                                        <p className="text-sm font-black text-fg">{totalSets}</p>
                                                    </div>
                                                    {sessionLog.duration != null && (
                                                        <div>
                                                            <p className="text-[9px] font-black text-fg-subtle uppercase">Duration</p>
                                                            <p className="text-sm font-black text-fg flex items-center gap-1">
                                                                <Clock className="w-3.5 h-3.5 text-success" />
                                                                {sessionLog.duration} min
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <p className="text-[10px] font-black text-fg-subtle uppercase px-1 tracking-[0.2em] flex items-center gap-2">
                                                    <Zap className="w-3 h-3 text-brand-400" /> Exercises
                                                </p>
                                                <div className="space-y-1.5">
                                                    {previewExercises.map((exerciseGroup) => (
                                                        <div
                                                            key={exerciseGroup.exerciseId}
                                                            className="flex items-center justify-between py-2 px-3 bg-surface-muted/15 rounded-xl border border-surface-border/40"
                                                        >
                                                            <span className="text-xs font-bold text-fg truncate">{exerciseGroup.name}</span>
                                                            <span className="text-[10px] font-black text-fg-subtle shrink-0 ml-2">
                                                                {exerciseGroup.sets.length} sets
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {moreExercises > 0 && (
                                                        <p className="text-[10px] font-bold text-fg-muted px-1">
                                                            +{moreExercises} more in session review
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <ReturnLink
                                                href={`/plans/log/view/${sessionLog.id}`}
                                                className="btn-primary w-full h-11 text-[10px] font-black uppercase tracking-[.2em] group flex items-center justify-center gap-2 shadow-glow-brand"
                                            >
                                                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                                Review Session
                                            </ReturnLink>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : selectedPlanned && isScheduledTrainingWorkout(selectedPlanned) ? (
                            <div className="space-y-5">
                                <div className={cn("p-4 rounded-2xl border", selectedStatusStyle.panelBg, selectedStatusStyle.panelBorder)}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-lg font-black text-fg tracking-tight truncate">
                                                {displayWorkoutName(selectedPlanned.name)}
                                            </p>
                                            {selectedIsExcused && (
                                                <p className="text-[10px] font-bold text-emerald-700 mt-1">
                                                    Excused by your coach — not counted as missed.
                                                </p>
                                            )}
                                        </div>
                                        <Layout className={cn("w-5 h-5 shrink-0 opacity-50", selectedStatusStyle.panelLabel)} />
                                    </div>
                                </div>

                                {sortPlannedExercises(selectedPlanned.exercises).length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-fg-subtle uppercase px-1 tracking-[0.2em] flex items-center gap-2">
                                            <Hash className="w-3 h-3 text-brand-400" /> Exercises
                                        </p>
                                        <div className="space-y-1.5">
                                            {sortPlannedExercises(selectedPlanned.exercises).slice(0, 4).map((ex) => {
                                                const setTargets = ex.setTargets ?? [];
                                                const varied =
                                                    setTargets.length > 1
                                                    && setTargets.some(
                                                        (t) =>
                                                            t.weightKg !== setTargets[0]?.weightKg
                                                            || t.reps !== setTargets[0]?.reps
                                                    );
                                                const targetWeight = formatTargetWeight(ex.weightTargetKg);
                                                const detail = varied
                                                    ? setTargets
                                                          .map((t) => {
                                                              const w =
                                                                  t.weightKg != null && t.weightKg > 0
                                                                      ? `${t.weightKg}`
                                                                      : "";
                                                              const r =
                                                                  t.reps != null && t.reps > 0
                                                                      ? String(t.reps)
                                                                      : "—";
                                                              return w ? `${w}×${r}` : `×${r}`;
                                                          })
                                                          .join(" · ")
                                                    : `${ex.sets}×${ex.reps}${targetWeight ? ` @ ${targetWeight}` : ""}`;
                                                return (
                                                    <div
                                                        key={ex.id}
                                                        className="flex items-center justify-between py-2 px-3 bg-surface-muted/10 rounded-xl border border-surface-border/40 gap-2"
                                                    >
                                                        <span className="text-xs font-bold text-fg truncate">{ex.name}</span>
                                                        <span className="text-[10px] font-black text-brand-400 shrink-0 text-right">
                                                            {detail}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                            {selectedPlanned.exercises.length > 4 && (
                                                <p className="text-[10px] font-bold text-fg-muted px-1">
                                                    +{selectedPlanned.exercises.length - 4} more exercises
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {isCoachView && coachView && selectedDateKey < todayKey && selectedLogs.length === 0 && !resumeSession && (
                                    <div className="flex gap-2">
                                        {selectedIsExcused ? (
                                            <button
                                                type="button"
                                                disabled={statusUpdating}
                                                onClick={() => void updateWorkoutStatus("missed")}
                                                className="btn-secondary flex-1 h-11 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                                            >
                                                {statusUpdating ? "Saving…" : "Mark missed"}
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled={statusUpdating}
                                                onClick={() => void updateWorkoutStatus("excused")}
                                                className="btn-secondary flex-1 h-11 text-[10px] font-black uppercase tracking-widest border-emerald-700/30 text-emerald-700 hover:bg-emerald-900/20 disabled:opacity-50"
                                            >
                                                {statusUpdating ? "Saving…" : "Mark excused"}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {isCoachView && coachView ? (
                                    <div className="space-y-2">
                                        {resumeSession || selectedStatus === "in-progress" ? (
                                            <ReturnLink
                                                href={coachLiveHref || workoutLogHref}
                                                className="btn-primary w-full h-12 text-xs font-black uppercase tracking-[0.15em] shadow-glow-success bg-success border-success hover:bg-success-600 group hover:scale-[1.02] transition-all flex items-center justify-center"
                                            >
                                                <Flame className="w-4 h-4 mr-2 animate-pulse group-hover:scale-110 transition-transform" />
                                                View Live Workout
                                            </ReturnLink>
                                        ) : (
                                            <ReturnLink
                                                href={workoutPreviewHref || workoutLogHref}
                                                className="btn-primary w-full h-12 text-xs font-black uppercase tracking-[0.15em] shadow-glow-brand group hover:scale-[1.02] transition-all flex items-center justify-center"
                                            >
                                                <History className="w-4 h-4 mr-2" />
                                                View Workout
                                            </ReturnLink>
                                        )}

                                        {canEditSession && (
                                            <Link
                                                href={editSessionHref}
                                                className="btn-secondary w-full h-12 text-xs font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2"
                                            >
                                                <PencilLine className="w-4 h-4" />
                                                Edit Session
                                            </Link>
                                        )}

                                        {coachEditPlanHref && (
                                            <Link
                                                href={coachEditPlanHref}
                                                className="btn-ghost w-full h-11 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 text-fg-muted"
                                            >
                                                Edit Plan
                                            </Link>
                                        )}
                                    </div>
                                ) : selectedStatus === "in-progress" ? (
                                    <ReturnLink
                                        href={workoutLogHref}
                                        className="btn-primary w-full h-12 text-xs font-black uppercase tracking-[0.15em] shadow-glow-success bg-success border-success hover:bg-success-600 group hover:scale-[1.02] transition-all flex items-center justify-center"
                                    >
                                        <Flame className="w-4 h-4 mr-2 animate-pulse group-hover:scale-110 transition-transform" />
                                        Resume Workout
                                    </ReturnLink>
                                ) : selectedStatus === "missed" ? (
                                    <div className="space-y-2">
                                        <ReturnLink
                                            href={workoutPreviewHref || workoutLogHref}
                                            className="btn-secondary w-full h-12 text-xs font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2"
                                        >
                                            <History className="w-4 h-4" />
                                            View Workout
                                        </ReturnLink>
                                        {canEditSession && (
                                            <Link
                                                href={editSessionHref}
                                                className="btn-secondary w-full h-12 text-xs font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2"
                                            >
                                                <PencilLine className="w-4 h-4" />
                                                Edit Session
                                            </Link>
                                        )}
                                        <ReturnLink
                                            href={workoutStartHref || workoutLogHref}
                                            className="btn-primary w-full h-12 text-xs font-black uppercase tracking-[0.15em] shadow-glow-brand group hover:scale-[1.02] transition-all flex items-center justify-center"
                                        >
                                            <PlayCircle className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" />
                                            Start Workout
                                        </ReturnLink>
                                        {coachId && (
                                            <Link
                                                href={`/chat?with=${coachId}`}
                                                className="btn-secondary w-full h-12 text-xs font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2"
                                            >
                                                <MessageSquare className="w-4 h-4" />
                                                Message Coach
                                            </Link>
                                        )}
                                    </div>
                                ) : selectedStatus === "excused" ? (
                                    <ReturnLink
                                        href={workoutPreviewHref || workoutLogHref}
                                        className="btn-secondary w-full h-12 text-xs font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2"
                                    >
                                        <History className="w-4 h-4" />
                                        View Workout
                                    </ReturnLink>
                                ) : (
                                    <div className="space-y-2">
                                        <ReturnLink
                                            href={workoutPreviewHref || workoutLogHref}
                                            className="btn-secondary w-full h-12 text-xs font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2"
                                        >
                                            <History className="w-4 h-4" />
                                            View Workout
                                        </ReturnLink>
                                        {canEditSession && (
                                            <Link
                                                href={editSessionHref}
                                                className="btn-secondary w-full h-12 text-xs font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2"
                                            >
                                                <PencilLine className="w-4 h-4" />
                                                Edit Session
                                            </Link>
                                        )}
                                        <ReturnLink
                                            href={workoutStartHref || workoutLogHref}
                                            className="btn-primary w-full h-12 text-xs font-black uppercase tracking-[0.15em] shadow-glow-brand group hover:scale-[1.02] transition-all flex items-center justify-center"
                                        >
                                            <PlayCircle className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" />
                                            Start Workout
                                        </ReturnLink>
                                    </div>
                                )}
                            </div>
                        ) : selectedIsAfterPlan ? (
                            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 bg-surface-muted/10 rounded-3xl border border-dashed border-surface-border/60">
                                <div className="w-16 h-16 rounded-full bg-surface-muted/30 flex items-center justify-center border border-surface-border">
                                    <Info className="w-8 h-8 text-fg-subtle opacity-30" />
                                </div>
                                <div className="max-w-[220px]">
                                    <p className="text-xs font-black text-fg uppercase tracking-widest mb-1 opacity-80">Program Complete</p>
                                    <p className="text-[10px] text-fg-subtle font-bold leading-relaxed">
                                        This {planWeekCount}-week plan finished{planEndDateKey ? ` on ${formatDate(planEndDateKey)}` : ""}. No further sessions are scheduled.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 bg-surface-muted/10 rounded-3xl border border-dashed border-surface-border/60">
                                <div className="w-16 h-16 rounded-full bg-surface-muted/30 flex items-center justify-center border border-surface-border transition-transform active:scale-95 cursor-default">
                                    <Info className="w-8 h-8 text-fg-subtle opacity-30" />
                                </div>
                                <div className="max-w-[200px]">
                                    <p className="text-xs font-black text-fg uppercase tracking-widest mb-1 opacity-80">Rest day</p>
                                    <p className="text-[10px] text-fg-subtle font-bold leading-relaxed">No training scheduled. Focus on recovery and nutrition.</p>
                                </div>
                                <Link
                                    href={isCoachView && coachView ? `/coach/client/${coachView.clientId}` : "/plans"}
                                    className="text-[10px] font-black text-brand-400 uppercase tracking-widest hover:underline pt-4"
                                >
                                    {isCoachView && coachView ? "View Client Profile" : activePlan ? "View Full Plan" : "Choose a Plan"}
                                </Link>
                                {isCoachView && coachView && planId && (
                                    <Link
                                        href={`/plans/create?id=${planId}&clientId=${coachView.clientId}`}
                                        className="text-[10px] font-black text-fg-muted uppercase tracking-widest hover:text-brand-400 transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        <PencilLine className="w-3 h-3" />
                                        Edit Plan
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Legend */}
                <div className="card p-4 flex flex-wrap gap-x-4 gap-y-2 justify-center bg-surface-muted/20 border-surface-border/40">
                    {(["completed", "in-progress", "missed", "excused"] as DayWorkoutStatus[]).map((status) => (
                        <div key={status} className="flex items-center gap-1.5">
                            <div className={cn("w-1.5 h-1.5 rounded-full", STATUS_CONFIG[status].dot.split(" ")[0])} />
                            <span className="text-[8px] font-black uppercase tracking-tighter text-fg-subtle">
                                {STATUS_CONFIG[status].label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
