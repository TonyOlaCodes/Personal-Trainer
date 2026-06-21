"use client";

import { Scale, Flame, Footprints, Dumbbell, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CheckInPeriodSummary } from "@/lib/checkInPeriodSummary";

function toneClass(met: boolean | null) {
    if (met === true) return "text-success bg-success/10 border-success/25";
    if (met === false) return "text-red-400 bg-red-400/10 border-red-400/25";
    return "text-fg-muted bg-surface-muted border-surface-border";
}

function StatAdvice({ message, detail, met }: { message: string; detail: string; met?: boolean | null }) {
    return (
        <div className={cn("rounded-xl border px-3 py-2.5 text-xs leading-relaxed", toneClass(met ?? null))}>
            <p className="font-black uppercase tracking-widest text-[10px] mb-0.5">{message}</p>
            <p className="opacity-90">{detail}</p>
        </div>
    );
}

export function CheckInPeriodSummaryPanel({
    summary,
    loading,
    compact = false,
}: {
    summary: CheckInPeriodSummary | null;
    loading?: boolean;
    compact?: boolean;
}) {
    if (loading) {
        return (
            <div className="rounded-2xl border border-surface-border bg-surface-muted/20 p-4 text-xs text-fg-muted animate-pulse">
                Loading period summary...
            </div>
        );
    }

    if (!summary) return null;

    const WeightIcon = summary.weight?.changeKg == null || summary.weight.changeKg === 0
        ? Minus
        : summary.weight.changeKg > 0
            ? TrendingUp
            : TrendingDown;

    return (
        <div className={cn("space-y-4", compact ? "" : "card p-5 border-surface-border")}>
            <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-fg-subtle">
                    Period review
                </p>
                <p className="text-xs text-fg-muted mt-1">
                    Stats from {summary.periodLabel}
                    {summary.frequencyWeeks > 1 ? ` (${summary.frequencyWeeks}-week check-in cycle)` : ""}.
                </p>
            </div>

            <div className={cn("grid gap-3", compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
                {summary.weight && (
                    <div className="rounded-2xl border border-surface-border bg-surface-card/40 p-4 space-y-2">
                        <div className="flex items-center gap-2">
                            <Scale className="w-4 h-4 text-brand-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Weight</span>
                        </div>
                        <p className="text-xl font-black text-fg">
                            {summary.weight.currentKg != null ? `${summary.weight.currentKg.toFixed(1)} kg` : "—"}
                            <span className="text-[10px] font-bold text-fg-muted ml-2">latest</span>
                        </p>
                        {summary.weight.changeKg != null && (
                            <p className={cn("text-xs font-bold flex items-center gap-1", summary.weight.towardGoal ? "text-success" : summary.weight.towardGoal === false ? "text-red-400" : "text-fg-muted")}>
                                <WeightIcon className="w-3.5 h-3.5" />
                                {summary.weight.changeKg > 0 ? "+" : ""}{summary.weight.changeKg.toFixed(1)} kg vs start of period
                            </p>
                        )}
                        {summary.weight.targetKg && summary.weight.currentKg && (
                            <p className="text-[10px] text-fg-muted">
                                Goal {summary.weight.targetKg.toFixed(1)} kg · {Math.abs(summary.weight.currentKg - summary.weight.targetKg).toFixed(1)} kg away
                            </p>
                        )}
                        <StatAdvice message={summary.weight.message} detail={summary.weight.detail} met={summary.weight.towardGoal} />
                    </div>
                )}

                <div className="rounded-2xl border border-surface-border bg-surface-card/40 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                        <Dumbbell className="w-4 h-4 text-brand-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Training</span>
                    </div>
                    <p className="text-xl font-black text-fg">
                        {summary.workouts.completed}
                        <span className="text-sm text-fg-muted font-bold"> / {summary.workouts.target}</span>
                    </p>
                    <p className="text-[10px] text-fg-muted uppercase tracking-wider">
                        {summary.workouts.skipped > 0
                            ? `${summary.workouts.skipped} skipped`
                            : "All planned sessions done"}
                    </p>
                    <StatAdvice
                        message={summary.workouts.message}
                        detail={summary.workouts.detail}
                        met={summary.workouts.completed >= summary.workouts.target}
                    />
                </div>

                {summary.calories && (
                    <div className="rounded-2xl border border-surface-border bg-surface-card/40 p-4 space-y-2">
                        <div className="flex items-center gap-2">
                            <Flame className="w-4 h-4 text-warning" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Calories</span>
                        </div>
                        <p className="text-xl font-black text-fg">
                            {summary.calories.average != null ? summary.calories.average.toLocaleString() : "—"}
                            <span className="text-sm text-fg-muted font-bold"> avg / day</span>
                        </p>
                        <p className="text-[10px] text-fg-muted">
                            Target {summary.calories.target?.toLocaleString() ?? "—"}
                            {summary.calories.daysLogged > 0 ? ` · ${summary.calories.daysLogged} days logged` : ""}
                        </p>
                        <StatAdvice message={summary.calories.message} detail={summary.calories.detail} met={summary.calories.metGoal} />
                    </div>
                )}

                {summary.steps && (
                    <div className="rounded-2xl border border-surface-border bg-surface-card/40 p-4 space-y-2">
                        <div className="flex items-center gap-2">
                            <Footprints className="w-4 h-4 text-success" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Steps</span>
                        </div>
                        <p className="text-xl font-black text-fg">
                            {summary.steps.average != null ? summary.steps.average.toLocaleString() : "—"}
                            <span className="text-sm text-fg-muted font-bold"> avg / day</span>
                        </p>
                        <p className="text-[10px] text-fg-muted">
                            Target {summary.steps.target?.toLocaleString() ?? "—"}
                            {summary.steps.daysLogged > 0 ? ` · ${summary.steps.daysLogged} days logged` : ""}
                        </p>
                        <StatAdvice message={summary.steps.message} detail={summary.steps.detail} met={summary.steps.metGoal} />
                    </div>
                )}
            </div>

            <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 px-4 py-3 text-sm text-fg leading-relaxed">
                <p className="text-[10px] font-black uppercase tracking-widest text-brand-300 mb-1">Looking ahead</p>
                {summary.overallMessage}
            </div>
        </div>
    );
}
