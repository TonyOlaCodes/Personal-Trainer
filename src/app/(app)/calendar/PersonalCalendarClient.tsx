"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarClient, type CalendarView } from "./CalendarClient";
import { CalendarComplianceSummary } from "@/components/calendar/CalendarComplianceSummary";
import type { ClientCalendarPayload } from "@/lib/clientCalendarData";
import { toDateKey } from "@/lib/utils";
import { useCurrentDate } from "@/hooks/useCurrentDate";

interface Props {
    calendar: ClientCalendarPayload;
}

export function PersonalCalendarClient({ calendar }: Props) {
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
            activePlan: calendar.activePlan,
            planStartedAt: calendar.planStartedAt,
            loggedDates: calendar.loggedDates,
            scheduleRevisions: calendar.scheduleRevisions,
            excusedMissedWorkoutKeys: calendar.excusedMissedWorkoutKeys,
            historicalMissedSessions: calendar.historicalMissedSessions,
        }),
        [calendar]
    );

    if (!calendar.activePlan) {
        return (
            <div className="card p-10 text-center space-y-4 border-dashed animate-fade-in">
                <p className="text-sm text-fg-muted font-bold">
                    You don&apos;t have an active training plan yet.
                </p>
                <Link href="/plans" className="btn-primary inline-flex">
                    Browse Plans
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <CalendarComplianceSummary
                complianceInput={complianceInput}
                calendarView={calendarView}
                now={now}
                excludeTodayUntilLogged
            />

            <CalendarClient
                activePlan={calendar.activePlan}
                planStartedAt={calendar.planStartedAt}
                loggedDates={calendar.loggedDates}
                inProgressSessions={calendar.inProgressSessions}
                scheduleRevisions={calendar.scheduleRevisions}
                excusedMissedWorkoutKeys={calendar.excusedMissedWorkoutKeys}
                historicalMissedSessions={calendar.historicalMissedSessions}
                view={calendarView}
                onViewChange={setCalendarView}
            />
        </div>
    );
}
