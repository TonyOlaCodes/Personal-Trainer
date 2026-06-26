"use client";

import { Activity, ChevronRight, Loader2, X } from "lucide-react";
import Link from "next/link";
import { ModalOverlay } from "@/components/shared/ModalOverlay";
import { formatDate, formatRelative } from "@/lib/utils";

export interface RecentSessionItem {
    id: string;
    workoutName: string;
    date: string;
    setCount?: number;
}

interface Props {
    open: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    sessions: RecentSessionItem[];
    onSelect?: (sessionId: string) => void;
    sessionHref?: (sessionId: string) => string;
    emptyMessage?: string;
    loading?: boolean;
    error?: string;
}

const PREVIEW_LIMIT = 5;

export { PREVIEW_LIMIT };

export function RecentSessionsListModal({
    open,
    onClose,
    title = "Workout History",
    subtitle,
    sessions,
    onSelect,
    sessionHref,
    emptyMessage = "No workouts logged yet.",
    loading = false,
    error = "",
}: Props) {
    if (!open) return null;

    return (
        <ModalOverlay onClose={onClose}>
            <div
                className="bg-surface-card w-full sm:max-w-lg max-h-[85vh] rounded-t-[2rem] sm:rounded-3xl border border-surface-border shadow-glow-brand-lg overflow-hidden animate-slide-up flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-surface-border shrink-0">
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">Session History</p>
                        <h3 className="text-lg font-black text-fg truncate">{title}</h3>
                        {subtitle && <p className="text-xs text-fg-muted mt-0.5">{subtitle}</p>}
                    </div>
                    <button type="button" onClick={onClose} className="btn-icon shrink-0" title="Close">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-surface-border min-h-0">
                    {loading ? (
                        <div className="p-12 text-center">
                            <Loader2 className="w-6 h-6 mx-auto animate-spin text-brand-400" />
                            <p className="text-sm text-fg-muted mt-3">Loading workout history...</p>
                        </div>
                    ) : error ? (
                        <p className="p-8 text-center text-sm text-danger">{error}</p>
                    ) : sessions.length === 0 ? (
                        <p className="p-8 text-center text-sm text-fg-muted">{emptyMessage}</p>
                    ) : (
                        sessions.map((session) => {
                            const row = (
                                <>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 rounded-xl bg-success-muted flex items-center justify-center shrink-0">
                                            <Activity className="w-4 h-4 text-success" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-fg truncate">{session.workoutName}</p>
                                            <p className="text-[10px] text-fg-muted font-bold uppercase tracking-widest">
                                                {formatDate(session.date)}
                                                {session.setCount != null ? ` · ${session.setCount} sets` : ""}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <p className="text-xs text-fg-muted">{formatRelative(session.date)}</p>
                                        <ChevronRight className="w-4 h-4 text-fg-subtle" />
                                    </div>
                                </>
                            );

                            const className =
                                "w-full flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-surface-muted/40 transition-colors text-left";

                            if (sessionHref) {
                                return (
                                    <Link
                                        key={session.id}
                                        href={sessionHref(session.id)}
                                        className={className}
                                        onClick={onClose}
                                    >
                                        {row}
                                    </Link>
                                );
                            }

                            return (
                                <button
                                    key={session.id}
                                    type="button"
                                    className={className}
                            onClick={() => {
                                onSelect?.(session.id);
                            }}
                                >
                                    {row}
                                </button>
                            );
                        })
                    )}
                </div>

                <div className="px-5 py-3 border-t border-surface-border shrink-0">
                    <p className="text-[10px] text-fg-subtle text-center font-bold uppercase tracking-widest">
                        {sessions.length} session{sessions.length !== 1 ? "s" : ""}
                    </p>
                </div>
            </div>
        </ModalOverlay>
    );
}
