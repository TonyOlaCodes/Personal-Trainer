"use client";

import { useMemo, type ReactNode } from "react";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    computeComplianceForMonth,
    complianceTone,
    isFutureCalendarMonth,
    isSameCalendarMonth,
    type CalendarComplianceInput,
} from "@/lib/calendarCompliance";
import type { CalendarView } from "@/app/(app)/calendar/CalendarClient";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

interface CalendarComplianceSummaryProps {
    complianceInput: CalendarComplianceInput;
    calendarView: CalendarView;
    now: Date;
}

export function CalendarComplianceSummary({
    complianceInput,
    calendarView,
    now,
}: CalendarComplianceSummaryProps) {
    const isViewingCurrentMonth = isSameCalendarMonth(now, calendarView.year, calendarView.month);
    const isViewingFutureMonth = isFutureCalendarMonth(now, calendarView.year, calendarView.month);

    const monthCompliance = useMemo(
        () => computeComplianceForMonth(
            complianceInput,
            calendarView.year,
            calendarView.month,
            now
        ),
        [complianceInput, calendarView.year, calendarView.month, now]
    );

    if (!complianceInput.activePlan || !complianceInput.planStartedAt) {
        return null;
    }

    const percent = isViewingFutureMonth ? null : monthCompliance.percent;
    const completed = isViewingFutureMonth ? 0 : monthCompliance.completed;
    const due = isViewingFutureMonth ? 0 : monthCompliance.due;
    const tone = complianceTone(percent);

    const label = isViewingCurrentMonth
        ? "This Month"
        : `${MONTHS[calendarView.month]} ${calendarView.year}`;

    const cardClass = {
        success: "border-success/25 bg-success/[0.04]",
        warning: "border-warning/25 bg-warning/[0.04]",
        danger: "border-danger/25 bg-danger/[0.04]",
        muted: "border-surface-border bg-surface-muted/20",
    }[tone];
    const valueClass = {
        success: "text-success",
        warning: "text-warning",
        danger: "text-danger",
        muted: "text-fg-subtle",
    }[tone];

    let primary: ReactNode;
    let sublabel: string;

    if (due <= 0) {
        primary = <span className={valueClass}>—</span>;
        sublabel = isViewingFutureMonth
            ? "No sessions due yet"
            : "No scheduled workouts this month";
    } else if (isViewingCurrentMonth) {
        primary = (
            <>
                <span className={valueClass}>{completed}</span>
                <span className="text-lg sm:text-xl font-bold text-fg-muted">/{due}</span>
            </>
        );
        sublabel = `${percent}% so far this month`;
    } else {
        primary = <span className={valueClass}>{percent}%</span>;
        sublabel = `${completed}/${due} workouts completed`;
    }

    return (
        <div className={cn("card border p-3 sm:p-4 min-w-0", cardClass)}>
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                <TrendingUp className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0", valueClass)} />
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-fg-subtle truncate">
                    {label}
                </span>
            </div>
            <p className="text-2xl sm:text-3xl font-black tabular-nums text-fg">
                {primary}
            </p>
            <p
                className={cn(
                    "text-[9px] sm:text-[10px] font-bold mt-0.5 leading-tight",
                    due > 0 && percent !== null ? valueClass : "text-fg-muted"
                )}
            >
                {sublabel}
            </p>
        </div>
    );
}
