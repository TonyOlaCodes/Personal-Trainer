"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
    ChevronLeft, ChevronRight,
    Info, Clock,
    Layout, History,
    PlayCircle,
    Zap, Hash, Flame,
    User, PencilLine,
} from "lucide-react";
import Link from "next/link";
import { ReturnLink } from "@/components/shared/ReturnLink";
import { cn, toDateKey, parseLogDate } from "@/lib/utils";
import { useCurrentDate } from "@/hooks/useCurrentDate";

/* ─────────────────────────── Types ─────────────────────────── */
interface PlanExercise { name: string; sets: number; reps: string; }
interface PlanWorkout { dayNumber: number; dayOfWeek?: number | null; name: string; id: string; exercises: PlanExercise[]; }
interface PlanWeek { weekNumber: number; workouts: PlanWorkout[]; }
interface ActivePlan { id?: string; name: string; weeks: PlanWeek[]; }

interface LogSet {
    exerciseName: string;
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
    coachView?: {
        clientId: string;
        clientName: string;
        planId: string | null;
    };
    view?: CalendarView;
    onViewChange?: (view: CalendarView) => void;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

export function CalendarClient({
    activePlan,
    planStartedAt,
    loggedDates,
    inProgressSessions,
    coachView,
    view: controlledView,
    onViewChange,
}: Props) {
    const isCoachView = Boolean(coachView);
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
    const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);

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

    const getPlannedWorkoutForDate = (date: Date): PlanWorkout | null => {
        if (!activePlan || !planStartedAt) return null;
        if (activePlan.weeks.length === 0) return null;
        const start = new Date(planStartedAt);
        start.setHours(0, 0, 0, 0);
        
        // Use relative days from start date
        const diffDaysTotal = Math.floor((date.getTime() - start.getTime()) / 86400000);
        if (diffDaysTotal < 0) return null;

        const weekIdx = Math.floor(diffDaysTotal / 7) % activePlan.weeks.length;
        const jsDow = date.getDay();
        const monBasedDow = jsDow === 0 ? 6 : jsDow - 1;
        const fallbackDayNumber = monBasedDow + 1;

        const week = activePlan.weeks[weekIdx];
        if (!week) return null;

        const usesOneIndexedWeekdays = week.workouts.length >= 5
            && week.workouts.every(w => w.dayOfWeek !== null && w.dayOfWeek !== undefined && w.dayOfWeek === w.dayNumber);
        const targetDayOfWeek = usesOneIndexedWeekdays
            ? (monBasedDow === 6 ? 0 : monBasedDow + 1)
            : monBasedDow;
        
        const workout = week.workouts.find(w => w.dayOfWeek === targetDayOfWeek)
                    || week.workouts.find(w => (w.dayOfWeek === null || w.dayOfWeek === undefined) && w.dayNumber === fallbackDayNumber);
        
        return workout ?? null;
    };

    /* ─── Calendar Generation ─── */
    const firstDay = new Date(view.year, view.month, 1);
    const lastDay = new Date(view.year, view.month + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7; 
    const daysInMonth = lastDay.getDate();

    const cells: (number | null)[] = [
        ...Array(startDow).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    /* ─── Selected Day Helpers ─── */
    const selectedDate = useMemo(() => {
        const [y, m, d] = selectedDateKey.split("-").map(Number);
        return new Date(y, m - 1, d);
    }, [selectedDateKey]);
    const selectedLogs = logMap[selectedDateKey] ?? [];
    const selectedPlanned = getPlannedWorkoutForDate(selectedDate);
    const resumeSession = selectedPlanned
        ? inProgressByDate[selectedDateKey]?.find((s) => s.workoutId === selectedPlanned.id) ?? null
        : null;
    const workoutLogHref = selectedPlanned
        ? `/plans/log/${selectedPlanned.id}?date=${selectedDateKey}`
        : "";
    
    const calculateVolume = (sets: LogSet[]) => {
        return Math.round(sets.reduce((acc, s) => acc + ((s.reps || 0) * (s.weightKg || 1)), 0)); // weight 1 if bodyweight
    };

    const getPreviousPerformance = (exerciseName: string, beforeDate: Date) => {
        const beforeKey = toDateKey(beforeDate);
        const prevLogs = loggedDates.filter((l) => l.date < beforeKey);
        for (const log of prevLogs) {
            const exSets = log.sets.filter(s => s.exerciseName.toLowerCase() === exerciseName.toLowerCase());
            if (exSets.length > 0) {
                const working = exSets.filter((s) => (s.weightKg || 0) > 0 && (s.reps || 0) > 0);
                if (working.length === 0) continue;
                const maxWeight = Math.max(...working.map((s) => s.weightKg || 0));
                const atMaxWeight = working.filter((s) => s.weightKg === maxWeight);
                const bestSet = atMaxWeight.reduce((best, s) =>
                    (s.reps || 0) > (best.reps || 0) ? s : best, atMaxWeight[0]);
                return {
                    weight: maxWeight,
                    reps: bestSet.reps,
                    date: log.date
                };
            }
        }
        return null;
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
            {/* ── Main Grid ── */}
            <div className="lg:col-span-8 space-y-6">
                <div className="flex items-center justify-between px-2">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black tracking-[0.2em] text-brand-400 uppercase">Interactive Calendar</p>
                        <h2 className="text-3xl font-black text-fg flex items-center gap-4">
                            {MONTHS[view.month]}
                            <span className="text-brand-400/30 font-light">{view.year}</span>
                        </h2>
                    </div>
                    <div className="flex items-center gap-1.5 bg-surface-muted/50 p-1.5 rounded-2xl border border-surface-border">
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
                            }}
                            className="px-4 h-8 rounded-xl bg-surface hover:bg-brand-950/30 hover:text-brand-400 text-[10px] font-black uppercase tracking-widest transition-all border border-surface-border text-fg active:scale-95"
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

                <div className="card overflow-hidden shadow-glow-sm border-brand-500/10">
                    <div className="grid grid-cols-7 bg-surface-muted/20 border-b border-surface-border">
                        {DAYS.map(d => (
                            <div key={d} className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-fg-subtle border-r border-surface-border/50 last:border-r-0">
                                {d}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 bg-surface-card/30 backdrop-blur-md">
                        {cells.map((day, idx) => {
                            const dateKey = day
                                ? `${view.year}-${String(view.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                                : "";
                            const dateObj = day ? parseLogDate(dateKey) : null;
                            const dayLogs = day ? logMap[dateKey] : null;
                            const log = dayLogs?.[0] ?? null;
                            const dayInProgress = !dayLogs?.length ? inProgressByDate[dateKey]?.[0] ?? null : null;
                            const planned = dateObj ? getPlannedWorkoutForDate(dateObj) : null;
                            const isPast = dateKey !== "" && dateKey < todayKey;
                            const isTodayDay = dateKey === todayKey;
                            const selected = dateKey === selectedDateKey;

                            // Status logic
                            let status: 'completed' | 'in-progress' | 'missed' | 'scheduled' | 'rest' = 'rest';
                            if (dayLogs && dayLogs.length > 0) status = 'completed';
                            else if (dayInProgress) status = 'in-progress';
                            else if (planned) {
                                if (isPast) status = 'missed';
                                else status = 'scheduled';
                            }

                            return (
                                <button 
                                    key={idx} 
                                    disabled={!day}
                                    onClick={() => dateObj && setSelectedDateKey(dateKey)}
                                    className={cn(
                                        "min-h-[110px] sm:min-h-[130px] p-2 border-b border-r border-surface-border/50 last:border-r-0 transition-all group flex flex-col items-start gap-1 relative overflow-hidden",
                                        !day && "bg-surface-muted/5",
                                        day && "cursor-pointer hover:bg-surface-muted/20",
                                        selected && "bg-brand-950/20"
                                    )}
                                >
                                    {day && (
                                        <>
                                            <div className="w-full flex justify-between items-start mb-1">
                                                <span className={cn(
                                                    "text-sm font-black flex items-center justify-center w-7 h-7 rounded-lg transition-all",
                                                    isTodayDay ? "bg-brand-400 text-white shadow-glow-brand" : (selected ? "bg-fg text-surface" : "text-fg-subtle group-hover:text-fg")
                                                )}>
                                                    {day}
                                                </span>
                                                
                                                {/* Status Dot */}
                                                <div className={cn(
                                                    "w-1.5 h-1.5 rounded-full mt-1.5 mr-1",
                                                    status === 'completed' ? "bg-success shadow-glow-success animate-pulse" :
                                                    status === 'in-progress' ? "bg-warning shadow-glow-warning animate-pulse" :
                                                    status === 'missed' ? "bg-danger shadow-glow-danger" :
                                                    status === 'scheduled' ? "bg-brand-400 shadow-glow-brand" :
                                                    "bg-surface-border"
                                                )} />
                                            </div>

                                            {/* Visual Cues */}
                                            <div className="w-full space-y-1.5 mt-auto">
                                                {log ? (
                                                    <div className="space-y-1">
                                                        <div className="h-1 rounded-full bg-success/20 overflow-hidden">
                                                            <div className="w-full h-full bg-success" />
                                                        </div>
                                                        <span className="text-[9px] font-black uppercase tracking-tighter text-success truncate block">
                                                            {log.workoutName.replace(/workout/gi, '').trim()}
                                                            {dayLogs && dayLogs.length > 1 ? ` +${dayLogs.length - 1}` : ""}
                                                        </span>
                                                    </div>
                                                ) : dayInProgress ? (
                                                    <div className="space-y-1">
                                                        <div className="h-1 rounded-full bg-warning/20 overflow-hidden">
                                                            <div className="w-2/3 h-full bg-warning animate-pulse" />
                                                        </div>
                                                        <span className="text-[9px] font-black uppercase tracking-tighter text-warning truncate block">
                                                            {dayInProgress.workoutName.replace(/workout/gi, '').trim()}
                                                        </span>
                                                    </div>
                                                ) : planned ? (
                                                    <div className="space-y-1">
                                                        <div className={cn(
                                                            "h-1 rounded-full overflow-hidden",
                                                            isPast ? "bg-danger/20" : "bg-brand-400/20"
                                                        )}>
                                                            <div className={cn("w-full h-full", isPast ? "bg-danger" : "bg-brand-400 animate-pulse")} />
                                                        </div>
                                                        <span className={cn(
                                                            "text-[9px] font-black uppercase tracking-tighter truncate block",
                                                            isPast ? "text-danger opacity-60" : "text-brand-400"
                                                        )}>
                                                            {planned.name.replace(/workout/gi, '').trim()}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="h-0.5 rounded-full bg-surface-border opacity-30 mt-auto" />
                                                )}
                                            </div>

                                            {selected && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-400 shadow-glow-brand" />}
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Sidebar Details ── */}
            <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-10 lg:h-fit">
                <div className="card p-6 border-brand-500/20 bg-gradient-to-br from-surface-card to-brand-950/10 shadow-glow-sm min-h-[400px]">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-surface-card flex items-center justify-center border border-surface-border shadow-inner">
                                <History className="w-5 h-5 text-brand-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-fg uppercase tracking-widest leading-none mb-1">
                                    {selectedDateKey === todayKey ? "Today" : "Review"}
                                </h3>
                                <p className="text-[10px] text-fg-muted font-bold opacity-60 uppercase tracking-tighter">
                                    {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <div className={cn(
                                "w-2.5 h-2.5 rounded-full",
                                selectedLogs.length > 0 ? "bg-success" :
                                resumeSession ? "bg-warning animate-pulse" :
                                (selectedPlanned ? (selectedDateKey < todayKey ? "bg-danger" : "bg-brand-400") : "bg-surface-border")
                            )} />
                        </div>
                    </div>

                    <div className="space-y-6 animate-slide-up">
                        {selectedLogs.length > 0 ? (
                            <div className="space-y-6">
                                {selectedLogs.map((sessionLog) => (
                            <div key={sessionLog.id} className="space-y-6">
                                {/* Header Info */}
                                <div className="p-4 rounded-2xl bg-success-950/20 border border-success-500/20 shadow-glow-success-sm">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-[10px] font-black text-success uppercase tracking-widest mb-1">Session Logged</p>
                                            <p className="text-lg font-black text-fg tracking-tight">{sessionLog.workoutName}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-fg-subtle uppercase">Volume</p>
                                            <p className="text-sm font-black text-fg">{calculateVolume(sessionLog.sets).toLocaleString()}kg</p>
                                        </div>
                                    </div>
                                    {sessionLog.duration && (
                                        <div className="mt-4 flex items-center gap-2 text-xs text-fg-muted font-bold">
                                            <Clock className="w-3.5 h-3.5 text-success" />
                                            {sessionLog.duration} minutes active
                                        </div>
                                    )}
                                </div>

                                {/* Exercise List */}
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black text-fg-subtle uppercase px-2 tracking-[0.2em] flex items-center gap-2">
                                        <Zap className="w-3 h-3 text-brand-400" /> PERFORMANCE
                                    </p>
                                    <div className="space-y-0.5">
                                        {Array.from(new Set(sessionLog.sets.map(s => s.exerciseName))).map((exName, idx) => {
                                            const exSets = sessionLog.sets.filter(s => s.exerciseName === exName);
                                            return (
                                                <div key={idx} className="p-4 bg-surface-muted/20 border border-surface-border/50 rounded-2xl mb-2 group transition-all hover:border-brand-500/30">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div>
                                                            <span className="text-xs font-black text-fg group-hover:text-brand-400 transition-colors uppercase italic tracking-tighter">{exName}</span>
                                                            {(() => {
                                                                const prev = getPreviousPerformance(exName, selectedDate);
                                                                if (!prev) return null;
                                                                return (
                                                                    <p className="text-[8px] font-black text-brand-400/60 uppercase tracking-widest mt-0.5">
                                                                        Prev: {prev.weight}kg x {prev.reps}
                                                                    </p>
                                                                );
                                                            })()}
                                                        </div>
                                                        <span className="text-[10px] font-black text-fg-subtle opacity-60">{exSets.length} sets</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {exSets.map((s, si) => (
                                                            <div key={si} className="text-[9px] font-black px-2 py-1 bg-surface-card border border-surface-border rounded-lg text-fg opacity-80">
                                                                {s.reps} <span className="text-fg-subtle opacity-50">x</span> {s.weightKg}kg
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <ReturnLink 
                                        href={`/plans/log/view/${sessionLog.id}`}
                                        className="btn-primary w-full h-11 text-[10px] font-black uppercase tracking-[.2em] group flex items-center justify-center gap-2 mt-2 shadow-glow-brand"
                                    >
                                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        Review Session
                                    </ReturnLink>
                                    {isCoachView && coachView && (
                                        <Link
                                            href={`/coach/client/${coachView.clientId}`}
                                            className="btn-secondary w-full h-11 text-[10px] font-black uppercase tracking-[.2em] flex items-center justify-center gap-2"
                                        >
                                            <User className="w-4 h-4" />
                                            View Client
                                        </Link>
                                    )}
                                </div>
                            </div>
                                ))}
                            </div>
                        ) : selectedPlanned ? (
                            <div className="space-y-6">
                                <div className={cn(
                                    "p-4 rounded-2xl border",
                                    resumeSession
                                        ? "bg-warning-950/20 border-warning-500/20 shadow-glow-warning-sm"
                                        : selectedDateKey < todayKey
                                            ? "bg-danger-950/20 border-danger-500/20"
                                            : "bg-brand-950/20 border-brand-500/20 shadow-glow-brand-sm"
                                )}>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className={cn(
                                                "text-[10px] font-black uppercase tracking-widest mb-1",
                                                resumeSession
                                                    ? "text-warning"
                                                    : selectedDateKey < todayKey
                                                        ? "text-danger"
                                                        : "text-brand-400"
                                            )}>
                                                {resumeSession
                                                    ? "Session In Progress"
                                                    : selectedDateKey < todayKey
                                                        ? "Missed Session"
                                                        : "Upcoming Session"}
                                            </p>
                                            <p className="text-lg font-black text-fg tracking-tight">{selectedPlanned.name}</p>
                                        </div>
                                        <Layout className={cn(
                                            "w-5 h-5",
                                            resumeSession
                                                ? "text-warning opacity-60"
                                                : selectedDateKey < todayKey
                                                    ? "text-danger opacity-40"
                                                    : "text-brand-400"
                                        )} />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <p className="text-[10px] font-black text-fg-subtle uppercase px-2 tracking-[0.2em] flex items-center gap-2">
                                        <Hash className="w-3 h-3 text-brand-400" /> TARGETS
                                    </p>
                                    <div className="space-y-3">
                                        {selectedPlanned.exercises.map((ex, i) => (
                                            <div key={i} className="flex items-center justify-between py-2.5 px-3 bg-surface-muted/10 rounded-xl border border-surface-border/40 hover:bg-brand-950/10 transition-colors group">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-fg leading-tight group-hover:text-brand-400 transition-colors lowercase italic">{ex.name}</span>
                                                    {(() => {
                                                        const prev = getPreviousPerformance(ex.name, selectedDate);
                                                        if (!prev) return null;
                                                        return (
                                                            <p className="text-[8px] font-black text-brand-400/60 uppercase tracking-widest mt-1">
                                                                Last: {prev.weight}kg x {prev.reps}
                                                            </p>
                                                        );
                                                    })()}
                                                </div>
                                                <span className="text-[10px] font-black text-brand-400 bg-brand-400/5 px-2.5 py-1 rounded-lg uppercase tracking-widest border border-brand-400/20">
                                                    {ex.sets}x{ex.reps}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {isCoachView && coachView ? (
                                    <div className="space-y-2">
                                        <Link
                                            href={`/coach/client/${coachView.clientId}`}
                                            className="btn-primary w-full h-12 text-xs font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 shadow-glow-brand"
                                        >
                                            <User className="w-4 h-4" />
                                            View Client
                                        </Link>
                                        {planId && (
                                            <Link
                                                href={`/plans/create?id=${planId}&clientId=${coachView.clientId}`}
                                                className="btn-secondary w-full h-12 text-xs font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2"
                                            >
                                                <PencilLine className="w-4 h-4" />
                                                {selectedDateKey >= todayKey ? "Edit Workout" : "Edit Plan"}
                                            </Link>
                                        )}
                                    </div>
                                ) : selectedDateKey < todayKey ? (
                                    <ReturnLink
                                        href={workoutLogHref}
                                        className={cn(
                                            "w-full h-12 text-xs font-black uppercase tracking-[0.15em] group hover:scale-[1.02] transition-all flex items-center justify-center",
                                            resumeSession
                                                ? "btn-primary shadow-glow-success bg-success border-success hover:bg-success-600"
                                                : "btn-secondary"
                                        )}
                                    >
                                        {resumeSession ? (
                                            <Flame className="w-4 h-4 mr-2 animate-pulse group-hover:scale-110 transition-transform" />
                                        ) : (
                                            <PlayCircle className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" />
                                        )}
                                        {resumeSession ? "Resume Session" : "View Workout"}
                                    </ReturnLink>
                                ) : (
                                    <ReturnLink
                                        href={workoutLogHref}
                                        className={cn(
                                            "btn-primary w-full h-14 text-xs font-black uppercase tracking-[0.2em] shadow-glow-brand group hover:scale-[1.02] transition-all flex items-center justify-center",
                                            resumeSession && "shadow-glow-success bg-success border-success hover:bg-success-600"
                                        )}
                                    >
                                        {resumeSession ? (
                                            <Flame className="w-5 h-5 mr-3 animate-pulse group-hover:scale-110 transition-transform" />
                                        ) : (
                                            <PlayCircle className="w-5 h-5 mr-3 group-hover:rotate-12 transition-transform" />
                                        )}
                                        {resumeSession ? "Resume Session" : "View Workout"}
                                    </ReturnLink>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 bg-surface-muted/10 rounded-3xl border border-dashed border-surface-border/60">
                                <div className="w-16 h-16 rounded-full bg-surface-muted/30 flex items-center justify-center border border-surface-border transition-transform active:scale-95 cursor-default">
                                    <Info className="w-8 h-8 text-fg-subtle opacity-30" />
                                </div>
                                <div className="max-w-[200px]">
                                    <p className="text-xs font-black text-fg uppercase tracking-widest mb-1 opacity-80">Rest Optimization</p>
                                    <p className="text-[10px] text-fg-subtle font-bold leading-relaxed">No training assigned for this date. Focus on recovery and nutrition.</p>
                                </div>
                                <Link
                                    href={isCoachView && coachView ? `/coach/client/${coachView.clientId}` : "/plans"}
                                    className="text-[10px] font-black text-brand-400 uppercase tracking-widest hover:underline pt-4"
                                >
                                    {isCoachView && coachView ? "View Client Profile" : "View Full Plan"}
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
                <div className="card p-4 flex flex-wrap gap-4 justify-center bg-surface-muted/20 border-surface-border/40">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-success" />
                        <span className="text-[8px] font-black uppercase tracking-tighter text-fg-subtle">Success</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-danger" />
                        <span className="text-[8px] font-black uppercase tracking-tighter text-fg-subtle">Missed</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-warning" />
                        <span className="text-[8px] font-black uppercase tracking-tighter text-fg-subtle">In Progress</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                        <span className="text-[8px] font-black uppercase tracking-tighter text-fg-subtle">Planned</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-surface-border" />
                        <span className="text-[8px] font-black uppercase tracking-tighter text-fg-subtle">Rest</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
