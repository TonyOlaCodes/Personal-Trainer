"use client";

import { useEffect, useState } from "react";
import { getMsUntilNextMidnight } from "@/lib/utils";

/** Keeps a live Date in sync, rolling forward at local midnight. */
export function useCurrentDate() {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;

        const sync = () => setNow(new Date());

        const schedule = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                sync();
                schedule();
            }, getMsUntilNextMidnight());
        };

        const onVisibility = () => {
            if (document.visibilityState === "visible") {
                sync();
                schedule();
            }
        };

        schedule();
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, []);

    return now;
}
