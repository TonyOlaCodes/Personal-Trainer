"use client";

import { useEffect, useState } from "react";
import { History, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    formatHistorySetLine,
    formatSessionContext,
    type ExerciseHistorySession,
} from "@/lib/exerciseHistoryFormat";
import { DEFAULT_STRENGTH_SCHEMA } from "@/lib/exerciseTracking/presets";
import type { ExerciseTrackingSchema } from "@/lib/exerciseTracking/types";
import type { UnitSystem } from "@/lib/units";

interface HistorySubjectPayload {
    kind: "user" | "unassigned";
    userId?: string;
    name?: string;
    isOtherUser?: boolean;
}

export interface ExerciseHistoryPayload {
    key: string;
    name: string;
    sessions: ExerciseHistorySession[];
    hasMore: boolean;
    trackingSchema: ExerciseTrackingSchema;
    unitSystem: UnitSystem;
    subject?: HistorySubjectPayload;
}

interface BatchResponse {
    exercises: Array<Omit<ExerciseHistoryPayload, "unitSystem"> & { requested: string }>;
    unitSystem: UnitSystem;
    subject?: HistorySubjectPayload;
}

/**
 * Module-level cache keyed by client + exercise, holding the in-flight promise too,
 * so a quick-preview and the inspector asking for the same exercise share one request.
 */
const cache = new Map<string, { at: number; payload: Promise<ExerciseHistoryPayload> }>();

/** Long enough to make navigating an editor free, short enough to pick up new sessions. */
const CACHE_TTL_MS = 120_000;

/** Names requested this tick, per client, so one editor screen makes one request. */
const pending = new Map<
    string,
    Array<{
        name: string;
        resolve: (payload: ExerciseHistoryPayload) => void;
        reject: (err: unknown) => void;
    }>
>();

/** Matches MAX_NAMES on the route. */
const MAX_BATCH = 40;

function subjectKey(clientId?: string | null, planId?: string | null) {
    return `${planId ?? ""}::${clientId ?? "self"}`;
}

function cacheKey(name: string, clientId?: string | null, planId?: string | null) {
    return `${subjectKey(clientId, planId)}::${name.trim().toLowerCase()}`;
}

export function invalidateExerciseHistoryCache() {
    cache.clear();
}

async function flushBatch(clientId: string | null, planId: string | null) {
    const batchKey = subjectKey(clientId, planId);
    const queued = pending.get(batchKey) ?? [];
    pending.delete(batchKey);
    if (queued.length === 0) return;

    for (let i = 0; i < queued.length; i += MAX_BATCH) {
        const chunk = queued.slice(i, i + MAX_BATCH);
        const params = new URLSearchParams();
        for (const item of chunk) params.append("name", item.name);
        if (clientId) params.set("clientId", clientId);
        if (planId) params.set("planId", planId);

        try {
            const res = await fetch(`/api/exercises/session-history?${params.toString()}`);
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error ?? "Could not load exercise history");
            }
            const data = (await res.json()) as BatchResponse;
            // Match on the echoed name rather than position — the route may drop or
            // truncate entries, and a positional mismatch would show the wrong history.
            const byName = new Map(data.exercises.map((entry) => [entry.requested, entry]));

            for (const item of chunk) {
                const entry = byName.get(item.name);
                if (!entry) {
                    cache.delete(cacheKey(item.name, clientId, planId));
                    item.reject(new Error("Could not load exercise history"));
                    continue;
                }
                item.resolve({
                    ...entry,
                    unitSystem: data.unitSystem,
                    subject: data.subject,
                });
            }
        } catch (err) {
            for (const item of chunk) {
                // Never cache a failure — the next open should retry.
                cache.delete(cacheKey(item.name, clientId, planId));
                item.reject(err);
            }
        }
    }
}

export function fetchExerciseSessionHistory(
    name: string,
    clientId?: string | null,
    planId?: string | null
): Promise<ExerciseHistoryPayload> {
    const trimmed = name.trim();
    const ck = cacheKey(trimmed, clientId, planId);
    const cached = cache.get(ck);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.payload;

    const batchKey = subjectKey(clientId, planId);
    const request = new Promise<ExerciseHistoryPayload>((resolve, reject) => {
        const queue = pending.get(batchKey);
        if (queue) {
            queue.push({ name: trimmed, resolve, reject });
            return;
        }
        pending.set(batchKey, [{ name: trimmed, resolve, reject }]);
        // Collect everything requested during this render pass into one request.
        setTimeout(() => void flushBatch(clientId ?? null, planId ?? null), 0);
    });

    cache.set(ck, { at: Date.now(), payload: request });
    return request;
}

function SessionGroup({
    session,
    schema,
    unitSystem,
}: {
    session: ExerciseHistorySession;
    schema: ExerciseTrackingSchema;
    unitSystem: UnitSystem;
}) {
    return (
        <div className="rounded-xl border border-surface-border bg-surface-muted/20 px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-brand-400 truncate">
                    {formatSessionContext(session)}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle shrink-0">
                    {session.dateLabel}
                </p>
            </div>
            <div className="mt-1.5 space-y-0.5">
                {session.sets.map((set) => (
                    <p
                        key={`${session.logId}-${set.setNumber}`}
                        className={cn(
                            "text-xs font-semibold tabular-nums",
                            set.isPR ? "text-amber-300" : "text-fg"
                        )}
                    >
                        {formatHistorySetLine(set, schema, unitSystem)}
                    </p>
                ))}
            </div>
        </div>
    );
}

/**
 * Session-grouped completed history for one exercise.
 * Rendered inside the desktop split-view aside and the mobile modal alike.
 */
export function ExerciseHistoryPanel({
    exerciseName,
    clientId,
    planId,
    unassigned = false,
    subjectName,
    showSubjectName = false,
    onClose,
    className,
}: {
    exerciseName: string;
    clientId?: string | null;
    planId?: string | null;
    unassigned?: boolean;
    subjectName?: string | null;
    showSubjectName?: boolean;
    onClose: () => void;
    className?: string;
}) {
    const [data, setData] = useState<ExerciseHistoryPayload | null>(null);
    const [loading, setLoading] = useState(!unassigned);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setError(null);
        setData(null);

        if (unassigned) {
            setLoading(false);
            return;
        }

        setLoading(true);

        fetchExerciseSessionHistory(exerciseName, clientId, planId)
            .then((payload) => {
                if (cancelled) return;
                setData(payload);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : "Could not load exercise history");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [exerciseName, clientId, planId, unassigned]);

    const schema = data?.trackingSchema ?? DEFAULT_STRENGTH_SCHEMA;
    const unitSystem = data?.unitSystem ?? "METRIC";
    const resolvedSubjectName = subjectName || data?.subject?.name || null;
    const identifyOtherUser = showSubjectName
        || Boolean(data?.subject?.isOtherUser && data.subject.name);

    return (
        <div className={cn("flex flex-col min-h-0 bg-surface-card", className)}>
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-surface-border shrink-0">
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-400 flex items-center gap-1.5">
                        <History className="w-3 h-3" />
                        Exercise History
                    </p>
                    <h3 className="text-base font-black text-fg tracking-tight truncate mt-0.5">
                        {data?.name || exerciseName}
                    </h3>
                    {identifyOtherUser && resolvedSubjectName && (
                        <p className="text-[11px] font-bold text-fg-muted truncate mt-0.5">
                            {resolvedSubjectName}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="btn-icon shrink-0"
                    aria-label="Close exercise history"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-2">
                {loading && (
                    <div className="flex items-center justify-center py-10 text-fg-muted">
                        <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                )}

                {!loading && error && (
                    <p className="text-xs font-semibold text-danger px-1 py-6 text-center">{error}</p>
                )}

                {!loading && !error && unassigned && (
                    <div className="px-2 py-10 text-center">
                        <p className="text-sm font-bold text-fg">No client assigned</p>
                        <p className="text-xs text-fg-muted mt-1">
                            Exercise history will be available when viewing this plan for a client.
                        </p>
                    </div>
                )}

                {!loading && !error && !unassigned && data && data.sessions.length === 0 && (
                    <div className="px-2 py-10 text-center">
                        <p className="text-sm font-bold text-fg">No completed sets yet</p>
                        <p className="text-xs text-fg-muted mt-1">
                            History appears once this exercise has been logged.
                        </p>
                    </div>
                )}

                {!loading
                    && !error
                    && data?.sessions.map((session) => (
                        <SessionGroup
                            key={session.logId}
                            session={session}
                            schema={schema}
                            unitSystem={unitSystem}
                        />
                    ))}

                {!loading && data?.hasMore && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle text-center pt-1 pb-2">
                        Showing most recent sessions
                    </p>
                )}
            </div>
        </div>
    );
}
