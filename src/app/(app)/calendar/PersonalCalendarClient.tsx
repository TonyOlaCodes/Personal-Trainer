"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarClient, type CalendarView } from "./CalendarClient";
import type { ClientCalendarPayload } from "@/lib/clientCalendarData";
import { toDateKey } from "@/lib/utils";
import { useCurrentDate } from "@/hooks/useCurrentDate";

interface Props {
    calendar: ClientCalendarPayload;
    coachId?: string | null;
}

export function PersonalCalendarClient({ calendar, coachId }: Props) {
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

    return (
        <div className="animate-fade-in">
            <CalendarClient
                activePlan={calendar.activePlan}
                planStartedAt={calendar.planStartedAt}
                loggedDates={calendar.loggedDates}
                inProgressSessions={calendar.inProgressSessions}
                scheduleRevisions={calendar.scheduleRevisions}
                excusedMissedWorkoutKeys={calendar.excusedMissedWorkoutKeys}
                historicalMissedSessions={calendar.historicalMissedSessions}
                sessionOverrides={calendar.sessionOverrides}
                coachId={coachId}
                view={calendarView}
                onViewChange={setCalendarView}
            />
        </div>
    );
}
