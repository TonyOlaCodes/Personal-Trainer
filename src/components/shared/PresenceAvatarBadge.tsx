"use client";

import { cn } from "@/lib/utils";
import {
    formatPresenceWithWorkout,
    getPresenceIndicator,
} from "@/lib/userPresence";

/**
 * Presence (green = online from lastActiveAt only) plus optional workout chip.
 * An in-progress workout never replaces or forces the online dot.
 */
export function PresenceAvatarBadge({
    lastActiveAt,
    inWorkout,
    workoutName,
    className,
}: {
    lastActiveAt: string | Date | null | undefined;
    inWorkout?: boolean;
    workoutName?: string | null;
    className?: string;
}) {
    const presence = getPresenceIndicator(lastActiveAt);
    const title = formatPresenceWithWorkout(
        lastActiveAt,
        inWorkout ? workoutName || "Workout" : null
    );

    return (
        <>
            <span
                className={cn(
                    "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface-card",
                    presence.dotClassName,
                    className
                )}
                title={presence.label}
            />
            {inWorkout && (
                <span
                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface-card bg-brand-400 animate-pulse"
                    title={title}
                    aria-label="Workout in progress"
                />
            )}
        </>
    );
}

export function PresenceWorkoutStatusLine({
    lastActiveAt,
    workoutName,
    className,
}: {
    lastActiveAt: string | Date | null | undefined;
    workoutName?: string | null;
    className?: string;
}) {
    if (!workoutName) {
        const presence = getPresenceIndicator(lastActiveAt);
        return (
            <p className={cn("text-[10px] text-fg-subtle truncate", className)} title={presence.label}>
                {presence.label}
            </p>
        );
    }

    const label = formatPresenceWithWorkout(lastActiveAt, workoutName);
    return (
        <p className={cn("text-[10px] text-brand-400 font-bold truncate", className)} title={label}>
            {label}
        </p>
    );
}
