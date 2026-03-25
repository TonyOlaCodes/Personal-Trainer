"use client";

import { useState } from "react";
import {
    ChevronLeft, ChevronRight, Calculator, Calendar as CalIcon,
    Dumbbell, Check, X, ArrowRight, Info, Activity, Clock,
    Layout, Star, MoreVertical, Flame, History, Award, PlayCircle
} from "lucide-react";
import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";

interface PlanExercise { name: string; sets: number; reps: string; }
interface PlanWorkout { dayNumber: number; dayOfWeek?: number | null; name: string; id: string; exercises: PlanExercise[]; }
interface PlanWeek { weekNumber: number; workouts: PlanWorkout[]; }
interface ActivePlan { name: string; weeks: PlanWeek[]; }
interface LoggedDate { date: string; workoutName: string; exercises: string[]; }

interface Props {
    activePlan: ActivePlan | null;
    loggedDates: LoggedDate[];
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

export function CalendarClient({ activePlan, loggedDates }: Props) {
    const today = new Date();
    const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
    const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());

    const firstDay = new Date(view.year, view.month, 1);
    const lastDay = new Date(view.year, view.month + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7; 
    const daysInMonth = lastDay.getDate();

    const logMap: Record<string, LoggedDate> = {};
    loggedDates.forEach((l) => { logMap[new Date(l.date).toDateString()] = l; });

    const planDayMap: Record<number, PlanWorkout> = {};
    // Currently pulling from week 1 - in a full version we'd calculate user's current week
    if (activePlan?.weeks?.[0]) {
        activePlan.weeks[0].workouts.forEach((w) => {
            if (w.dayOfWeek !== null && w.dayOfWeek !== undefined) {
                planDayMap[w.dayOfWeek] = w;
            } else {
                planDayMap[(w.dayNumber - 1) % 7] = w;
            }
        });
    }

    const cells: (number | null)[] = [
        ...Array(startDow).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const isToday = (d: number) => d === today.getDate() && view.month === today.getMonth() && view.year === today.getFullYear();
    
    // Selection details
    const selectedDate = selectedDay ? new Date(view.year, view.month, selectedDay) : today;
    const selectedLog = logMap[selectedDate.toDateString()];
    
    const isSelectedPast = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const selectedPlanned = !isSelectedPast ? planDayMap[(selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1)] : null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in pb-20">
            {/* Calendar Main Grid */}
            <div className="lg:col-span-8 space-y-6">
                <div className="flex items-center justify-between px-2">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black tracking-[0.2em] text-brand-400 uppercase">Training Timeline</p>
                        <h2 className="text-3xl font-black text-fg flex items-center gap-4">
                            {MONTHS[view.month]}
                            <span className="text-brand-400/30 font-light">{view.year}</span>
                        </h2>
                    </div>
                    <div className="flex items-center gap-1.5 bg-surface-muted/50 p-1.5 rounded-2xl border border-surface-border">
                        <button 
                            onClick={() => setView(v => { const d = new Date(v.year, v.month-1); return { year: d.getFullYear(), month: d.getMonth() }; })} 
                            className="w-8 h-8 rounded-xl bg-surface hover:bg-surface-elevated flex items-center justify-center transition-all border border-surface-border text-fg-muted"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => setView({ year: today.getFullYear(), month: today.getMonth() })} 
                            className="px-4 h-8 rounded-xl bg-surface hover:bg-brand-950/30 hover:text-brand-400 text-[10px] font-black uppercase tracking-widest transition-all border border-surface-border text-fg"
                        >
                            Today
                        </button>
                        <button 
                            onClick={() => setView(v => { const d = new Date(v.year, v.month+1); return { year: d.getFullYear(), month: d.getMonth() }; })} 
                            className="w-8 h-8 rounded-xl bg-surface hover:bg-surface-elevated flex items-center justify-center transition-all border border-surface-border text-fg-muted"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="card overflow-hidden shadow-glow-sm border-brand-500/10">
                    <div className="grid grid-cols-7 bg-surface-muted/20 border-b border-surface-border">
                        {DAYS.map(d => (
                            <div key={d} className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-fg-subtle border-r border-surface-border last:border-r-0">
                                {d}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 bg-surface-card/30 backdrop-blur-md">
                        {cells.map((day, idx) => {
                            const dateObj = day ? new Date(view.year, view.month, day) : null;
                            const currentDow = dateObj ? (dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1) : null;
                            const log = day ? logMap[dateObj!.toDateString()] : null;
                            
                            // Temporal Rule: Only show planned plan for TODAY and FUTURE
                            // For the PAST, we only show verified LOGS (Reality)
                            const isPast = dateObj ? (new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()) < new Date(today.getFullYear(), today.getMonth(), today.getDate())) : false;
                            const planned = (!isPast && day && currentDow !== null) ? planDayMap[currentDow] : null;
                            
                            const selected = day === selectedDay;

                            return (
                                <button 
                                    key={idx} 
                                    disabled={!day}
                                    onClick={() => day && setSelectedDay(day)}
                                    className={cn(
                                        "min-h-[100px] sm:min-h-[120px] p-2 border-b border-r border-surface-border last:border-r-0 transition-all group flex flex-col items-start gap-1 relative overflow-hidden",
                                        !day && "bg-surface-muted/10",
                                        day && "cursor-pointer hover:bg-surface-muted/20",
                                        selected && "bg-brand-950/30"
                                    )}
                                >
                                    {day && (
                                        <>
                                            <div className="w-full flex justify-between items-center mb-1">
                                                <span className={cn(
                                                    "text-sm font-black flex items-center justify-center w-7 h-7 rounded-lg transition-all",
                                                    isToday(day) ? "bg-brand-400 text-white shadow-glow-brand" : (selected ? "bg-fg text-surface" : "text-fg-subtle group-hover:text-fg")
                                                )}>
                                                    {day}
                                                </span>
                                                {log && <div className="w-1.5 h-1.5 rounded-full bg-success shadow-glow-success animate-pulse" />}
                                            </div>

                                            {/* Visual Cues */}
                                            <div className="w-full space-y-1 mt-auto">
                                                {log ? (
                                                    <div className="relative">
                                                        <div className="w-full h-1 rounded-full bg-success/20 overflow-hidden">
                                                            <div className="w-full h-full bg-success" />
                                                        </div>
                                                        <span className="text-[8px] font-black uppercase tracking-tighter text-success truncate block group-hover:opacity-100 opacity-60 transition-opacity">DONE: {log.workoutName}</span>
                                                    </div>
                                                ) : planned ? (
                                                    <div className="relative">
                                                        <div className="w-full h-1 rounded-full bg-brand-400/20 overflow-hidden">
                                                            <div className="w-full h-full bg-brand-400 animate-pulse" />
                                                        </div>
                                                        <span className="text-[8px] font-black uppercase tracking-tighter text-brand-400 truncate block group-hover:opacity-100 opacity-60 transition-opacity">{planned.name}</span>
                                                    </div>
                                                ) : null}
                                            </div>

                                            {/* Selection Highlight */}
                                            {selected && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-400 shadow-glow-brand" />}
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Sidebar Details Panel */}
            <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-10 lg:h-fit">
                <div className="card p-6 border-brand-500/20 bg-gradient-to-br from-surface-card to-brand-950/20 shadow-glow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-surface-muted flex items-center justify-center border border-surface-border">
                                <History className="w-5 h-5 text-brand-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-fg uppercase tracking-widest">{selectedDate.toDateString() === today.toDateString() ? "Today's Status" : "Session Detail"}</h3>
                                <p className="text-[10px] text-fg-muted font-bold">{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                            </div>
                        </div>
                        <Link href="/plans" className="btn-icon w-8 h-8 rounded-lg bg-surface-card hover:bg-brand-950/30 transition-all">
                            <ArrowRight className="w-4 h-4 text-brand-400" />
                        </Link>
                    </div>

                    <div className="space-y-6">
                        {/* Status Section */}
                        <div className="space-y-3">
                            {selectedLog ? (
                                <div className="space-y-4 animate-slide-up">
                                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-success-950/20 border border-success-500/20">
                                        <div className="w-8 h-8 rounded-lg bg-success flex items-center justify-center shadow-glow-success-sm">
                                            <Check className="w-4 h-4 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-success uppercase tracking-widest mb-0.5">Session Completed</p>
                                            <p className="text-sm font-bold text-fg tracking-tight">{selectedLog.workoutName}</p>
                                        </div>
                                    </div>

                                    {/* Exercises List */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-fg-subtle uppercase px-2 mb-2 tracking-[0.1em]">Plan Executed</p>
                                        {selectedLog.exercises.map((ex, i) => (
                                            <div key={i} className="flex items-center gap-3 py-2 border-b border-surface-border/30 last:border-none px-2 group">
                                                <div className="w-1 h-1 rounded-full bg-success transition-transform group-hover:scale-150" />
                                                <span className="text-xs text-fg leading-tight group-hover:text-success transition-colors">{ex}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : selectedPlanned ? (
                                <div className="space-y-6 animate-slide-up">
                                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-brand-950/20 border border-brand-500/20 shadow-glow-brand-sm">
                                        <div className="w-8 h-8 rounded-lg bg-brand-400 flex items-center justify-center shadow-glow-brand-sm">
                                            <Clock className="w-4 h-4 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-0.5">Plan Assigned</p>
                                            <p className="text-sm font-bold text-fg tracking-tight">{selectedPlanned.name}</p>
                                        </div>
                                    </div>

                                    {/* Planned Exercises */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-fg-subtle uppercase px-2 mb-2 tracking-[0.1em]">Session Targets</p>
                                        {selectedPlanned.exercises.map((ex, i) => (
                                            <div key={i} className="flex items-center justify-between py-2 border-b border-surface-border/30 last:border-none px-2 hover:bg-brand-400/5 transition-colors rounded-lg group">
                                                <span className="text-xs text-fg leading-tight group-hover:text-brand-400 transition-colors">{ex.name}</span>
                                                <span className="text-[10px] font-black text-brand-400 bg-brand-400/5 px-2 py-0.5 rounded uppercase">{ex.sets}x{ex.reps}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {(selectedDate.toDateString() === today.toDateString()) && (
                                        <Link
                                            href={`/plans/log/${selectedPlanned.id}`}
                                            className="btn-primary w-full h-11 text-[10px] font-bold uppercase tracking-widest shadow-glow-brand group"
                                        >
                                            <PlayCircle className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                                            Execute Plan
                                        </Link>
                                    )}
                                </div>
                            ) : (
                                <div className="p-8 text-center space-y-3 bg-surface-muted/20 rounded-2xl border border-surface-border/50 animate-fade-in">
                                    <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center mx-auto mb-2 opacity-50">
                                        <Info className="w-6 h-6 text-fg-subtle" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-fg uppercase tracking-widest">Plan Deviation</p>
                                        <p className="text-xs text-fg-muted">Rest optimization or unscheduled effort for this day.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Training Summary Area */}
                <div className="card p-6 space-y-4 bg-surface-muted/30">
                    <h4 className="text-[10px] font-black uppercase text-fg-subtle tracking-[0.2em] mb-2 flex items-center gap-2">
                        <Activity className="w-3 h-3 text-brand-400" />
                        Monthly Snapshot
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-surface-card/50 rounded-2xl border border-surface-border flex flex-col justify-between h-24">
                            <p className="text-[8px] font-bold text-fg-muted uppercase">All Time Workouts</p>
                            <p className="text-3xl font-black text-fg tracking-tight">{loggedDates.length}</p>
                            <p className="text-[10px] text-fg-subtle uppercase font-bold">Total Sessions</p>
                        </div>
                        <div className="p-4 bg-surface-card/50 rounded-2xl border border-surface-border flex flex-col justify-between h-24">
                            <p className="text-[8px] font-bold text-fg-muted uppercase">This Month</p>
                            <p className="text-3xl font-black text-brand-400 tracking-tight">
                                {loggedDates.filter(l => new Date(l.date).getMonth() === view.month && new Date(l.date).getFullYear() === view.year).length}
                            </p>
                            <p className="text-[10px] text-brand-400/60 uppercase font-bold">Sessions Logged</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
