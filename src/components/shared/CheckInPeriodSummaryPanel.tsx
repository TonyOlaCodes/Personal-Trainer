"use client";

import { Scale, Footprints, Dumbbell, Flame, Moon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CheckInLifestyleMetricSummary, CheckInPeriodSummary } from "@/lib/checkInPeriodSummary";

function toneClass(met: boolean | null) {
    if (met === true) return "text-success";
    if (met === false) return "text-red-400";
    return "text-fg-muted";
}

function formatCalories(value: number) {
    return Math.round(value).toLocaleString();
}

function LifestyleMetricBlock({
    title,
    unit,
    icon: Icon,
    metric,
    formatValue,
}: {
    title: string;
    unit: string;
    icon: typeof Flame;
    metric: CheckInLifestyleMetricSummary;
    formatValue: (value: number) => string;
}) {
    const loggedLine = `${metric.daysLogged}/${metric.expectedDays} days logged`;

    return (
        <div className="rounded-2xl border border-surface-border bg-surface-card/40 p-4 space-y-1.5">
            <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-brand-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">{title}</span>
            </div>
            {metric.verdict === "insufficient" ? (
                <>
                    <p className="text-sm font-black text-fg">{loggedLine}</p>
                    <p className="text-xs font-bold text-fg">Not enough data yet</p>
                    <p className="text-xs text-fg-muted leading-relaxed">{metric.detail}</p>
                </>
            ) : (
                <>
                    <p className="text-xl font-black text-fg">
                        {metric.average != null ? formatValue(metric.average) : "—"}
                        {metric.target != null && (
                            <span className="text-sm text-fg-muted font-bold"> / {formatValue(metric.target)} {unit}</span>
                        )}
                        {metric.target == null && metric.average != null && (
                            <span className="text-sm text-fg-muted font-bold"> {unit}</span>
                        )}
                    </p>
                    <p className="text-[10px] text-fg-muted">
                        {loggedLine}
                        {metric.onTargetPercent != null ? ` · ${metric.onTargetPercent}% on target` : ""}
                    </p>
                    <p className={cn("text-xs font-bold", toneClass(metric.metGoal))}>{metric.message}</p>
                    <p className="text-xs text-fg-muted leading-relaxed">{metric.detail}</p>
                </>
            )}
        </div>
    );
}

function OverviewList({ title, items }: { title: string; items: string[] }) {
    if (items.length === 0) return null;
    return (
        <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle mb-1.5">{title}</p>
            <ul className="space-y-1 text-xs text-fg-muted leading-relaxed">
                {items.map((item) => (
                    <li key={item} className="flex gap-2">
                        <span className="text-brand-400 shrink-0">•</span>
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
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
                Loading check-in summary...
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
                    Check-In Summary
                </p>
                <p className="text-xs text-fg-muted mt-1">{summary.periodLabel}</p>
            </div>

            <div className={cn("grid gap-3", compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
                <div className="rounded-2xl border border-surface-border bg-surface-card/40 p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                        <Dumbbell className="w-4 h-4 text-brand-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Training</span>
                    </div>
                    <p className="text-xl font-black text-fg">
                        {summary.workouts.completed}
                        <span className="text-sm text-fg-muted font-bold"> / {summary.workouts.target}</span>
                        {summary.workouts.target > 0 && (
                            <span className="text-sm text-fg-muted font-bold ml-1">({summary.workouts.completionPercent}%)</span>
                        )}
                    </p>
                    <p className="text-[10px] text-fg-muted uppercase tracking-wider">
                        {summary.workouts.skipped > 0
                            ? `${summary.workouts.skipped} missed`
                            : summary.workouts.target > 0 && summary.workouts.completed >= summary.workouts.target
                                ? "All planned sessions done"
                                : "Workouts completed"}
                        {summary.workouts.prCount > 0 ? ` · ${summary.workouts.prCount} PR${summary.workouts.prCount === 1 ? "" : "s"}` : ""}
                    </p>
                    <p className={cn("text-xs font-bold", toneClass(
                        summary.workouts.completionPercent >= 80 ? true : summary.workouts.completionPercent < 50 ? false : null
                    ))}>
                        {summary.workouts.message}
                    </p>
                </div>

                {summary.weight && (
                    <div className="rounded-2xl border border-surface-border bg-surface-card/40 p-4 space-y-1.5">
                        <div className="flex items-center gap-2">
                            <Scale className="w-4 h-4 text-brand-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Weight</span>
                        </div>
                        <p className="text-xl font-black text-fg">
                            {summary.weight.currentKg != null ? `${summary.weight.currentKg.toFixed(1)} kg` : "—"}
                            <span className="text-[10px] font-bold text-fg-muted ml-2">avg {summary.weight.windowLabel}</span>
                        </p>
                        {summary.weight.changeKg != null && summary.weight.hasPreviousCheckIn && (
                            <p className={cn("text-xs font-bold flex items-center gap-1", summary.weight.towardGoal ? "text-success" : summary.weight.towardGoal === false ? "text-red-400" : "text-fg-muted")}>
                                <WeightIcon className="w-3.5 h-3.5" />
                                {summary.weight.changeKg > 0 ? "+" : ""}{summary.weight.changeKg.toFixed(1)} kg since last check-in
                            </p>
                        )}
                        <p className="text-xs text-fg-muted leading-relaxed">{summary.weight.detail}</p>
                    </div>
                )}

                {summary.calories && (
                    <LifestyleMetricBlock
                        title="Calories"
                        unit="kcal"
                        icon={Flame}
                        metric={summary.calories}
                        formatValue={formatCalories}
                    />
                )}

                {summary.steps && (
                    <LifestyleMetricBlock
                        title="Steps"
                        unit=""
                        icon={Footprints}
                        metric={summary.steps}
                        formatValue={(value) => Math.round(value).toLocaleString()}
                    />
                )}

                {summary.sleep && (
                    <LifestyleMetricBlock
                        title="Sleep"
                        unit="hrs"
                        icon={Moon}
                        metric={summary.sleep}
                        formatValue={(value) => value.toFixed(1)}
                    />
                )}
            </div>

            {!compact && (
                <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 px-4 py-4 space-y-3 text-sm text-fg leading-relaxed">
                    <p className="font-bold text-fg">{summary.overallHeadline}</p>
                    <OverviewList title="What's going well" items={summary.overallProgress} />
                    <OverviewList title="Needs attention" items={summary.overallAttention} />
                    {summary.overallUnassessed.length > 0 && (
                        <p className="text-xs text-fg-muted">
                            Not enough data yet: {summary.overallUnassessed.join(", ")}.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
