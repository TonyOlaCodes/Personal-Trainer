"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MessageCircle, Send, UserCheck } from "lucide-react";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { resolveUploadUrl } from "@/lib/uploadUrls";

interface CoachCodeRequestItem {
    id: string;
    status: string;
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

interface CoachOption {
    id: string;
    name?: string | null;
    email: string;
}

interface Props {
    coaches: CoachOption[];
}

export function AdminCoachCodeRequestsPanel({ coaches }: Props) {
    const [requests, setRequests] = useState<CoachCodeRequestItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [dispatchingId, setDispatchingId] = useState<string | null>(null);
    const [selectedCoaches, setSelectedCoaches] = useState<Record<string, string[]>>({});
    const [busyId, setBusyId] = useState<string | null>(null);

    const loadRequests = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/admin/coach-code-requests");
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Could not load requests");
            setRequests(data.requests ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not load requests");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    const toggleCoach = (requestId: string, coachId: string) => {
        setSelectedCoaches((prev) => {
            const current = prev[requestId] ?? [];
            const next = current.includes(coachId)
                ? current.filter((id) => id !== coachId)
                : [...current, coachId];
            return { ...prev, [requestId]: next };
        });
    };

    const handleSelf = async (requestId: string) => {
        setBusyId(requestId);
        try {
            const res = await fetch("/api/admin/coach-code-requests", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "handle_self", requestId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Could not update request");
            await loadRequests();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Could not update request");
        } finally {
            setBusyId(null);
        }
    };

    const handleDispatch = async (requestId: string) => {
        const coachIds = selectedCoaches[requestId] ?? [];
        if (coachIds.length === 0) {
            alert("Select at least one coach.");
            return;
        }

        setDispatchingId(requestId);
        try {
            const res = await fetch("/api/admin/coach-code-requests", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "dispatch", requestId, coachIds }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Could not dispatch request");
            await loadRequests();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Could not dispatch request");
        } finally {
            setDispatchingId(null);
        }
    };

    if (loading) {
        return (
            <div className="card p-8 flex items-center justify-center gap-2 text-fg-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading coach code requests...
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div>
                <h3 className="heading-3 mb-1">Coach Code Requests</h3>
                <p className="text-sm text-fg-muted">
                    Review access-code requests. Handling means someone is talking to them; assigned means they got access.
                </p>
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            {requests.length === 0 ? (
                <div className="card p-8 text-center text-sm text-fg-muted">No pending coach code requests.</div>
            ) : (
                requests.map((request) => {
                    const label = request.user.name?.trim() || request.user.email;
                    const coachChoices = coaches.filter((coach) => coach.id !== request.user.id);
                    const canHandleSelf = request.displayStatus === "PENDING";
                    const canDispatch = request.displayStatus !== "ASSIGNED";
                    const dispatchTitle = request.displayStatus === "HANDLING"
                        ? "Redispatch to coaches"
                        : request.displayStatus === "DISPATCHED"
                            ? "Send to more coaches"
                            : "Dispatch to coaches";
                    const dispatchButtonLabel = request.displayStatus === "HANDLING"
                        ? "Redispatch selected coaches"
                        : request.displayStatus === "DISPATCHED"
                            ? "Send to selected coaches"
                            : "Dispatch selected coaches";

                    return (
                        <div key={request.id} className="card p-5 space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-500/10 border border-surface-border flex items-center justify-center shrink-0">
                                        {request.user.avatarUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={resolveUploadUrl(request.user.avatarUrl)} alt={label} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-[10px] font-black text-brand-400">{getInitials(label)}</span>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold truncate">{label}</p>
                                        <p className="text-xs text-fg-muted truncate">{request.user.email}</p>
                                        <p className="text-[10px] text-fg-subtle mt-1">Requested {formatDate(request.createdAt)}</p>
                                    </div>
                                </div>
                                <span className={cn(
                                    "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                                    request.displayStatus === "PENDING"
                                        ? "bg-warning-500/10 text-warning border-warning/20"
                                        : request.displayStatus === "ASSIGNED"
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
                                <Link href={`/chat?with=${request.user.id}`} className="btn-secondary text-xs">
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    Message user
                                </Link>
                                {canHandleSelf && (
                                    <button
                                        type="button"
                                        onClick={() => handleSelf(request.id)}
                                        disabled={busyId === request.id}
                                        className="btn-secondary text-xs"
                                    >
                                        {busyId === request.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                                        Handle myself
                                    </button>
                                )}
                            </div>

                            {canDispatch && coachChoices.length > 0 && (
                                <div className="border-t border-surface-border/50 pt-4 space-y-3">
                                    <p className="text-xs font-black uppercase tracking-widest text-fg-subtle">{dispatchTitle}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {coachChoices.map((coach) => {
                                            const selected = (selectedCoaches[request.id] ?? []).includes(coach.id);
                                            return (
                                                <button
                                                    key={coach.id}
                                                    type="button"
                                                    onClick={() => toggleCoach(request.id, coach.id)}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                                                        selected
                                                            ? "border-brand-600 bg-brand-950/60 text-brand-300"
                                                            : "border-surface-border bg-surface-muted text-fg-muted"
                                                    )}
                                                >
                                                    {coach.name?.trim() || coach.email}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleDispatch(request.id)}
                                        disabled={dispatchingId === request.id}
                                        className="btn-primary text-xs"
                                    >
                                        {dispatchingId === request.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                        {dispatchButtonLabel}
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
}
