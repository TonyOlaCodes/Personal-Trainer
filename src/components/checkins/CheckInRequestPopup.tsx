"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, X } from "lucide-react";
import { ModalOverlay } from "@/components/shared/ModalOverlay";
import { useRole } from "@/lib/RoleContext";
import { isClientRole } from "@/lib/roles";
import { resolveUploadUrl } from "@/lib/uploadUrls";

type PendingCheckInRequest = {
    id: string;
    weekNumber: number;
    checkInHref: string;
    isOverdue: boolean;
    title: string;
    body: string;
    statusLine: string;
    coach: {
        id: string;
        name: string;
        avatarUrl: string | null;
    };
};

const SESSION_KEY = "tolg:checkin-request-popup";

function wasShownThisSession(requestId: string) {
    try {
        return sessionStorage.getItem(SESSION_KEY) === requestId;
    } catch {
        return false;
    }
}

function markShownThisSession(requestId: string) {
    try {
        sessionStorage.setItem(SESSION_KEY, requestId);
    } catch {
        // ignore
    }
}

function CheckInRequestPopupInner() {
    const role = useRole();
    const router = useRouter();
    const [request, setRequest] = useState<PendingCheckInRequest | null>(null);

    const loadPending = useCallback(async () => {
        if (!isClientRole(role)) {
            setRequest(null);
            return;
        }
        try {
            const res = await fetch("/api/client/check-in-request");
            if (!res.ok) return;
            const data = await res.json();
            const pending = data.request as PendingCheckInRequest | null;
            if (!pending?.id) {
                setRequest(null);
                return;
            }
            if (wasShownThisSession(pending.id)) {
                setRequest(null);
                return;
            }
            setRequest(pending);
        } catch {
            // ignore
        }
    }, [role]);

    useEffect(() => {
        if (!isClientRole(role)) return;

        void loadPending();

        const onVisible = () => {
            if (document.visibilityState === "visible") void loadPending();
        };

        window.addEventListener("focus", onVisible);
        document.addEventListener("visibilitychange", onVisible);

        return () => {
            window.removeEventListener("focus", onVisible);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [role, loadPending]);

    const dismiss = () => {
        if (!request) return;
        markShownThisSession(request.id);
        setRequest(null);
    };

    const goCheckIn = () => {
        if (!request) return;
        markShownThisSession(request.id);
        const href = request.checkInHref;
        setRequest(null);
        router.push(href);
    };

    if (!request) return null;

    const coachName = request.coach.name || "Your coach";
    const initials = coachName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || "C";

    return (
        <ModalOverlay onClose={dismiss} closeOnBackdrop>
            <div
                className="bg-surface-card w-full sm:max-w-md max-h-[85vh] rounded-t-[1.75rem] sm:rounded-3xl border border-surface-border shadow-glow-brand-lg overflow-hidden animate-slide-up flex flex-col"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-labelledby="checkin-request-title"
                aria-modal="true"
            >
                <div className="px-5 pt-5 pb-4 border-b border-surface-border bg-warning/5 shrink-0">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-muted border border-surface-border shrink-0 flex items-center justify-center">
                            {request.coach.avatarUrl ? (
                                <img
                                    src={resolveUploadUrl(request.coach.avatarUrl)}
                                    alt=""
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="text-sm font-black text-fg-muted">{initials}</span>
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-warning">
                                <ClipboardList className="w-3.5 h-3.5 shrink-0" />
                                <p
                                    id="checkin-request-title"
                                    className="text-[11px] font-black uppercase tracking-widest"
                                >
                                    {request.title}
                                </p>
                            </div>
                            <p className="text-sm font-semibold text-fg mt-2 leading-snug">
                                {request.body}
                            </p>
                            <p className="text-xs text-warning font-semibold mt-2">
                                {request.statusLine}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={dismiss}
                            className="p-1.5 rounded-lg text-fg-subtle hover:text-fg hover:bg-surface-muted transition-colors shrink-0"
                            aria-label="Close"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="p-5 flex flex-col gap-2.5">
                    <button
                        type="button"
                        onClick={goCheckIn}
                        className="btn-primary w-full justify-center font-black tracking-wide"
                    >
                        CHECK IN
                    </button>
                    <button
                        type="button"
                        onClick={dismiss}
                        className="w-full py-2.5 text-xs font-bold uppercase tracking-widest text-fg-muted hover:text-fg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </ModalOverlay>
    );
}

export function CheckInRequestPopup() {
    return <CheckInRequestPopupInner />;
}
