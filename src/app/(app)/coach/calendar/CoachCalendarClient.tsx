"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, UserCircle, TrendingUp } from "lucide-react";
import { CalendarClient, type CalendarView } from "@/app/(app)/calendar/CalendarClient";
import { cn, toDateKey } from "@/lib/utils";
import { useCurrentDate } from "@/hooks/useCurrentDate";
import type { ClientCalendarPayload } from "@/lib/clientCalendarData";
import {
    computeComplianceForMonth,
    computeMonthlyCompliance,
    computeWeeklyCompliance,
    complianceTone,
    hasPendingTodayWorkout,
    isFutureCalendarMonth,
    isSameCalendarMonth,
} from "@/lib/calendarCompliance";
import Link from "next/link";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

interface ClientOption {
    id: string;
    name: string;
    hasActivePlan: boolean;
}

interface Props {
    clients: ClientOption[];
    selectedClientId: string | null;
    selectedClientName: string;
    calendar: ClientCalendarPayload | null;
}

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
        <div className={cn("card p-4 border", cardClass)}>
            <div className="flex items-center gap-2 mb-1">
                <TrendingUp className={cn("w-4 h-4", valueClass)} />
                <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">{label}</span>
            </div>
            <p className={cn("text-3xl font-black tabular-nums", valueClass)}>
                {percent !== null ? `${percent}%` : "—"}
            </p>
            <p className="text-[10px] text-fg-muted font-bold mt-0.5">
                {due > 0 ? `${completed}/${due} workouts` : "No sessions due yet"} · {sublabel}
            </p>
        </div>
    );
}

export function CoachCalendarClient({ clients, selectedClientId, selectedClientName, calendar }: Props) {
    const router = useRouter();
    const now = useCurrentDate();
    const todayKey = toDateKey(now);
    const prevTodayKeyRef = useRef(todayKey);

    const [calendarView, setCalendarView] = useState<CalendarView>(() => {
        const [y, m] = todayKey.split("-").map(Number);
        return { year: y, month: m - 1 };
    });

    useEffect(() => {
        const prevTodayKey = prevTodayKeyRef.current;
        if (prevTodayKey === todayKey) return;
        prevTodayKeyRef.current = todayKey;

        setCalendarView((current) => {
            const [prevYear, prevMonth] = prevTodayKey.split("-").map(Number);
            const [ty, tm] = todayKey.split("-").map(Number);
            if (current.year === prevYear && current.month === prevMonth - 1) {
                return { year: ty, month: tm - 1 };
            }
            return current;
        });
    }, [todayKey]);

    const complianceInput = useMemo(
        () => ({
            activePlan: calendar?.activePlan ?? null,
            planStartedAt: calendar?.planStartedAt ?? null,
            loggedDates: calendar?.loggedDates ?? [],
        }),
        [calendar]
    );

    const complianceOptions = { excludeTodayUntilLogged: true } as const;
    const isViewingCurrentMonth = isSameCalendarMonth(now, calendarView.year, calendarView.month);
    const isViewingFutureMonth = isFutureCalendarMonth(now, calendarView.year, calendarView.month);

    const weekCompliance = useMemo(
        () => computeWeeklyCompliance(complianceInput, now, complianceOptions),
        [complianceInput, now]
    );

    const monthCompliance = useMemo(
        () => computeMonthlyCompliance(complianceInput, now, complianceOptions),
        [complianceInput, now]
    );

    const viewedMonthCompliance = useMemo(
        () => computeComplianceForMonth(
            complianceInput,
            calendarView.year,
            calendarView.month,
            now,
            complianceOptions
        ),
        [complianceInput, calendarView.year, calendarView.month, now]
    );

    const pendingToday = useMemo(
        () => hasPendingTodayWorkout(complianceInput, now),
        [complianceInput, now]
    );

    const onClientChange = (clientId: string) => {
        router.push(`/coach/calendar?clientId=${encodeURIComponent(clientId)}`);
    };

    if (clients.length === 0) {
        return (
            <div className="card p-10 text-center space-y-4">
                <UserCircle className="w-12 h-12 text-fg-subtle mx-auto opacity-40" />
                <h3 className="text-lg font-black text-fg">No clients yet</h3>
                <p className="text-sm text-fg-muted max-w-sm mx-auto">
                    Invite clients from the Coach Panel to view their training calendars here.
                </p>
                <Link href="/coach/invites" className="btn-primary inline-flex">
                    Invite Clients
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
                <div className="space-y-1">
                    <p className="text-[10px] font-black tracking-[0.2em] text-brand-400 uppercase">Client Schedule</p>
                    <h2 className="text-2xl font-black text-fg tracking-tight">{selectedClientName}</h2>
                </div>
                <div className="relative min-w-[200px] max-w-xs">
                    <label htmlFor="coach-calendar-client" className="sr-only">Select client</label>
                    <select
                        id="coach-calendar-client"
                        value={selectedClientId ?? ""}
                        onChange={(e) => onClientChange(e.target.value)}
                        className="w-full appearance-none pl-4 pr-10 py-3 rounded-xl bg-surface-card border border-surface-border text-sm font-bold text-fg focus:outline-none focus:ring-2 focus:ring-brand-400/40"
                    >
                        {clients.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}{!c.hasActivePlan ? " (no plan)" : ""}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none" />
                </div>
            </div>

            {calendar?.activePlan && !isViewingFutureMonth && (
                isViewingCurrentMonth ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <ComplianceCard
                            label="This Week"
                            sublabel={pendingToday ? "Through yesterday" : "Since Monday"}
                            completed={weekCompliance.completed}
                            due={weekCompliance.due}
                            percent={weekCompliance.percent}
                        />
                        <ComplianceCard
                            label="This Month"
                            sublabel={pendingToday ? "Through yesterday" : "Month to date"}
                            completed={monthCompliance.completed}
                            due={monthCompliance.due}
                            percent={monthCompliance.percent}
                        />
                    </div>
                ) : (
                    <ComplianceCard
                        label={`${MONTHS[calendarView.month]} ${calendarView.year}`}
                        sublabel="Full month completion"
                        completed={viewedMonthCompliance.completed}
                        due={viewedMonthCompliance.due}
                        percent={viewedMonthCompliance.percent}
                    />
                )
            )}

            {!calendar?.activePlan ? (
                <div className="card p-10 text-center space-y-4 border-dashed">
                    <p className="text-sm text-fg-muted font-bold">
                        {selectedClientName} has no active training plan assigned.
                    </p>
                    {selectedClientId && (
                        <Link
                            href={`/coach/client/${selectedClientId}`}
                            className="btn-primary inline-flex"
                        >
                            Assign Plan
                        </Link>
                    )}
                </div>
            ) : (
                <CalendarClient
                    activePlan={calendar.activePlan}
                    planStartedAt={calendar.planStartedAt}
                    loggedDates={calendar.loggedDates}
                    inProgressSessions={calendar.inProgressSessions}
                    view={calendarView}
                    onViewChange={setCalendarView}
                    coachView={{
                        clientId: selectedClientId!,
                        clientName: selectedClientName,
                        planId: calendar.activePlan.id,
                    }}
                />
            )}
        </div>
    );
}
