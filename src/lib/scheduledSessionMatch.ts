/**
 * Canonical rule: a scheduled workout is completed only when a completed log
 * exists for that same workout id on that same app calendar day.
 *
 * Edit Session / overrides keep the original workout id, so an edited slot still
 * matches. A different plan workout logged on the same date does not complete it.
 */

export type DatedWorkoutRef = {
    date?: string;
    dateKey?: string;
    workoutId?: string | null;
};

function refDateKey(ref: DatedWorkoutRef): string | null {
    return ref.dateKey ?? ref.date ?? null;
}

export function scheduledSlotKey(dateKey: string, workoutId: string): string {
    return `${dateKey}:${workoutId}`;
}

export function logMatchesScheduledSlot(
    log: DatedWorkoutRef,
    dateKey: string,
    scheduledWorkoutId: string
): boolean {
    if (!log.workoutId) return false;
    return refDateKey(log) === dateKey && log.workoutId === scheduledWorkoutId;
}

export function findLogForScheduledSlot<T extends DatedWorkoutRef>(
    logs: T[],
    dateKey: string,
    scheduledWorkoutId: string | null | undefined
): T | null {
    if (!scheduledWorkoutId) return null;
    return logs.find((log) => logMatchesScheduledSlot(log, dateKey, scheduledWorkoutId)) ?? null;
}

export function isScheduledSlotCompleted(
    logs: DatedWorkoutRef[],
    dateKey: string,
    scheduledWorkoutId: string | null | undefined
): boolean {
    return findLogForScheduledSlot(logs, dateKey, scheduledWorkoutId) != null;
}
