"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { WORKOUT_STATS_REFRESH_EVENT } from "@/lib/workoutStatsRefresh";

/** Refetch progress stats after workouts change, tab focus, or returning to /progress. */
export function useWorkoutStatsRefresh(
    enabled: boolean,
    onRefresh: (options?: { silent?: boolean }) => void | Promise<void>
) {
    const pathname = usePathname();
    const prevPathRef = useRef<string | null>(null);

    useEffect(() => {
        if (!enabled) return;

        const refresh = () => {
            void onRefresh({ silent: true });
        };

        window.addEventListener(WORKOUT_STATS_REFRESH_EVENT, refresh);

        const onVisibility = () => {
            if (document.visibilityState === "visible") refresh();
        };
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            window.removeEventListener(WORKOUT_STATS_REFRESH_EVENT, refresh);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [enabled, onRefresh]);

    useEffect(() => {
        if (!enabled) return;
        const prev = prevPathRef.current;
        prevPathRef.current = pathname;
        if (pathname === "/progress" && prev !== null && prev !== "/progress") {
            void onRefresh({ silent: true });
        }
    }, [enabled, pathname, onRefresh]);
}
