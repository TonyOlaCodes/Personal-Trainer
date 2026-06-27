"use client";

import { useEffect } from "react";
import { PRESENCE_HEARTBEAT_MS } from "@/lib/userPresence";

export function PresenceHeartbeat() {
    useEffect(() => {
        const ping = () => {
            if (document.visibilityState !== "visible") return;
            fetch("/api/presence", { method: "POST" }).catch(() => {});
        };

        ping();
        const interval = setInterval(ping, PRESENCE_HEARTBEAT_MS);
        const onVisible = () => {
            if (document.visibilityState === "visible") ping();
        };
        document.addEventListener("visibilitychange", onVisible);

        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, []);

    return null;
}
