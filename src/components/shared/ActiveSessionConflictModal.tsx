"use client";

import { Flame, X } from "lucide-react";
import { formatDate } from "@/lib/utils";

export type ConflictingActiveSession = {
    id: string;
    workoutId: string;
    workoutName: string;
    dateKey: string;
    resumeHref: string;
    completedSetCount: number;
    totalSetCount: number;
    isBackdated: boolean;
};

export function parseActiveSessionConflict(payload: unknown): ConflictingActiveSession | null {
    if (!payload || typeof payload !== "object") return null;
    const data = payload as {
        error?: string;
        activeSession?: ConflictingActiveSession;
    };
    if (data.error !== "ACTIVE_SESSION_EXISTS" || !data.activeSession?.id) return null;
    return data.activeSession;
}

type Props = {
    session: ConflictingActiveSession;
    /** Name of the workout the user is trying to start. */
    pendingWorkoutName?: string;
    busy?: boolean;
    onResume: () => void;
    onEndAndStart: () => void;
    onCancel: () => void;
};

/**
 * Shown when Start is blocked because another IN_PROGRESS session already exists.
 */
export function ActiveSessionConflictModal({
    session,
    pendingWorkoutName,
    busy = false,
    onResume,
    onEndAndStart,
    onCancel,
}: Props) {
    const progress = session.totalSetCount > 0
        ? `${session.completedSetCount}/${session.totalSetCount} sets logged`
        : "Just started";

    return (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/80 animate-fade-in sm:p-4">
            <div
                className="bg-surface-card w-full sm:max-w-md rounded-t-[1.75rem] sm:rounded-[1.75rem] border border-surface-border shadow-glow-brand-lg p-5 sm:p-6 space-y-4 animate-slide-up"
                role="dialog"
                aria-modal="true"
                aria-labelledby="active-session-conflict-title"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-full bg-warning/90 flex items-center justify-center shrink-0">
                            <Flame className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                            <p
                                id="active-session-conflict-title"
                                className="text-lg font-black text-fg tracking-tight"
                            >
                                Workout already started
                            </p>
                            <p className="text-sm text-fg-muted mt-1 leading-relaxed">
                                You already have{" "}
                                <span className="font-bold text-fg">{session.workoutName}</span>
                                {session.isBackdated ? ` (${formatDate(session.dateKey)})` : ""}{" "}
                                in progress
                                {pendingWorkoutName
                                    ? <> — end it before starting <span className="font-bold text-fg">{pendingWorkoutName}</span></>
                                    : null}
                                .
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        className="btn-icon w-9 h-9 rounded-xl shrink-0"
                        aria-label="Cancel"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <p className="text-xs font-semibold text-fg-subtle px-1">
                    {progress}. Ending it discards any unsaved sets from that session.
                </p>

                <div className="flex flex-col gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onResume}
                        disabled={busy}
                        className="btn-primary h-12 w-full"
                    >
                        Resume {session.workoutName}
                    </button>
                    <button
                        type="button"
                        onClick={onEndAndStart}
                        disabled={busy}
                        className="btn-secondary h-12 w-full border-danger/30 text-danger hover:bg-danger/10"
                    >
                        {busy ? "Starting…" : "End it & start this one"}
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        className="h-11 w-full text-sm font-bold text-fg-muted hover:text-fg"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
