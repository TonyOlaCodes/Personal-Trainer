"use client";

import { useEffect } from "react";
import { PRESENCE_HEARTBEAT_MS } from "@/lib/userPresence";

/**
 * Marks the user online only while the app is in the foreground.
 * Hidden tabs / background timers must not keep lastActiveAt fresh.
 * Reopening or focusing the app pings immediately.
 */
export function PresenceHeartbeat() {
    useEffect(() => {
        const ping = () => {
            if (typeof document === "undefined") return;
            if (document.visibilityState !== "visible") return;
            fetch("/api/presence", { method: "POST", keepalive: true }).catch(() => {});
        };

        ping();
        const interval = setInterval(ping, PRESENCE_HEARTBEAT_MS);

        const onVisible = () => {
            if (document.visibilityState === "visible") ping();
        };
        const onFocus = () => ping();
        const onPageShow = () => ping();

        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("focus", onFocus);
        window.addEventListener("pageshow", onPageShow);

        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("pageshow", onPageShow);
        };
    }, []);

    return null;
}
