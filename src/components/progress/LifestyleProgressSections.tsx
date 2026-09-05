"use client";

import { useState } from "react";
import {
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    CartesianGrid,
} from "recharts";
import { Flame, Footprints, Moon, TrendingDown, TrendingUp } from "lucide-react";
import { cn, toDateKey } from "@/lib/utils";
import { useCurrentDate } from "@/hooks/useCurrentDate";
import {
    summarizeLifestylePeriod,
    percentDelta,
    numericDelta,
    formatLifestyleLoggedCount,
    type LifestyleMetricKey,
} from "@/lib/lifestylePeriodMetrics";
import { periodWindow, previousPeriodWindow } from "@/lib/coachClientPeriodStats";
type HistoryPoint = { date: string; dateKey: string; value: number | null };

export interface LifestyleProgressMetric {
    current: number | null;
    target: number | null;
    weeklyAverage: number | null;
    previousWeeklyAverage: number | null;
    history: HistoryPoint[];
}

const PERIODS = [
    { days: 7 as const, label: "Week" },
    { days: 30 as const, label: "Month" },
    { days: 365 as const, label: "Year" },
];

const METRIC_UI: Record<LifestyleMetricKey, {
    title: string;
    unit: string;
    color: string;
    icon: typeof Flame;
    format: (value: number) => string;
}> = {
    calories: {
        title: "Calories",
        unit: "kcal",
        color: "#F59E0B",
        icon: Flame,
        format: (value) => Math.round(value).toLocaleString(),
    },
    steps: {
        title: "Steps",
        unit: "steps",
        color: "#38BDF8",
        icon: Footprints,
        format: (value) => Math.round(value).toLocaleString(),
    },
    sleep: {
        title: "Sleep",
        unit: "hrs",
        color: "#A78BFA",
        icon: Moon,
        format: (value) => value.toFixed(1),
    },
};

function LifestyleMetricSection({
    metricKey,
    data,
    days,
    onDaysChange,
    todayKey,
}: {
    metricKey: LifestyleMetricKey;
    data: LifestyleProgressMetric;
    days: 7 | 30 | 365;
    onDaysChange: (days: 7 | 30 | 365) => void;
    todayKey: string;
}) {
    const ui = METRIC_UI[metricKey];
    const Icon = ui.icon;
    const window = periodWindow(todayKey, days);
    const previous = previousPeriodWindow(window.startDateKey, days);

    const currentRows = data.history
        .filter((row) => row.dateKey >= window.startDateKey && row.dateKey <= window.endDateKey)
        .filter((row) => typeof row.value === "number")
        .map((row) => ({
            date: row.dateKey,
            calories: metricKey === "calories" ? row.value : null,
            steps: metricKey === "steps" ? row.value : null,
            sleepHours: metricKey === "sleep" ? row.value : null,
        }));
    const previousRows = data.history
        .filter((row) => row.dateKey >= previous.startDateKey && row.dateKey <= previous.endDateKey)
        .filter((row) => typeof row.value === "number")
        .map((row) => ({
            date: row.dateKey,
            calories: metricKey === "calories" ? row.value : null,
            steps: metricKey === "steps" ? row.value : null,
            sleepHours: metricKey === "sleep" ? row.value : null,
        }));

    const current = summarizeLifestylePeriod(
        currentRows,
        {
            targetCalories: metricKey === "calories" ? data.target : null,
            targetSteps: metricKey === "steps" ? data.target : null,
            targetSleepHours: metricKey === "sleep" ? data.target : null,
        },
        days
    )[metricKey];
    const previousSummary = summarizeLifestylePeriod(
        previousRows,
        {
            targetCalories: metricKey === "calories" ? data.target : null,
            targetSteps: metricKey === "steps" ? data.target : null,
            targetSleepHours: metricKey === "sleep" ? data.target : null,
        },
        days
    )[metricKey];

    const chartData = data.history
        .filter((row) => row.dateKey >= window.startDateKey && row.dateKey <= window.endDateKey)
        .filter((row) => typeof row.value === "number")
        .map((row) => ({ date: row.date, value: row.value as number }));

    const delta = numericDelta(current.average, previousSummary.average);
    const deltaPct = percentDelta(current.average, previousSummary.average);

    return (
        <section className="card p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
                <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-5 h-5 text-brand-400 shrink-0" />
                    <div className="min-w-0">
                        <p className="text-[10px] font-black text-fg-subtle uppercase tracking-widest">{ui.title}</p>
                        <div className="flex items-end gap-2 flex-wrap">
                            <h3 className="text-3xl font-black text-fg tracking-tighter leading-none">
                                {current.average != null ? ui.format(current.average) : "No data"}
                                {current.average != null && (
                                    <span className="text-sm font-bold text-fg-muted ml-1">{ui.unit}</span>
                                )}
                            </h3>
                            {delta != null && delta !== 0 && (
                                <span className={cn(
                                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-black mb-0.5",
                                    delta > 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                                )}>
                                    {delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    {delta > 0 ? "+" : ""}{metricKey === "sleep" ? delta.toFixed(1) : Math.round(delta).toLocaleString()}
                                    {deltaPct != null ? ` (${deltaPct > 0 ? "+" : ""}${deltaPct}%)` : ""} vs previous
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-fg-muted mt-1.5">
                            {data.target != null ? (
                                <>Goal <span className="font-bold text-fg">{ui.format(data.target)} {ui.unit}</span></>
                            ) : (
                                "No goal set"
                            )}
                            <span className="mx-1 text-fg-subtle">·</span>
                            {formatLifestyleLoggedCount(current.loggedDays, current.expectedDays)}
                            <span className="mx-1 text-fg-subtle">·</span>
                            {current.adherencePercent != null
                                ? `${current.adherencePercent}% hit`
                                : "No data"}
                            {current.assessment && (
                                <>
                                    <span className="mx-1 text-fg-subtle">·</span>
                                    {current.assessment}
                                </>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex bg-surface-muted p-1 rounded-xl self-start">
                    {PERIODS.map((period) => (
                        <button
                            key={period.days}
                            type="button"
                            onClick={() => onDaysChange(period.days)}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                days === period.days ? "bg-surface-card text-brand-400 shadow-sm" : "text-fg-subtle hover:text-fg"
                            )}
                        >
                            {period.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-[220px] w-full">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                            <XAxis dataKey="date" stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip
                                formatter={(value) => [`${ui.format(Number(value ?? 0))} ${ui.unit}`, ui.title]}
                                contentStyle={{ backgroundColor: "#0F172A", borderRadius: "12px", border: "1px solid #1E293B" }}
                                labelStyle={{ color: "#6B7280", fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}
                            />
                            {data.target != null && (
                                <ReferenceLine
                                    y={data.target}
                                    stroke="#EF4444"
                                    strokeDasharray="4 4"
                                    strokeWidth={2}
                                />
                            )}
                            <Line
                                type="monotone"
                                dataKey="value"
                                name={ui.title}
                                stroke={ui.color}
                                strokeWidth={3}
                                dot={{ r: 3, fill: ui.color, strokeWidth: 0 }}
                                connectNulls={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full rounded-xl border border-dashed border-surface-border bg-surface-muted/20 flex items-center justify-center text-[10px] font-bold text-fg-subtle">
                        Log {ui.title.toLowerCase()} to build the chart
                    </div>
                )}
            </div>
        </section>
    );
}

export function LifestyleProgressSections({
    visibleKeys,
    calories,
    steps,
    sleep,
}: {
    visibleKeys: LifestyleMetricKey[];
    calories?: LifestyleProgressMetric | null;
    steps?: LifestyleProgressMetric | null;
    sleep?: LifestyleProgressMetric | null;
}) {
    const todayKey = toDateKey(useCurrentDate());
    const [days, setDays] = useState<7 | 30 | 365>(30);
    const byKey = { calories, steps, sleep };

    if (visibleKeys.length === 0) return null;

    return (
        <div className="space-y-5">
            <h2 className="text-xs font-black text-fg-subtle uppercase tracking-[0.2em] flex items-center gap-2">
                <Flame className="w-4 h-4 text-brand-400" />
                Lifestyle
            </h2>
            {visibleKeys.map((key) => {
                const metric = byKey[key];
                if (!metric) return null;
                return (
                    <LifestyleMetricSection
                        key={key}
                        metricKey={key}
                        data={metric}
                        days={days}
                        onDaysChange={setDays}
                        todayKey={todayKey}
                    />
                );
            })}
        </div>
    );
}
