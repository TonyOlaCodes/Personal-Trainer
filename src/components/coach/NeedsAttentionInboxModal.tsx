"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
    AlertTriangle, Bell, Calendar, CheckCircle2, ClipboardCheck,
    Dumbbell, Loader2, MessageSquare, UserCog, X,
} from "lucide-react";
import { ModalOverlay } from "@/components/shared/ModalOverlay";
import { cn } from "@/lib/utils";
import type { CoachAttentionInboxItem } from "@/lib/coachAttentionInbox";

interface Props {
    open: boolean;
    onClose: () => void;
    onUpdated?: () => void;
}

const CATEGORY_ICONS: Record<CoachAttentionInboxItem["category"], React.ComponentType<{ className?: string }>> = {
    missed_workout: Dumbbell,
    check_in_overdue: ClipboardCheck,
    check_in_missed: ClipboardCheck,
    pending_check_in: ClipboardCheck,
    unread_message: MessageSquare,
    setup_needed: UserCog,
    falling_behind: AlertTriangle,
};

function statusLabel(status: CoachAttentionInboxItem["status"]) {
    if (status === "excused") return "Excused";
    if (status === "dismissed") return "Dismissed";
    return null;
}

export function NeedsAttentionInboxModal({ open, onClose, onUpdated }: Props) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [items, setItems] = useState<CoachAttentionInboxItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [actingId, setActingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadInbox = useCallback(async (options?: { silent?: boolean }) => {
        const scrollEl = scrollRef.current;
        const scrollTop = scrollEl?.scrollTop ?? 0;
        const silent = options?.silent ?? false;

        if (!silent) setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/coach/attention-inbox");
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Could not load inbox");
            setItems(data.items ?? []);
            if (silent && scrollEl) {
                requestAnimationFrame(() => {
                    scrollEl.scrollTop = scrollTop;
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not load inbox");
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (open) void loadInbox();
    }, [open, loadInbox]);

    const runAction = async (
        item: CoachAttentionInboxItem,
        operation: "dismiss" | "excuse" | "notify" | "message",
        message?: string
    ) => {
        setActingId(item.id);
        setError(null);

        const nextStatus =
            operation === "dismiss" ? "dismissed" as const
            : operation === "excuse" ? "excused" as const
            : null;
        let previousItems: CoachAttentionInboxItem[] | null = null;

        if (nextStatus) {
            setItems((prev) => {
                previousItems = prev;
                return prev.map((entry) =>
                    entry.id === item.id ? { ...entry, status: nextStatus } : entry
                );
            });
        }

        try {
            const res = await fetch("/api/coach/attention-inbox", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    alertKey: item.id,
                    clientId: item.clientId,
                    category: item.category,
                    operation,
                    message,
                    weekNumber: item.weekNumber,
                    dateKey: item.dateKey,
                    workoutId: item.workoutId,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Action failed");
            onUpdated?.();
        } catch (err) {
            if (previousItems) setItems(previousItems);
            setError(err instanceof Error ? err.message : "Action failed");
        } finally {
            setActingId(null);
        }
    };

    if (!open) return null;

    const openItems = items.filter((item) => item.status === "open");
    const handledItems = items.filter((item) => item.status !== "open");

    return (
        <ModalOverlay open={open} onClose={onClose} className="pb-20 md:pb-4">
            <div
                className="bg-surface-card w-full sm:max-w-2xl max-h-[min(90dvh,calc(100dvh-5.5rem))] sm:max-h-[90vh] rounded-t-[2rem] sm:rounded-3xl border border-surface-border shadow-glow-brand-lg overflow-hidden animate-slide-up flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-surface-border shrink-0">
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-warning">Coach inbox</p>
                        <h3 className="text-lg font-black text-fg truncate">Needs Attention</h3>
                        <p className="text-xs text-fg-muted mt-0.5">
                            {openItems.length === 0
                                ? "You're all caught up."
                                : `${openItems.length} item${openItems.length === 1 ? "" : "s"} need follow-up`}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="btn-icon shrink-0" aria-label="Close">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain min-h-0 p-4 sm:p-5 space-y-4">
                    {error && (
                        <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex justify-center py-16">
                            <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
                        </div>
                    ) : openItems.length === 0 && handledItems.length === 0 ? (
                        <div className="card p-10 text-center border-success/20 bg-success/5">
                            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-success" />
                            <p className="text-sm font-bold text-fg">All caught up</p>
                            <p className="text-xs text-fg-muted mt-1">Nothing needs your attention right now.</p>
                        </div>
                    ) : (
                        <>
                            {openItems.map((item) => (
                                <AttentionItemCard
                                    key={item.id}
                                    item={item}
                                    busy={actingId === item.id}
                                    onDismiss={() => void runAction(item, "dismiss")}
                                    onExcuse={() => void runAction(item, "excuse")}
                                    onNotify={() => void runAction(item, "notify")}
                                    onMessage={(text) => void runAction(item, "message", text)}
                                />
                            ))}

                            {handledItems.length > 0 && (
                                <div className="space-y-3 pt-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle px-1">
                                        Acknowledged
                                    </p>
                                    {handledItems.map((item) => (
                                        <AttentionItemCard
                                            key={item.id}
                                            item={item}
                                            busy={false}
                                            compact
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </ModalOverlay>
    );
}

function AttentionItemCard({
    item,
    busy,
    compact = false,
    onDismiss,
    onExcuse,
    onNotify,
    onMessage,
}: {
    item: CoachAttentionInboxItem;
    busy: boolean;
    compact?: boolean;
    onDismiss?: () => void;
    onExcuse?: () => void;
    onNotify?: () => void;
    onMessage?: (text: string) => void;
}) {
    const Icon = CATEGORY_ICONS[item.category];
    const status = statusLabel(item.status);
    const isOpen = item.status === "open";

    const quickMessage =
        item.category === "missed_workout"
            ? "Hey — what happened with yesterday's session?"
            : item.category === "check_in_overdue" || item.category === "check_in_missed"
                ? "Hey — please submit your check-in when you can."
                : "Hey — just checking in.";

    return (
        <div
            className={cn(
                "card p-4 sm:p-5 space-y-3",
                item.urgent && isOpen && "border-warning/30 bg-warning/5",
                item.status === "excused" && "border-success/25 bg-success/5",
                item.status === "dismissed" && "opacity-70"
            )}
        >
            <div className="flex items-start gap-3">
                <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    item.category === "missed_workout" ? "bg-danger/10" :
                    item.category.includes("check_in") ? "bg-warning/10" :
                    item.category === "unread_message" ? "bg-brand-400/10" :
                    "bg-surface-muted"
                )}>
                    <Icon className={cn(
                        "w-4 h-4",
                        item.category === "missed_workout" ? "text-danger" :
                        item.category.includes("check_in") ? "text-warning" :
                        item.category === "unread_message" ? "text-brand-400" :
                        "text-fg-muted"
                    )} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-fg">{item.clientName}</p>
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-surface-muted border border-surface-border text-fg-muted">
                            {item.issueType}
                        </span>
                        {status && (
                            <span className={cn(
                                "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                                item.status === "excused"
                                    ? "bg-success/10 border-success/30 text-success"
                                    : "bg-surface-muted border-surface-border text-fg-subtle"
                            )}>
                                {status}
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle mt-1">
                        {item.dateLabel}
                        {item.workoutName ? ` · ${item.workoutName}` : ""}
                    </p>
                    {!compact && (
                        <p className="text-xs text-fg-muted mt-2 leading-relaxed">{item.explanation}</p>
                    )}
                </div>
            </div>

            {isOpen && !compact && (
                <div className="flex flex-wrap gap-2 pt-1">
                    {item.category === "pending_check_in" && item.checkInId && (
                        <Link href={item.href} className="btn-primary btn-sm text-[10px] font-black uppercase tracking-widest">
                            Review check-in
                        </Link>
                    )}

                    {item.category === "unread_message" && (
                        <Link href={item.chatHref} className="btn-primary btn-sm text-[10px] font-black uppercase tracking-widest">
                            Open chat
                        </Link>
                    )}

                    {(item.category === "check_in_overdue" || item.category === "check_in_missed") && (
                        <>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={onNotify}
                                className="btn-secondary btn-sm text-[10px] font-black uppercase tracking-widest"
                            >
                                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : "Notify"}
                            </button>
                            <Link href={item.chatHref} className="btn-secondary btn-sm text-[10px] font-black uppercase tracking-widest">
                                Send reminder
                            </Link>
                        </>
                    )}

                    {item.category === "missed_workout" && (
                        <>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={onNotify}
                                className="btn-secondary btn-sm text-[10px] font-black uppercase tracking-widest"
                            >
                                Notify
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => onMessage?.(quickMessage)}
                                className="btn-secondary btn-sm text-[10px] font-black uppercase tracking-widest"
                            >
                                Quick message
                            </button>
                            {item.calendarHref && (
                                <Link href={item.calendarHref} className="btn-secondary btn-sm text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Reschedule
                                </Link>
                            )}
                            <button
                                type="button"
                                disabled={busy}
                                onClick={onExcuse}
                                className="btn-secondary btn-sm text-[10px] font-black uppercase tracking-widest"
                            >
                                Mark excused
                            </button>
                        </>
                    )}

                    {(item.category === "setup_needed") && (
                        <>
                            <Link href={item.href} className="btn-secondary btn-sm text-[10px] font-black uppercase tracking-widest">
                                Open client
                            </Link>
                            <Link href={item.chatHref} className="btn-secondary btn-sm text-[10px] font-black uppercase tracking-widest">
                                Message
                            </Link>
                        </>
                    )}

                    {item.category !== "unread_message" && item.category !== "pending_check_in" && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={onDismiss}
                            className="btn-ghost btn-sm text-[10px] font-black uppercase tracking-widest text-fg-muted"
                        >
                            Dismiss
                        </button>
                    )}

                    {item.category === "pending_check_in" && (
                        <>
                            <Link href={item.chatHref} className="btn-secondary btn-sm text-[10px] font-black uppercase tracking-widest">
                                Message client
                            </Link>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={onDismiss}
                                className="btn-ghost btn-sm text-[10px] font-black uppercase tracking-widest text-fg-muted"
                            >
                                Dismiss
                            </button>
                        </>
                    )}

                    {item.category === "unread_message" && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={onDismiss}
                            className="btn-ghost btn-sm text-[10px] font-black uppercase tracking-widest text-fg-muted"
                        >
                            Dismiss
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
