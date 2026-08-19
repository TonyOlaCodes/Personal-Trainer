"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { ModalOverlay } from "@/components/shared/ModalOverlay";
import { useChatUnread } from "@/components/chat/ChatUnreadProvider";
import { useRole } from "@/lib/RoleContext";
import { isClientRole } from "@/lib/roles";
import { resolveUploadUrl } from "@/lib/uploadUrls";
import { cn } from "@/lib/utils";

type PendingBroadcast = {
    id: string;
    content: string;
    createdAt: string;
    coach: {
        id: string;
        name: string;
        avatarUrl: string | null;
    };
};

const POLL_MS = 12000;

function formatBroadcastWhen(iso: string) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function CoachBroadcastPopupInner() {
    const role = useRole();
    const { refresh: refreshUnread } = useChatUnread();
    const [broadcast, setBroadcast] = useState<PendingBroadcast | null>(null);
    const [acknowledging, setAcknowledging] = useState(false);

    const loadPending = useCallback(async () => {
        if (!isClientRole(role)) {
            setBroadcast(null);
            return;
        }
        try {
            const res = await fetch("/api/client/coach-broadcasts");
            if (!res.ok) return;
            const data = await res.json();
            setBroadcast(data.broadcast ?? null);
        } catch {
            // ignore
        }
    }, [role]);

    useEffect(() => {
        if (!isClientRole(role)) return;

        void loadPending();
        const interval = setInterval(() => {
            if (document.visibilityState === "visible") void loadPending();
        }, POLL_MS);

        const onVisible = () => {
            if (document.visibilityState === "visible") void loadPending();
        };

        window.addEventListener("focus", loadPending);
        document.addEventListener("visibilitychange", onVisible);

        return () => {
            clearInterval(interval);
            window.removeEventListener("focus", loadPending);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [role, loadPending]);

    const acknowledge = async () => {
        if (!broadcast || acknowledging) return;
        setAcknowledging(true);
        try {
            const res = await fetch("/api/client/coach-broadcasts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messageId: broadcast.id }),
            });
            if (!res.ok) return;
            const data = await res.json();
            setBroadcast(data.broadcast ?? null);
            void refreshUnread();
        } finally {
            setAcknowledging(false);
        }
    };

    if (!broadcast) return null;

    const coachName = broadcast.coach.name || "Your coach";
    const initials = coachName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || "C";

    return (
        <ModalOverlay onClose={acknowledge} closeOnBackdrop={!acknowledging}>
            <div
                className="bg-surface-card w-full sm:max-w-md max-h-[85vh] rounded-t-[1.75rem] sm:rounded-3xl border border-surface-border shadow-glow-brand-lg overflow-hidden animate-slide-up flex flex-col"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-labelledby="coach-broadcast-title"
                aria-modal="true"
            >
                <div className="px-5 pt-5 pb-4 border-b border-surface-border bg-amber-500/5 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-muted border border-surface-border shrink-0 flex items-center justify-center">
                            {broadcast.coach.avatarUrl ? (
                                <img
                                    src={resolveUploadUrl(broadcast.coach.avatarUrl)}
                                    alt=""
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="text-sm font-black text-fg-muted">{initials}</span>
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-fg truncate">{coachName}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 text-amber-600 dark:text-amber-400">
                                <Megaphone className="w-3.5 h-3.5 shrink-0" />
                                <p
                                    id="coach-broadcast-title"
                                    className="text-[11px] font-black uppercase tracking-widest"
                                >
                                    Coach Announcement
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 min-h-0">
                    <p className="text-[15px] text-fg whitespace-pre-wrap break-words leading-relaxed">
                        {broadcast.content}
                    </p>
                    <p className="mt-4 text-xs font-medium text-fg-muted">
                        {formatBroadcastWhen(broadcast.createdAt)}
                    </p>
                </div>

                <div className="px-5 py-4 border-t border-surface-border shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <button
                        type="button"
                        onClick={acknowledge}
                        disabled={acknowledging}
                        className={cn("btn-primary w-full", acknowledging && "opacity-70")}
                    >
                        {acknowledging ? "Saving..." : "Got it"}
                    </button>
                </div>
            </div>
        </ModalOverlay>
    );
}

export function CoachBroadcastPopup() {
    const role = useRole();
    if (!isClientRole(role)) return null;
    return <CoachBroadcastPopupInner />;
}
