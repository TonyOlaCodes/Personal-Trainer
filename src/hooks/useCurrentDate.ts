"use client";

import { useEffect, useState } from "react";
import { getMsUntilNextMidnight, toDateKey } from "@/lib/utils";

/** Keeps a live Date in sync with the app calendar day (Ireland), rolling forward at midnight. */
export function useCurrentDate() {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        let intervalId: ReturnType<typeof setInterval>;

        const syncIfDayChanged = () => {
            setNow((prev) => {
                const next = new Date();
                return toDateKey(prev) === toDateKey(next) ? prev : next;
            });
        };

        const scheduleMidnight = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                syncIfDayChanged();
                scheduleMidnight();
            }, getMsUntilNextMidnight());
        };

        const onVisibility = () => {
            if (document.visibilityState === "visible") {
                syncIfDayChanged();
                scheduleMidnight();
            }
        };

        syncIfDayChanged();
        scheduleMidnight();
        intervalId = setInterval(() => {
            if (document.visibilityState === "visible") syncIfDayChanged();
        }, 60_000);

        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, []);

    return now;
}
