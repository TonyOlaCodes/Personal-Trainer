"use client";

import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    computeComplianceForMonth,
    computeMonthlyCompliance,
    computeWeeklyCompliance,
    complianceTone,
    isSameCalendarMonth,
    type CalendarComplianceInput,
} from "@/lib/calendarCompliance";
import type { CalendarView } from "@/app/(app)/calendar/CalendarClient";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

function ComplianceCard({
    label,
    sublabel,
    completed,
    due,
    percent,
}: {
    label: string;
    sublabel: string;
    completed: number;
    due: number;
    percent: number | null;
}) {
    const tone = complianceTone(percent);
    const cardClass = {
        success: "border-success/30 bg-success/5",
        warning: "border-warning/30 bg-warning/5",
        danger: "border-danger/30 bg-danger/5",
        muted: "border-surface-border bg-surface-muted/20",
    }[tone];
    const valueClass = {
        success: "text-success",
        warning: "text-warning",
        danger: "text-danger",
        muted: "text-fg-subtle",
    }[tone];

    return (
        <div className={cn("card border p-3 sm:p-4 min-w-0", cardClass)}>
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                <TrendingUp className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0", valueClass)} />
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-fg-subtle truncate">
                    {label}
                </span>
            </div>
            <p className={cn("text-2xl sm:text-3xl font-black tabular-nums", valueClass)}>
                {percent !== null ? `${percent}%` : "—"}
            </p>
            <p className="text-[9px] sm:text-[10px] text-fg-muted font-bold mt-0.5 leading-tight">
                {due > 0 ? `${completed}/${due} workouts` : "No sessions due yet"} · {sublabel}
            </p>
        </div>
    );
}

interface CalendarComplianceSummaryProps {
    complianceInput: CalendarComplianceInput;
    calendarView: CalendarView;
    now: Date;
    /** Coach view waits on today&apos;s log before counting today in %. */
    excludeTodayUntilLogged?: boolean;
}

export function CalendarComplianceSummary({
    complianceInput,
    calendarView,
    now,
    excludeTodayUntilLogged = false,
}: CalendarComplianceSummaryProps) {
    const complianceOptions = excludeTodayUntilLogged
        ? ({ excludeTodayUntilLogged: true } as const)
        : undefined;

    const isViewingCurrentMonth = isSameCalendarMonth(now, calendarView.year, calendarView.month);

    const weekCompliance = useMemo(
        () => computeWeeklyCompliance(complianceInput, now, complianceOptions),
        [complianceInput, now, complianceOptions]
    );

    const monthCompliance = useMemo(
        () => computeMonthlyCompliance(complianceInput, now, complianceOptions),
        [complianceInput, now, complianceOptions]
    );

    const viewedMonthCompliance = useMemo(
        () => computeComplianceForMonth(
            complianceInput,
            calendarView.year,
            calendarView.month,
            now,
            complianceOptions
        ),
        [complianceInput, calendarView.year, calendarView.month, now, complianceOptions]
    );

    if (!complianceInput.activePlan || !complianceInput.planStartedAt) {
        return null;
    }

    if (isViewingCurrentMonth) {
        return (
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <ComplianceCard
                    label="This Week"
                    sublabel="Mon–Sun this week"
                    completed={weekCompliance.completed}
                    due={weekCompliance.due}
                    percent={weekCompliance.percent}
                />
                <ComplianceCard
                    label="This Month"
                    sublabel="All sessions this month"
                    completed={monthCompliance.completed}
                    due={monthCompliance.due}
                    percent={monthCompliance.percent}
                />
            </div>
        );
    }

    return (
        <ComplianceCard
            label={`${MONTHS[calendarView.month]} ${calendarView.year}`}
            sublabel="Workouts done in month"
            completed={viewedMonthCompliance.completed}
            due={viewedMonthCompliance.due}
            percent={viewedMonthCompliance.percent}
        />
    );
}
