"use client";

import type { ReactNode } from "react";
import { Activity, Edit3, Flame, Footprints, Moon, X } from "lucide-react";
import type { CoachProfilePeriodSnapshot } from "@/lib/coachClientProfileData";
import { formatLifestyleLoggedCount } from "@/lib/lifestylePeriodMetrics";
import { cn } from "@/lib/utils";
import { DeltaLine, PeriodToggle, formatKg, missingLabel } from "./profileUi";
import type { CoachProfilePeriodKey } from "@/lib/coachClientPeriodStats";
import { formatLastTrained } from "./ProfileTopSections";

function MetricCell({
    label,
    value,
    suffix,
    children,
}: {
    label: string;
    value: string;
    suffix?: string;
    children?: ReactNode;
}) {
    return (
        <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">{label}</p>
            <p className="text-xl font-black text-fg leading-none italic mt-1">
                {value}
                {suffix && <span className="text-xs text-brand-400 ml-0.5 font-sans not-italic">{suffix}</span>}
            </p>
            {children}
        </div>
    );
}

export function CoachSummaryCard({
    period,
    periodKey,
    onPeriodChange,
    streak,
    weightDirection,
}: {
    period: CoachProfilePeriodSnapshot;
    periodKey: CoachProfilePeriodKey;
    onPeriodChange: (key: CoachProfilePeriodKey) => void;
    streak: number | null;
    weightDirection: "GAINING" | "LOSING" | "MAINTAINING" | null;
}) {
    return (
        <section className="card p-5 border-brand-500/20 bg-gradient-brand/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">Coach Summary</p>
                    <p className="text-xs text-fg-muted mt-0.5">{period.label}</p>
                </div>
                <PeriodToggle value={periodKey} onChange={onPeriodChange} />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
                <MetricCell
                    label="Training adherence"
                    value={missingLabel(period.trainingAdherencePercent)}
                    suffix={period.trainingAdherencePercent != null ? "%" : undefined}
                >
                    <DeltaLine
                        value={period.vsPrevious.trainingAdherencePercent}
                        previousLabel={period.previousLabel}
                        suffix=" pts"
                        digits={0}
                    />
                </MetricCell>
                <MetricCell
                    label="Workouts"
                    value={period.workoutsScheduled > 0
                        ? `${period.workoutsCompleted} / ${period.workoutsScheduled}`
                        : missingLabel(period.workoutsCompleted > 0 ? period.workoutsCompleted : null)}
                />
                <MetricCell label="Bodyweight" value={formatKg(period.bodyweightCurrentKg)}>
                    <DeltaLine
                        value={period.bodyweightChangeKg}
                        previousLabel="this period"
                        suffix=" kg"
                        invertColor={weightDirection === "LOSING"}
                        neutral={weightDirection == null || weightDirection === "MAINTAINING"}
                    />
                </MetricCell>
                <MetricCell
                    label="Check-ins"
                    value={period.checkInExpected != null
                        ? `${period.checkInSubmitted} / ${period.checkInExpected}`
                        : period.checkInSubmitted > 0
                            ? String(period.checkInSubmitted)
                            : "—"}
                />
                <MetricCell
                    label="Training streak"
                    value={missingLabel(streak)}
                    suffix={streak != null ? "d" : undefined}
                />
                <MetricCell label="PRs" value={missingLabel(period.prCount)}>
                    <DeltaLine value={period.vsPrevious.prCount} previousLabel={period.previousLabel} digits={0} />
                </MetricCell>
                <MetricCell
                    label="Avg duration"
                    value={missingLabel(period.avgDurationMin)}
                    suffix={period.avgDurationMin != null ? "m" : undefined}
                />
                <MetricCell label="Last trained" value={formatLastTrained(period.lastTrainedAt)} />
            </div>
        </section>
    );
}

function LifestyleCard({
    title,
    icon,
    average,
    target,
    unit,
    adherence,
    logged,
    expected,
    assessment,
    delta,
    previousLabel,
    neutral = false,
}: {
    title: string;
    icon: ReactNode;
    average: number | null;
    target: number | null;
    unit: string;
    adherence: number | null;
    logged: number;
    expected: number;
    assessment: string | null;
    delta: number | null;
    previousLabel: string;
    neutral?: boolean;
}) {
    const hasLogs = logged > 0;
    const formatValue = (value: number | null) => {
        if (value == null) return "No data";
        if (unit === "kcal" || unit === "steps") return Math.round(value).toLocaleString();
        return value.toFixed(1);
    };
    const loggedLine = formatLifestyleLoggedCount(logged, expected);
    const [loggedCount, loggingRate] = loggedLine.split(" · ");

    return (
        <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2 text-brand-400">
                {icon}
                <h4 className="text-[10px] font-black uppercase tracking-widest">{title}</h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Avg</p>
                    <p className={cn(
                        "text-lg font-black leading-none",
                        hasLogs && average != null ? "text-fg" : "text-fg-muted"
                    )}>
                        {hasLogs ? formatValue(average) : "No data"}
                    </p>
                </div>
                <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Goal</p>
                    <p className="text-lg font-black text-fg leading-none">
                        {target == null ? "—" : formatValue(target)}
                    </p>
                </div>
                <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Hit</p>
                    <p className={cn(
                        "text-lg font-black leading-none",
                        hasLogs && adherence != null ? "text-fg" : "text-fg-muted"
                    )}>
                        {hasLogs && adherence != null ? `${adherence}%` : "No data"}
                    </p>
                </div>
                <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Logged</p>
                    <p className="text-lg font-black text-fg leading-none">
                        {loggedCount}
                        <span className="text-[10px] font-bold text-fg-subtle ml-1">· {loggingRate}</span>
                    </p>
                </div>
            </div>
            {assessment && <p className="text-xs text-fg-muted font-semibold">{assessment}</p>}
            <DeltaLine value={delta} previousLabel={previousLabel} suffix={unit === "hrs" ? " hrs" : ""} digits={unit === "hrs" ? 1 : 0} neutral={neutral} />
        </div>
    );
}

export function LifestyleProgressSection({
    period,
    canEdit = false,
    isEditingGoals = false,
    onToggleEditGoals,
    goalsEditor,
}: {
    period: CoachProfilePeriodSnapshot;
    canEdit?: boolean;
    isEditingGoals?: boolean;
    onToggleEditGoals?: () => void;
    goalsEditor?: ReactNode;
}) {
    const { lifestyle, vsPrevious, previousLabel } = period;
    return (
        <section className="space-y-3">
            <div className="px-1 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-brand-400 flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5" />
                        Lifestyle Progress
                    </h3>
                    <p className="text-xs text-fg-muted mt-1">
                        Same daily metrics the client logs on Dashboard. Missing days are omitted.
                    </p>
                </div>
                {canEdit && onToggleEditGoals && (
                    <button
                        type="button"
                        onClick={onToggleEditGoals}
                        className="text-brand-400 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 shrink-0 pt-0.5"
                    >
                        {isEditingGoals
                            ? <><X className="w-3 h-3" /> Cancel</>
                            : <><Edit3 className="w-3 h-3" /> Edit Goals</>}
                    </button>
                )}
            </div>
            {goalsEditor}
            <div className="grid md:grid-cols-3 gap-4">
                <LifestyleCard
                    title="Calories"
                    icon={<Flame className="w-3.5 h-3.5" />}
                    average={lifestyle.calories.average}
                    target={lifestyle.calories.target}
                    unit="kcal"
                    adherence={lifestyle.calories.adherencePercent}
                    logged={lifestyle.calories.loggedDays}
                    expected={lifestyle.calories.expectedDays}
                    assessment={lifestyle.calories.assessment}
                    delta={vsPrevious.caloriesAverage}
                    previousLabel={previousLabel}
                    neutral
                />
                <LifestyleCard
                    title="Steps"
                    icon={<Footprints className="w-3.5 h-3.5" />}
                    average={lifestyle.steps.average}
                    target={lifestyle.steps.target}
                    unit="steps"
                    adherence={lifestyle.steps.adherencePercent}
                    logged={lifestyle.steps.loggedDays}
                    expected={lifestyle.steps.expectedDays}
                    assessment={lifestyle.steps.assessment}
                    delta={vsPrevious.stepsAverage}
                    previousLabel={previousLabel}
                />
                <LifestyleCard
                    title="Sleep"
                    icon={<Moon className="w-3.5 h-3.5" />}
                    average={lifestyle.sleep.average}
                    target={lifestyle.sleep.target}
                    unit="hrs"
                    adherence={lifestyle.sleep.adherencePercent}
                    logged={lifestyle.sleep.loggedDays}
                    expected={lifestyle.sleep.expectedDays}
                    assessment={lifestyle.sleep.assessment}
                    delta={vsPrevious.sleepAverage}
                    previousLabel={previousLabel}
                />
            </div>
        </section>
    );
}
