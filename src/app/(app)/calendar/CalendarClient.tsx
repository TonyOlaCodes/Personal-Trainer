"use client";

import { useState, useMemo } from "react";
import {
    ChevronLeft, ChevronRight,
    Dumbbell, Check, X, ArrowRight, Info, Activity, Clock,
    Layout, Star, MoreVertical, Flame, History, Award, 
    PlayCircle, CheckCircle2, AlertCircle, BarChart3,
    Calendar as CalendarIcon, Zap, Hash, Target
} from "lucide-react";
import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";

/* ─────────────────────────── Types ─────────────────────────── */
interface PlanExercise { name: string; sets: number; reps: string; }
interface PlanWorkout { dayNumber: number; dayOfWeek?: number | null; name: string; id: string; exercises: PlanExercise[]; }
interface PlanWeek { weekNumber: number; workouts: PlanWorkout[]; }
interface ActivePlan { name: string; weeks: PlanWeek[]; }

interface LogSet {
    exerciseName: string;
    setNumber: number;
    reps?: number | null;
    weightKg?: number | null;
    rpe?: number | null;
}
interface LoggedDate { 
    id: string;
    date: string; 
    workoutName: string; 
    workoutId: string;
    duration?: number | null;
    sets: LogSet[]; 
}

interface Props {
    activePlan: ActivePlan | null;
    planStartedAt: string | null;
    loggedDates: LoggedDate[];
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

export function CalendarClient({ activePlan, planStartedAt, loggedDates }: Props) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
    const [selectedDateKey, setSelectedDateKey] = useState<string>(today.toDateString());

    /* ─── Data Mappers ─── */
    const logMap = useMemo(() => {
        const map: Record<string, LoggedDate> = {};
        loggedDates.forEach((l) => {
            const d = new Date(l.date);
            d.setHours(0, 0, 0, 0);
            map[d.toDateString()] = l;
        });
        return map;
    }, [loggedDates]);

    const getPlannedWorkoutForDate = (date: Date): PlanWorkout | null => {
        if (!activePlan || !planStartedAt) return null;
        const start = new Date(planStartedAt);
        start.setHours(0, 0, 0, 0);
        
        // Find Monday of the start week
        const startDow = start.getDay(); // 0=Sun
        const startToMon = startDow === 0 ? -6 : 1 - startDow;
        const planAnchorMonday = new Date(start.getTime() + startToMon * 86400000);
        planAnchorMonday.setHours(0, 0, 0, 0);

        const diffDays = Math.floor((date.getTime() - planAnchorMonday.getTime()) / 86400000);
        if (diffDays < 0) return null;

        const weekIdx = Math.floor(diffDays / 7);
        
        // If the plan is finite (e.g. 4-week linearity plan), don't cycle — just return nothing
        if (weekIdx >= activePlan.weeks.length) return null;

        // 0=Mon,1=Tue,...,6=Sun  (same as plan designer)
        const jsDay = date.getDay(); // 0=Sun
        const dayIdx = jsDay === 0 ? 6 : jsDay - 1;
        
        const week = activePlan.weeks[weekIdx];
        if (!week) return null;
        
        // Match by dayOfWeek (0=Mon) — exact match only
        const workout = week.workouts.find(w => {
            if (w.dayOfWeek !== null && w.dayOfWeek !== undefined) {
                return w.dayOfWeek === dayIdx;
            }
            // Fallback: dayNumber-based (1=Mon, 2=Tue...)
            return (w.dayNumber - 1) % 7 === dayIdx;
        });
        
        return workout ?? null;
    };

    /* ─── Streaks & Consistency ─── */
    const { currentStreak, bestStreak } = useMemo(() => {
        const sortedLogDates = Array.from(new Set(loggedDates.map(l => {
            const d = new Date(l.date);
            d.setHours(0,0,0,0);
            return d.getTime();
        }))).sort((a,b) => b - a);

        let current = 0;
        let best = 0;
        let temp = 0;

        // Current
        const tTime = today.getTime();
        let checkTime = tTime;
        for (let i = 0; i < sortedLogDates.length; i++) {
            if (sortedLogDates[i] === checkTime) {
                current++;
                checkTime -= 86400000;
            } else if (sortedLogDates[i] < checkTime) {
                // Check if yesterday was a rest day (simplified: if skipping 1 day is fine)
                // But user wants "X days active", usually meaning consecutive log days
                break;
            }
        }

        // Best
        const ascDates = [...sortedLogDates].sort((a,b) => a - b);
        for (let i = 0; i < ascDates.length; i++) {
            if (i > 0 && ascDates[i] === ascDates[i-1] + 86400000) {
                temp++;
            } else {
                temp = 1;
            }
            best = Math.max(best, temp);
        }

        return { currentStreak: current, bestStreak: best };
    }, [loggedDates]);

    const weeklyConsistency = useMemo(() => {
        // Calculate Mon-Sun for current physical week
        const curr = new Date();
        const day = curr.getDay();
        const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(curr.setDate(diff));
        monday.setHours(0,0,0,0);

        let completed = 0;
        let plannedCount = 0;

        for (let i = 0; i < 7; i++) {
            const d = new Date(monday.getTime() + (i * 86400000));
            if (logMap[d.toDateString()]) completed++;
            if (getPlannedWorkoutForDate(d)) plannedCount++;
        }

        return { completed, target: plannedCount || 5 };
    }, [logMap, activePlan]);

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

    /* ─── Monthly Snapshot ─── */
    const monthStats = useMemo(() => {
        let items = loggedDates.filter(l => {
            const d = new Date(l.date);
            return d.getMonth() === view.month && d.getFullYear() === view.year;
        });
        
        let totalVolume = items.reduce((sum, log) => {
            return sum + log.sets.reduce((sSum, s) => sSum + ((s.reps || 0) * (s.weightKg || 0)), 0);
        }, 0);

        let plannedInMonth = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(view.year, view.month, d);
            if (getPlannedWorkoutForDate(date)) plannedInMonth++;
        }

        return {
            count: items.length,
            planned: plannedInMonth,
            volume: totalVolume,
            consistency: plannedInMonth > 0 ? Math.round((items.length / plannedInMonth) * 100) : 100
        };
    }, [view, loggedDates, activePlan]);

    /* ─── Selected Day Helpers ─── */
    const selectedDate = new Date(selectedDateKey);
    const selectedLog = logMap[selectedDateKey];
    const selectedPlanned = getPlannedWorkoutForDate(selectedDate);
    
    const calculateVolume = (sets: LogSet[]) => {
        return Math.round(sets.reduce((acc, s) => acc + ((s.reps || 0) * (s.weightKg || 1)), 0)); // weight 1 if bodyweight
    };

    const getPreviousPerformance = (exerciseName: string, beforeDate: Date) => {
        // Find logs before this date, sorted desc (already sorted desc from API)
        const prevLogs = loggedDates.filter(l => new Date(l.date).getTime() < beforeDate.getTime());
        for (const log of prevLogs) {
            const exSets = log.sets.filter(s => s.exerciseName.toLowerCase() === exerciseName.toLowerCase());
            if (exSets.length > 0) {
                const maxWeight = Math.max(...exSets.map(s => s.weightKg || 0));
                const bestSet = exSets.find(s => s.weightKg === maxWeight) || exSets[0];
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
            
            {/* ── Header Area (Stats Cards) ── */}
            <div className="lg:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="card p-4 flex items-center justify-between border-brand-500/10 bg-surface-muted/30">
                    <div>
                        <p className="text-[10px] font-black uppercase text-fg-subtle tracking-widest mb-1">Consistency</p>
                        <p className="text-xl font-black text-fg">{weeklyConsistency.completed}/{weeklyConsistency.target}</p>
                        <div className="w-24 h-1 bg-surface-muted rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-brand-400 rounded-full" style={{ width: `${(weeklyConsistency.completed/weeklyConsistency.target)*100}%` }} />
                        </div>
                    </div>
                    <Target className="w-8 h-8 text-brand-400 opacity-20" />
                </div>
                <div className="card p-4 flex items-center justify-between border-brand-500/10 bg-surface-muted/30">
                    <div>
                        <p className="text-[10px] font-black uppercase text-fg-subtle tracking-widest mb-1">Current Streak</p>
                        <p className="text-xl font-black text-brand-400">{currentStreak} <span className="text-xs text-fg-muted">days</span></p>
                        <p className="text-[9px] font-bold text-fg-subtle mt-1 uppercase">Best: {bestStreak}</p>
                    </div>
                    <Flame className={cn("w-8 h-8", currentStreak > 0 ? "text-orange-500 animate-pulse" : "text-fg-subtle opacity-20")} />
                </div>
                <div className="card p-4 flex items-center justify-between border-brand-500/10 bg-surface-muted/30">
                    <div>
                        <p className="text-[10px] font-black uppercase text-fg-subtle tracking-widest mb-1">Monthly sessions</p>
                        <p className="text-xl font-black text-fg">{monthStats.count} <span className="text-xs text-fg-muted font-black opacity-30">/ {monthStats.planned}</span></p>
                        <p className="text-[9px] font-bold text-success mt-1 uppercase">{monthStats.consistency}% Compliance</p>
                    </div>
                    <CheckCircle2 className="w-8 h-8 text-success opacity-20" />
                </div>
                <div className="card p-4 flex items-center justify-between border-brand-500/10 bg-surface-muted/30">
                    <div>
                        <p className="text-[10px] font-black uppercase text-fg-subtle tracking-widest mb-1">Total Volume</p>
                        <p className="text-xl font-black text-fg">{monthStats.volume.toLocaleString()}<span className="text-xs text-fg-muted ml-1">kg</span></p>
                        <p className="text-[9px] font-bold text-fg-subtle mt-1 uppercase">This Month</p>
                    </div>
                    <BarChart3 className="w-8 h-8 text-brand-400 opacity-20" />
                </div>
            </div>

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
                            onClick={() => setView({ year: today.getFullYear(), month: today.getMonth() })} 
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
                            const dateObj = day ? new Date(view.year, view.month, day) : null;
                            if (dateObj) dateObj.setHours(0,0,0,0);
                            
                            const dateKey = dateObj ? dateObj.toDateString() : "";
                            const log = day ? logMap[dateKey] : null;
                            const planned = dateObj ? getPlannedWorkoutForDate(dateObj) : null;
                            const isPast = dateObj ? dateObj < today : false;
                            const isTodayDay = dateObj ? dateObj.getTime() === today.getTime() : false;
                            const selected = dateKey === selectedDateKey;

                            // Status logic
                            let status: 'completed' | 'missed' | 'scheduled' | 'rest' = 'rest';
                            if (log) status = 'completed';
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
                                    {selectedDateKey === today.toDateString() ? "Today" : "Review"}
                                </h3>
                                <p className="text-[10px] text-fg-muted font-bold opacity-60 uppercase tracking-tighter">
                                    {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <div className={cn(
                                "w-2.5 h-2.5 rounded-full",
                                selectedLog ? "bg-success" : (selectedPlanned ? (selectedDate < today ? "bg-danger" : "bg-brand-400") : "bg-surface-border")
                            )} />
                        </div>
                    </div>

                    <div className="space-y-6 animate-slide-up">
                        {selectedLog ? (
                            <div className="space-y-6">
                                {/* Header Info */}
                                <div className="p-4 rounded-2xl bg-success-950/20 border border-success-500/20 shadow-glow-success-sm">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-[10px] font-black text-success uppercase tracking-widest mb-1">Session Logged</p>
                                            <p className="text-lg font-black text-fg tracking-tight">{selectedLog.workoutName}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-fg-subtle uppercase">Volume</p>
                                            <p className="text-sm font-black text-fg">{calculateVolume(selectedLog.sets).toLocaleString()}kg</p>
                                        </div>
                                    </div>
                                    {selectedLog.duration && (
                                        <div className="mt-4 flex items-center gap-2 text-xs text-fg-muted font-bold">
                                            <Clock className="w-3.5 h-3.5 text-success" />
                                            {selectedLog.duration} minutes active
                                        </div>
                                    )}
                                </div>

                                {/* Exercise List */}
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black text-fg-subtle uppercase px-2 tracking-[0.2em] flex items-center gap-2">
                                        <Zap className="w-3 h-3 text-brand-400" /> PERFORMANCE
                                    </p>
                                    <div className="space-y-0.5">
                                        {/* Group by exercise */}
                                        {Array.from(new Set(selectedLog.sets.map(s => s.exerciseName))).map((exName, idx) => {
                                            const exSets = selectedLog.sets.filter(s => s.exerciseName === exName);
                                            const maxWeight = Math.max(...exSets.map(s => s.weightKg || 0));
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
                                    <Link 
                                        href={`/plans/log/view/${selectedLog.id}`}
                                        className="btn-primary w-full h-11 text-[10px] font-black uppercase tracking-[.2em] group flex items-center justify-center gap-2 mt-2 shadow-glow-brand"
                                    >
                                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        Review Session
                                    </Link>
                                </div>
                            </div>
                        ) : selectedPlanned ? (
                            <div className="space-y-6">
                                <div className={cn(
                                    "p-4 rounded-2xl border",
                                    selectedDate < today ? "bg-danger-950/20 border-danger-500/20" : "bg-brand-950/20 border-brand-500/20 shadow-glow-brand-sm"
                                )}>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className={cn(
                                                "text-[10px] font-black uppercase tracking-widest mb-1",
                                                selectedDate < today ? "text-danger" : "text-brand-400"
                                            )}>
                                                {selectedDate < today ? "Missed Session" : "Upcoming Session"}
                                            </p>
                                            <p className="text-lg font-black text-fg tracking-tight">{selectedPlanned.name}</p>
                                        </div>
                                        <Layout className={cn("w-5 h-5", selectedDate < today ? "text-danger opacity-40" : "text-brand-400")} />
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

                                {selectedDate < today ? (
                                    <Link
                                        href={`/plans/log/${selectedPlanned.id}?date=${selectedDate.toISOString().split("T")[0]}`}
                                        className="btn-secondary w-full h-12 text-xs font-black uppercase tracking-[0.15em] group hover:scale-[1.02] transition-all"
                                    >
                                        <PlayCircle className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" />
                                        Log Past Session
                                    </Link>
                                ) : (
                                    <Link
                                        href={`/plans/log/${selectedPlanned.id}?date=${selectedDate.toISOString().split("T")[0]}`}
                                        className="btn-primary w-full h-14 text-xs font-black uppercase tracking-[0.2em] shadow-glow-brand group hover:scale-[1.02] transition-all"
                                    >
                                        <PlayCircle className="w-5 h-5 mr-3 group-hover:rotate-12 transition-transform" />
                                        Start Session
                                    </Link>
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
                                <Link href="/plans" className="text-[10px] font-black text-brand-400 uppercase tracking-widest hover:underline pt-4">View Full Plan</Link>
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
