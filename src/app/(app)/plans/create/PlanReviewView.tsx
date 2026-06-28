"use client";

import { useEffect, useMemo, useState } from "react";
import {
    ChevronLeft, Dumbbell, CopyPlus, Loader2, ArrowLeft, ArrowRight, Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

interface ReviewExercise {
    name: string;
    sets: number;
    reps: string;
    weightTargetKg?: number;
}

interface ReviewWorkout {
    name: string;
    dayNumber: number;
    dayOfWeek?: number | null;
    exercises: ReviewExercise[];
}

interface ReviewWeek {
    weekNumber: number;
    name?: string;
    workouts: ReviewWorkout[];
}

interface Props {
    name: string;
    description: string;
    creatorName: string | null;
    weeks: ReviewWeek[];
    canCopyPlan: boolean;
    cloningPlan: boolean;
    onBack: () => void;
    onCopyPlan: () => void;
}

function workoutForDay(week: ReviewWeek, dayOfWeek: number): ReviewWorkout | null {
    const byDayOfWeek = week.workouts.find((w) => w.dayOfWeek === dayOfWeek);
    if (byDayOfWeek) return byDayOfWeek;
    return week.workouts.find(
        (w) => w.dayOfWeek == null && (w.dayNumber - 1) % 7 === dayOfWeek
    ) ?? null;
}

function resolveDayOfWeek(workout: ReviewWorkout): number | null {
    if (workout.dayOfWeek != null && workout.dayOfWeek >= 0 && workout.dayOfWeek <= 6) {
        return workout.dayOfWeek;
    }
    return (workout.dayNumber - 1) % 7;
}

function firstTrainingDay(week: ReviewWeek): number {
    const days = week.workouts
        .map(resolveDayOfWeek)
        .filter((d): d is number => d != null && d >= 0 && d <= 6);
    if (days.length === 0) return 0;
    return Math.min(...days);
}

export function PlanReviewView({
    name,
    description,
    creatorName,
    weeks,
    canCopyPlan,
    cloningPlan,
    onBack,
    onCopyPlan,
}: Props) {
    const [activeWeekIdx, setActiveWeekIdx] = useState(0);
    const [selectedDay, setSelectedDay] = useState(0);

    const currentWeek = weeks[activeWeekIdx];

    useEffect(() => {
        const week = weeks[activeWeekIdx];
        if (!week) return;
        setSelectedDay(firstTrainingDay(week));
    }, [activeWeekIdx, weeks]);

    const activeWorkout = useMemo(
        () => (currentWeek ? workoutForDay(currentWeek, selectedDay) : null),
        [currentWeek, selectedDay]
    );

    const trainingDays = useMemo(() => {
        if (!currentWeek) return new Set<number>();
        return new Set(
            currentWeek.workouts
                .map(resolveDayOfWeek)
                .filter((d): d is number => d != null && d >= 0 && d <= 6)
        );
    }, [currentWeek]);

    if (!currentWeek) return null;

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5 animate-fade-in pb-24 lg:pb-8">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <button type="button" onClick={onBack} className="btn-icon p-2 shrink-0">
                        <ChevronLeft className="w-5 h-5 text-fg-muted" />
                    </button>
                    <div className="min-w-0">
                        <h2 className="heading-2 text-lg sm:text-2xl truncate">{name || "Plan"}</h2>
                        <p className="text-xs text-brand-400 font-medium tracking-wide uppercase">
                            Plan review
                        </p>
                    </div>
                </div>
                {canCopyPlan && (
                    <button
                        type="button"
                        onClick={onCopyPlan}
                        disabled={cloningPlan}
                        className="btn-primary h-10 px-3 sm:px-4 gap-2 shrink-0"
                    >
                        {cloningPlan ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <CopyPlus className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">{cloningPlan ? "Copying..." : "Copy plan"}</span>
                    </button>
                )}
            </div>

            {(description || creatorName) && (
                <div className="card p-5 space-y-2">
                    {description && (
                        <p className="text-sm text-fg-muted leading-relaxed">{description}</p>
                    )}
                    {creatorName && (
                        <p className="text-xs font-semibold text-brand-400">
                            Created by {creatorName}
                        </p>
                    )}
                </div>
            )}

            {weeks.length > 1 && (
                <div className="card p-3 flex items-center justify-between gap-3 border-brand-500/20 bg-gradient-brand/5">
                    <button
                        type="button"
                        onClick={() => setActiveWeekIdx((i) => Math.max(0, i - 1))}
                        disabled={activeWeekIdx === 0}
                        className="btn-icon w-9 h-9 rounded-lg shrink-0 disabled:opacity-30 border bg-surface-elevated"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="text-center min-w-0 flex-1">
                        <p className="text-sm font-black text-fg uppercase tracking-widest">
                            Week {currentWeek.weekNumber}
                        </p>
                        {currentWeek.name && (
                            <p className="text-[10px] text-fg-muted font-bold truncate">{currentWeek.name}</p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setActiveWeekIdx((i) => Math.min(weeks.length - 1, i + 1))}
                        disabled={activeWeekIdx === weeks.length - 1}
                        className="btn-icon w-9 h-9 rounded-lg shrink-0 disabled:opacity-30 border bg-surface-elevated"
                    >
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className="sticky top-16 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 bg-surface/95 backdrop-blur-md border-y border-surface-border">
                <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle mb-2 px-0.5">
                    Training week
                </p>
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                    {DAYS.map((label, dayIndex) => {
                        const hasWorkout = trainingDays.has(dayIndex);
                        const isSelected = selectedDay === dayIndex;
                        return (
                            <button
                                key={label}
                                type="button"
                                onClick={() => setSelectedDay(dayIndex)}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-1 py-2.5 sm:py-3 rounded-xl border transition-all min-h-[3.25rem]",
                                    isSelected
                                        ? "bg-brand-950/50 border-brand-500/50 shadow-glow-sm"
                                        : hasWorkout
                                            ? "bg-surface-card border-surface-border hover:border-brand-500/30"
                                            : "bg-surface-muted/20 border-surface-border/60 opacity-60 hover:opacity-80"
                                )}
                            >
                                <span className={cn(
                                    "text-[10px] sm:text-xs font-black uppercase tracking-wide",
                                    isSelected ? "text-brand-400" : hasWorkout ? "text-fg" : "text-fg-subtle"
                                )}>
                                    {label}
                                </span>
                                {hasWorkout && (
                                    <span className={cn(
                                        "w-1.5 h-1.5 rounded-full",
                                        isSelected ? "bg-brand-400" : "bg-success/80"
                                    )} />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {activeWorkout ? (
                <div className="space-y-4 animate-fade-in">
                    <div className="card p-5 bg-gradient-to-br from-surface-card to-brand-950/15 border-brand-500/15">
                        <div className="flex items-start gap-4">
                            <div className="w-11 h-11 rounded-xl bg-brand-400/10 border border-brand-400/20 flex items-center justify-center shrink-0">
                                <Dumbbell className="w-5 h-5 text-brand-400" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest">
                                    {DAYS[selectedDay]} · Day {activeWorkout.dayNumber}
                                </p>
                                <h3 className="text-xl font-black text-fg tracking-tight mt-1">
                                    {activeWorkout.name}
                                </h3>
                                <p className="text-xs text-fg-muted mt-1">
                                    {activeWorkout.exercises.length} exercise{activeWorkout.exercises.length === 1 ? "" : "s"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {activeWorkout.exercises.length === 0 ? (
                        <div className="card p-10 text-center">
                            <p className="text-sm text-fg-muted">No exercises listed for this day.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {activeWorkout.exercises.map((ex, index) => (
                                <div
                                    key={`${ex.name}-${index}`}
                                    className="card p-4 flex items-center gap-4"
                                >
                                    <span className="w-8 h-8 rounded-lg bg-surface-muted border border-surface-border flex items-center justify-center text-xs font-black text-fg-subtle shrink-0">
                                        {index + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-fg">{ex.name}</p>
                                        <p className="text-xs text-fg-muted mt-0.5">
                                            {ex.sets} × {ex.reps}
                                            {ex.weightTargetKg != null && ex.weightTargetKg > 0
                                                ? ` @ ${ex.weightTargetKg}kg`
                                                : ""}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="card p-12 text-center space-y-3 border-dashed">
                    <Moon className="w-10 h-10 text-fg-subtle mx-auto opacity-60" />
                    <p className="text-sm font-bold text-fg">Rest day</p>
                    <p className="text-xs text-fg-muted">No session scheduled for {DAYS[selectedDay]}.</p>
                </div>
            )}
        </div>
    );
}
