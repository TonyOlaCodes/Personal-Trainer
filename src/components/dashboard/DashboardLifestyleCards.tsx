"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Flame, Footprints, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { type LifestyleMetricKey } from "@/lib/lifestylePeriodMetrics";
import {
    lifestyleDashboardGridClass,
    lifestyleGoalDistanceText,
    lifestyleMetricInputPlaceholder,
} from "@/lib/lifestyleDashboardVisibility";

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
}> = [
    {
        key: "calories",
        field: "calories",
        targetField: "targetCalories",
        label: "Calories",
        unit: "kcal",
        step: "1",
        icon: Flame,
        format: (value) => Math.round(value).toLocaleString("en-GB"),
    },
    {
        key: "steps",
        field: "steps",
        targetField: "targetSteps",
        label: "Steps",
        unit: "steps",
        step: "1",
        icon: Footprints,
        format: (value) => Math.round(value).toLocaleString("en-GB"),
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
    },
];

function unloggedHint(metric: (typeof METRICS)[number], target: number | null): string {
    return target != null ? `Goal ${metric.format(target)} ${metric.unit}` : "Tap to log today";
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
                    const placeholder = lifestyleMetricInputPlaceholder(metric.key, target);
                    const goalDistance = lifestyleGoalDistanceText(metric.key, loggedValue, target);
                    const statusLine = logged
                        ? (goalDistance ?? "Logged today")
                        : unloggedHint(metric, target);

                    return (
                        <div
                            key={metric.key}
                            className={cn(
                                "card px-2 py-2 sm:px-2.5 sm:py-2 flex flex-col justify-center gap-0.5 transition-all relative overflow-hidden min-w-0 min-h-[58px]",
                                logged
                                    ? "bg-success/10 border-success/30 shadow-glow-success-sm"
                                    : "bg-surface-muted/10 border-brand-500/10 hover:border-brand-500/30"
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
                                logged ? "text-success" : "text-fg-subtle"
                            )}>
                                {statusLine}
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
