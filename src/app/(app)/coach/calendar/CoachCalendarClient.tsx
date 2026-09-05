"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, UserCircle } from "lucide-react";
import { CalendarClient, type CalendarView } from "@/app/(app)/calendar/CalendarClient";
import { getInitials, toDateKey } from "@/lib/utils";
import { resolveUploadUrl } from "@/lib/uploadUrls";
import { useCurrentDate } from "@/hooks/useCurrentDate";
import type { ClientCalendarPayload } from "@/lib/clientCalendarData";
import { TolgSelectMenu } from "@/components/shared/TolgSelectMenu";
import Link from "next/link";

const LAST_COACH_CALENDAR_CLIENT_KEY = "coach_calendar_last_client_id";

interface ClientOption {
    id: string;
    name: string;
    avatarUrl?: string | null;
    hasActivePlan: boolean;
}

interface Props {
    clients: ClientOption[];
    selectedClientId: string | null;
    selectedClientName: string;
    calendar: ClientCalendarPayload | null;
    initialDateKey?: string | null;
}

function CoachCalendarClientHeader({
    clients,
    selectedClientId,
    selectedClientName,
    onClientChange,
    selectId,
}: {
    clients: ClientOption[];
    selectedClientId: string | null;
    selectedClientName: string;
    onClientChange: (clientId: string) => void;
    selectId: string;
}) {
    const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null;
    const coachingHref = selectedClientId ? `/coach/client/${selectedClientId}` : null;
    const cardRef = useRef<HTMLDivElement>(null);

    const avatar = (
        <span className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center text-[11px] font-bold text-white overflow-hidden shrink-0">
            {selectedClient?.avatarUrl ? (
                <img
                    src={resolveUploadUrl(selectedClient.avatarUrl)}
                    alt=""
                    className="w-full h-full object-cover"
                />
            ) : (
                getInitials(selectedClientName)
            )}
        </span>
    );

    return (
        <div ref={cardRef} className="card px-4 py-3 flex items-center gap-2 min-w-0">
            {coachingHref ? (
                <Link
                    href={coachingHref}
                    className="flex items-center gap-2.5 min-w-0 hover:opacity-85 transition-opacity"
                    title={`Open ${selectedClientName} coaching page`}
                    aria-label={`Open ${selectedClientName} coaching page`}
                >
                    {avatar}
                    <span className="text-base font-black text-fg tracking-tight truncate">
                        {selectedClientName}
                    </span>
                </Link>
            ) : (
                <div className="flex items-center gap-2.5 min-w-0">
                    {avatar}
                    <span className="text-base font-black text-fg tracking-tight truncate">
                        {selectedClientName}
                    </span>
                </div>
            )}
            <TolgSelectMenu
                value={selectedClientId}
                onValueChange={onClientChange}
                ariaLabel="Switch client"
                triggerId={selectId}
                minWidthRef={cardRef}
                triggerClassName="w-8 h-8 rounded-lg flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface-muted transition-colors data-[state=open]:text-fg data-[state=open]:bg-surface-muted focus-visible:ring-2 focus-visible:ring-brand-500/50"
                options={clients.map((client) => ({
                    value: client.id,
                    label: client.name,
                    avatarUrl: client.avatarUrl,
                    hint: client.hasActivePlan ? undefined : "No plan",
                }))}
            >
                <ChevronDown className="w-4 h-4" />
            </TolgSelectMenu>
        </div>
    );
}

export function CoachCalendarClient({ clients, selectedClientId, selectedClientName, calendar, initialDateKey }: Props) {
    const router = useRouter();
    const now = useCurrentDate();
    const todayKey = toDateKey(now);
    const prevTodayKeyRef = useRef(todayKey);

    const [calendarView, setCalendarView] = useState<CalendarView>(() => {
        const sourceKey = initialDateKey ?? todayKey;
        const [y, m] = sourceKey.split("-").map(Number);
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

    const onClientChange = (clientId: string) => {
        localStorage.setItem(LAST_COACH_CALENDAR_CLIENT_KEY, clientId);
        const params = new URLSearchParams({ clientId });
        if (initialDateKey) params.set("date", initialDateKey);
        router.push(`/coach/calendar?${params.toString()}`);
    };

    // Restore last viewed client when opening /coach/calendar without ?clientId=
    useEffect(() => {
        if (clients.length === 0) return;

        const urlClientId = new URLSearchParams(window.location.search).get("clientId");
        const isValid = (id: string) => clients.some((c) => c.id === id);

        if (urlClientId && isValid(urlClientId)) {
            localStorage.setItem(LAST_COACH_CALENDAR_CLIENT_KEY, urlClientId);
            return;
        }

        if (!urlClientId) {
            const saved = localStorage.getItem(LAST_COACH_CALENDAR_CLIENT_KEY);
            if (saved && isValid(saved)) {
                router.replace(`/coach/calendar?clientId=${encodeURIComponent(saved)}`);
            }
        }
    }, [clients, router]);

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
        <div className="animate-fade-in">
            <CalendarClient
                activePlan={calendar?.activePlan ?? null}
                planStartedAt={calendar?.planStartedAt ?? null}
                loggedDates={calendar?.loggedDates ?? []}
                inProgressSessions={calendar?.inProgressSessions ?? []}
                scheduleRevisions={calendar?.scheduleRevisions ?? []}
                excusedMissedWorkoutKeys={calendar?.excusedMissedWorkoutKeys ?? []}
                historicalMissedSessions={calendar?.historicalMissedSessions ?? []}
                sessionOverrides={calendar?.sessionOverrides ?? {}}
                view={calendarView}
                onViewChange={setCalendarView}
                initialSelectedDateKey={initialDateKey ?? undefined}
                focusSelection={Boolean(initialDateKey)}
                coachView={selectedClientId ? {
                    clientId: selectedClientId,
                    clientName: selectedClientName,
                    planId: calendar?.activePlan?.id ?? null,
                } : undefined}
                renderCoachClientHeader={(selectId) => (
                    <CoachCalendarClientHeader
                        clients={clients}
                        selectedClientId={selectedClientId}
                        selectedClientName={selectedClientName}
                        onClientChange={onClientChange}
                        selectId={selectId}
                    />
                )}
            />
        </div>
    );
}
