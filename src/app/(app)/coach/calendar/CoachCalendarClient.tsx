"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, AlertCircle, CalendarCheck, UserCircle } from "lucide-react";
import { CalendarClient } from "@/app/(app)/calendar/CalendarClient";
import { cn, toDateKey } from "@/lib/utils";
import { useCurrentDate } from "@/hooks/useCurrentDate";
import type { ClientCalendarPayload } from "@/lib/clientCalendarData";
import Link from "next/link";

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

export function CoachCalendarClient({ clients, selectedClientId, selectedClientName, calendar }: Props) {
    const router = useRouter();
    const now = useCurrentDate();

    const weekStats = useMemo(() => {
        if (!calendar?.activePlan || !calendar.planStartedAt) {
            return { missed: 0, upcoming: 0, completed: 0 };
        }

        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const weekStart = new Date(today);
        const dow = today.getDay();
        weekStart.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
        weekStart.setHours(0, 0, 0, 0);

        const loggedSet = new Set(calendar.loggedDates.map((l) => l.date));
        const inProgressSet = new Set(calendar.inProgressSessions.map((s) => s.date));

        let missed = 0;
        let upcoming = 0;
        let completed = 0;

        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            const key = toDateKey(d);

            const start = new Date(calendar.planStartedAt);
            start.setHours(0, 0, 0, 0);
            const diffDays = Math.floor((d.getTime() - start.getTime()) / 86400000);
            if (diffDays < 0) continue;

            const weeks = calendar.activePlan.weeks;
            if (!weeks.length) continue;

            let weekIdx = Math.floor(diffDays / 7) % weeks.length;
            const week = weeks[weekIdx];
            if (!week) continue;

            const jsDow = d.getDay();
            const monBasedDow = jsDow === 0 ? 6 : jsDow - 1;
            const fallbackDayNumber = monBasedDow + 1;
            const usesOneIndexed = week.workouts.length >= 5
                && week.workouts.every((w) => w.dayOfWeek !== null && w.dayOfWeek !== undefined && w.dayOfWeek === w.dayNumber);
            const targetDow = usesOneIndexed ? (monBasedDow === 6 ? 0 : monBasedDow + 1) : monBasedDow;
            const planned = week.workouts.find((w) => w.dayOfWeek === targetDow)
                ?? week.workouts.find((w) => (w.dayOfWeek === null || w.dayOfWeek === undefined) && w.dayNumber === fallbackDayNumber);

            if (!planned) continue;

            if (loggedSet.has(key)) completed++;
            else if (inProgressSet.has(key)) upcoming++;
            else if (d < today) missed++;
            else upcoming++;
        }

        return { missed, upcoming, completed };
    }, [calendar, now]);

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

            {calendar?.activePlan && (
                <div className="grid grid-cols-3 gap-3">
                    <div className={cn(
                        "card p-4 border-danger/20",
                        weekStats.missed > 0 && "bg-danger/5 shadow-glow-danger-sm"
                    )}>
                        <div className="flex items-center gap-2 mb-1">
                            <AlertCircle className={cn("w-4 h-4", weekStats.missed > 0 ? "text-danger" : "text-fg-subtle")} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Missed</span>
                        </div>
                        <p className="text-2xl font-black text-fg">{weekStats.missed}</p>
                        <p className="text-[10px] text-fg-muted font-bold">This week</p>
                    </div>
                    <div className="card p-4 border-brand-500/20 bg-brand-950/10">
                        <div className="flex items-center gap-2 mb-1">
                            <CalendarCheck className="w-4 h-4 text-brand-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Upcoming</span>
                        </div>
                        <p className="text-2xl font-black text-fg">{weekStats.upcoming}</p>
                        <p className="text-[10px] text-fg-muted font-bold">This week</p>
                    </div>
                    <div className="card p-4 border-success/20 bg-success/5">
                        <div className="flex items-center gap-2 mb-1">
                            <CalendarCheck className="w-4 h-4 text-success" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Done</span>
                        </div>
                        <p className="text-2xl font-black text-fg">{weekStats.completed}</p>
                        <p className="text-[10px] text-fg-muted font-bold">This week</p>
                    </div>
                </div>
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
