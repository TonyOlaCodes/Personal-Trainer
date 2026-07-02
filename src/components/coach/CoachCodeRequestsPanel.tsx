"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MessageCircle, X } from "lucide-react";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { resolveUploadUrl } from "@/lib/uploadUrls";

interface CoachCodeRequestItem {
    dispatchId: string;
    requestId: string;
    displayStatus: "PENDING" | "DISPATCHED" | "HANDLING" | "ASSIGNED";
    statusLabel: string;
    statusDetail: string;
    createdAt: string;
    user: {
        id: string;
        name?: string | null;
        email: string;
        avatarUrl?: string | null;
    };
}

export function CoachCodeRequestsPanel() {
    const [requests, setRequests] = useState<CoachCodeRequestItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [ignoringId, setIgnoringId] = useState<string | null>(null);

    const loadRequests = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/coach/coach-code-requests");
            const data = await res.json();
            if (res.ok) setRequests(data.requests ?? []);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    const handleIgnore = async (dispatchId: string) => {
        setIgnoringId(dispatchId);
        try {
            const res = await fetch("/api/coach/coach-code-requests", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "ignore", dispatchId }),
            });
            if (res.ok) await loadRequests();
        } finally {
            setIgnoringId(null);
        }
    };

    if (loading) return null;
    if (requests.length === 0) return null;

    return (
        <div className="card p-5 space-y-4">
            <div>
                <h3 className="heading-3 mb-1">Coach Code Requests</h3>
                <p className="text-sm text-fg-muted">
                    These users requested a coach access code. Message them if you can help.
                </p>
            </div>

            {requests.map((request) => {
                const label = request.user.name?.trim() || request.user.email;
                const canAct = request.displayStatus === "DISPATCHED";
                return (
                    <div key={request.dispatchId} className="p-4 rounded-2xl bg-surface-muted border border-surface-border space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-500/10 border border-surface-border flex items-center justify-center shrink-0">
                                    {request.user.avatarUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={resolveUploadUrl(request.user.avatarUrl)} alt={label} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-[10px] font-black text-brand-400">{getInitials(label)}</span>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold truncate">{label}</p>
                                    <p className="text-xs text-fg-muted truncate">{request.user.email}</p>
                                    <p className="text-[10px] text-fg-subtle mt-1">Requested {formatDate(request.createdAt)}</p>
                                </div>
                            </div>
                            <span className={cn(
                                "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0",
                                request.displayStatus === "ASSIGNED"
                                    ? "bg-success/10 text-success border-success/20"
                                    : request.displayStatus === "HANDLING"
                                        ? "bg-warning/10 text-warning border-warning/20"
                                    : "bg-brand-500/10 text-brand-300 border-brand/20"
                            )}>
                                {request.statusLabel}
                            </span>
                        </div>
                        {request.statusDetail && (
                            <p className="text-xs font-semibold text-fg-muted">{request.statusDetail}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                            <Link href={`/chat?with=${request.user.id}`} className="btn-primary text-xs">
                                <MessageCircle className="w-3.5 h-3.5" />
                                Message user
                            </Link>
                            {canAct && (
                                <button
                                    type="button"
                                    onClick={() => handleIgnore(request.dispatchId)}
                                    disabled={ignoringId === request.dispatchId}
                                    className="btn-ghost text-xs"
                                >
                                    {ignoringId === request.dispatchId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                    Ignore
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
