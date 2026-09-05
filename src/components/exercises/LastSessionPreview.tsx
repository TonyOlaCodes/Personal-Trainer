"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { formatHistorySetLine, formatSessionContext } from "@/lib/exerciseHistoryFormat";
import { DEFAULT_STRENGTH_SCHEMA } from "@/lib/exerciseTracking/presets";
import {
    fetchExerciseSessionHistory,
    type ExerciseHistoryPayload,
} from "@/components/exercises/ExerciseHistoryPanel";

/**
 * Compact "what they did last time" strip shown next to the exercise being
 * programmed, so simple progression calls don't need the full inspector.
 *
 * Reads the same cached payload as the inspector — no separate history maths.
 */
export function LastSessionPreview({
    exerciseName,
    clientId,
    planId,
    enabled = true,
    className,
}: {
    exerciseName: string;
    clientId?: string | null;
    planId?: string | null;
    enabled?: boolean;
    className?: string;
}) {
    const [data, setData] = useState<ExerciseHistoryPayload | null>(null);
    const trimmed = exerciseName.trim();

    useEffect(() => {
        // Names are edited by typing in the plan editor — wait for a pause so a
        // partially typed name doesn't fire a lookup per keystroke.
        if (!enabled || trimmed.length < 3) {
            setData(null);
            return;
        }
        let cancelled = false;
        const timer = setTimeout(() => {
            fetchExerciseSessionHistory(trimmed, clientId, planId)
                .then((payload) => {
                    if (!cancelled) setData(payload);
                })
                .catch(() => {
                    if (!cancelled) setData(null);
                });
        }, 400);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [trimmed, clientId, planId, enabled]);

    const session = data?.sessions[0];
    if (!session) return null;

    const schema = data?.trackingSchema ?? DEFAULT_STRENGTH_SCHEMA;
    const unitSystem = data?.unitSystem ?? "METRIC";

    return (
        <div
            className={cn(
                "rounded-lg border border-surface-border/60 bg-surface-muted/30 px-2.5 py-2",
                className
            )}
        >
            <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle truncate">
                Last session · {formatSessionContext(session)} · {session.dateLabel}
            </p>
            <p className="text-[11px] font-semibold text-fg-muted mt-1 leading-relaxed">
                {session.sets
                    .map((set) => formatHistorySetLine(set, schema, unitSystem))
                    .join("  ·  ")}
            </p>
        </div>
    );
}
