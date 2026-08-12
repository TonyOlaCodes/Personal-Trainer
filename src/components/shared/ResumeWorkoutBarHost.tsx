"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { parseLogDate, toDateKey } from "@/lib/utils";
import { ResumeWorkoutBar, type ResumeWorkoutSession } from "@/components/shared/ResumeWorkoutBar";

/**
 * Loads the one active session and renders the resume bar under the TopBar spacer
 * (never under the fixed header).
 */
export function ResumeWorkoutBarHost() {
    const pathname = usePathname();
    const [session, setSession] = useState<ResumeWorkoutSession | null>(null);

    useEffect(() => {
        if (pathname.startsWith("/plans/log/")) {
            setSession(null);
            return;
        }

        let cancelled = false;
        const load = async () => {
            try {
                const res = await fetch("/api/logs?active=true");
                if (!res.ok || cancelled) return;
                const log = await res.json();
                if (!log?.id || !log.workoutId || cancelled) {
                    setSession(null);
                    return;
                }

                const dateKey = toDateKey(parseLogDate(log.loggedAt));
                const sets = Array.isArray(log.sets) ? log.sets : [];
                setSession({
                    id: log.id,
                    workoutId: log.workoutId,
                    workoutName: log.workout?.name ?? "Workout",
                    dateKey,
                    resumeHref: `/plans/log/${log.workoutId}?date=${encodeURIComponent(dateKey)}`,
                    completedSetCount: sets.filter((s: { isCompleted?: boolean }) => s.isCompleted).length,
                    totalSetCount: sets.length,
                    isBackdated: dateKey !== toDateKey(new Date()),
                });
            } catch (error) {
                console.error("[ResumeWorkoutBarHost] failed to load session", error);
            }
        };

        void load();
        const onFocus = () => void load();
        window.addEventListener("focus", onFocus);
        return () => {
            cancelled = true;
            window.removeEventListener("focus", onFocus);
        };
    }, [pathname]);

    if (!session) return null;
    return <ResumeWorkoutBar session={session} />;
}
