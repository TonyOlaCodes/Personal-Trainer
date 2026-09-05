"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Flame, Footprints, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    isCaloriesOnTarget,
    isSleepOnTarget,
    isStepsOnTarget,
    type LifestyleMetricKey,
} from "@/lib/lifestylePeriodMetrics";
import { lifestyleDashboardGridClass, lifestyleMetricInputPlaceholder } from "@/lib/lifestyleDashboardVisibility";

export interface DashboardLifestyleValues {
    calories: number | null;
    steps: number | null;
    sleepHours: number | null;
}

export interface DashboardLifestyleTargets {
    targetCalories: number | null;
    targetSteps: number | null;
    targetSleepHours: number | null;
}

const METRICS: Array<{
    key: LifestyleMetricKey;
    field: keyof DashboardLifestyleValues;
    targetField: keyof DashboardLifestyleTargets;
    label: string;
    unit: string;
    step: string;
    icon: typeof Flame;
    format: (value: number) => string;
    onTarget: (value: number, target: number) => boolean;
}> = [
    {
        key: "calories",
        field: "calories",
        targetField: "targetCalories",
        label: "Calories",
        unit: "kcal",
        step: "1",
        icon: Flame,
        format: (value) => Math.round(value).toLocaleString(),
        onTarget: isCaloriesOnTarget,
    },
    {
        key: "steps",
        field: "steps",
        targetField: "targetSteps",
        label: "Steps",
        unit: "steps",
        step: "1",
        icon: Footprints,
        format: (value) => Math.round(value).toLocaleString(),
        onTarget: isStepsOnTarget,
    },
    {
        key: "sleep",
        field: "sleepHours",
        targetField: "targetSleepHours",
        label: "Sleep",
        unit: "hrs",
        step: "0.1",
        icon: Moon,
        format: (value) => value.toFixed(1),
        onTarget: isSleepOnTarget,
    },
];

function formatGoal(metric: (typeof METRICS)[number], target: number): string {
    return `Goal ${metric.format(target)} ${metric.unit}`;
}

function statusText(
    logged: boolean,
    value: number | null,
    target: number | null,
    metric: (typeof METRICS)[number]
): string {
    if (!logged || value == null) {
        return target != null ? formatGoal(metric, target) : "Tap to log today";
    }
    if (target == null) return "Logged today";
    const status = metric.onTarget(value, target) ? "On target" : "Off target";
    return `${status} · ${formatGoal(metric, target)}`;
}

export function DashboardLifestyleCards({
    date,
    visibleKeys,
    initialValues,
    targets,
}: {
    date: string;
    visibleKeys: LifestyleMetricKey[];
    initialValues: DashboardLifestyleValues;
    targets: DashboardLifestyleTargets;
}) {
    const [values, setValues] = useState(initialValues);
    const [drafts, setDrafts] = useState<Record<LifestyleMetricKey, string>>({
        calories: initialValues.calories != null ? String(initialValues.calories) : "",
        steps: initialValues.steps != null ? String(initialValues.steps) : "",
        sleep: initialValues.sleepHours != null ? initialValues.sleepHours.toFixed(1) : "",
    });
    const [savingKey, setSavingKey] = useState<LifestyleMetricKey | null>(null);

    useEffect(() => {
        setValues(initialValues);
        setDrafts({
            calories: initialValues.calories != null ? String(initialValues.calories) : "",
            steps: initialValues.steps != null ? String(initialValues.steps) : "",
            sleep: initialValues.sleepHours != null ? initialValues.sleepHours.toFixed(1) : "",
        });
    }, [date, initialValues.calories, initialValues.steps, initialValues.sleepHours]);

    const cards = useMemo(
        () => METRICS.filter((metric) => visibleKeys.includes(metric.key)),
        [visibleKeys]
    );

    if (cards.length === 0) return null;

    const saveMetric = async (metric: (typeof METRICS)[number]) => {
        const raw = drafts[metric.key].trim();
        if (raw === "") return;
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed < 0) return;

        const current = values[metric.field];
        if (current != null && Number(current) === parsed) return;

        setSavingKey(metric.key);
        try {
            const res = await fetch("/api/daily-metrics", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date,
                    [metric.field]: parsed,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return;

            const selected = data.selected as DashboardLifestyleValues | undefined;
            if (selected) {
                setValues({
                    calories: selected.calories,
                    steps: selected.steps,
                    sleepHours: selected.sleepHours,
                });
                setDrafts({
                    calories: selected.calories != null ? String(selected.calories) : "",
                    steps: selected.steps != null ? String(selected.steps) : "",
                    sleep: selected.sleepHours != null ? selected.sleepHours.toFixed(1) : "",
                });
            } else {
                setValues((prev) => ({ ...prev, [metric.field]: parsed }));
            }
        } finally {
            setSavingKey(null);
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 pt-1">
                <Flame className="w-4 h-4 text-brand-400" />
                <h3 className="text-sm font-black uppercase tracking-widest text-fg">Lifestyle</h3>
            </div>
            <div
                className={cn(
                    lifestyleDashboardGridClass(cards.length),
                    "gap-1.5 sm:gap-2",
                    cards.length === 1 && "max-w-[13.5rem] sm:max-w-xs"
                )}
            >
                {cards.map((metric) => {
                    const Icon = metric.icon;
                    const loggedValue = values[metric.field];
                    const logged = loggedValue != null;
                    const target = targets[metric.targetField];
                    const onTarget = logged && target != null && metric.onTarget(loggedValue, target);
                    const placeholder = lifestyleMetricInputPlaceholder(metric.key, target);

                    return (
                        <div
                            key={metric.key}
                            className={cn(
                                "card px-2 py-2 sm:px-2.5 sm:py-2 flex flex-col justify-center gap-0.5 transition-all relative overflow-hidden min-w-0 min-h-[58px]",
                                logged
                                    ? onTarget
                                        ? "bg-success/10 border-success/30 shadow-glow-success-sm"
                                        : "bg-surface-muted/10 border-brand-500/20"
                                    : "bg-surface-muted/10 border-brand-500/10"
                            )}
                        >
                            <div className="flex items-center gap-1 min-w-0">
                                {logged
                                    ? <Check className="w-3 h-3 text-success shrink-0" />
                                    : <Icon className="w-3 h-3 text-brand-400 shrink-0" />}
                                <p className={cn(
                                    "text-[8px] font-black tracking-widest uppercase truncate",
                                    logged ? "text-success" : "text-fg-subtle"
                                )}>
                                    {metric.label}
                                </p>
                            </div>
                            <div className="flex items-baseline gap-1 min-w-0">
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    step={metric.step}
                                    value={drafts[metric.key]}
                                    onChange={(e) => {
                                        const next = e.target.value;
                                        setDrafts((prev) => ({ ...prev, [metric.key]: next }));
                                    }}
                                    onBlur={() => void saveMetric(metric)}
                                    className="w-full min-w-0 bg-transparent text-sm sm:text-base font-black text-fg placeholder:text-fg-subtle/70 placeholder:font-bold focus:outline-none focus:text-brand-400 transition-colors"
                                    placeholder={logged ? undefined : placeholder}
                                    aria-label={`Today's ${metric.label.toLowerCase()}`}
                                />
                                {logged && (
                                    <span className="text-[9px] font-semibold text-fg-muted uppercase shrink-0">{metric.unit}</span>
                                )}
                            </div>
                            <p className={cn(
                                "text-[9px] font-bold truncate",
                                logged
                                    ? onTarget ? "text-success" : "text-fg-muted"
                                    : "text-fg-subtle"
                            )}>
                                {statusText(logged, loggedValue, target, metric)}
                            </p>
                            {savingKey === metric.key && (
                                <div className="absolute top-1.5 right-1.5">
                                    <div className="w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
