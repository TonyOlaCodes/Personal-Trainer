/**
 * Server-authoritative workout save decisions.
 * Used by /api/logs and by the reliability tests so the rules cannot drift.
 */

export type WorkoutLogStatus = "IN_PROGRESS" | "COMPLETED";

export function acceptWorkoutRevision(
    expectedRevision: number | null | undefined,
    currentRevision: number
): boolean {
    if (expectedRevision == null) return currentRevision === 0;
    return expectedRevision === currentRevision;
}

export function nextWorkoutRevision(currentRevision: number): number {
    return currentRevision + 1;
}

/** Side effects fire only on the first transition into COMPLETED. */
export function shouldEmitCompletionSideEffects(
    previousStatus: WorkoutLogStatus | null,
    nextStatus: WorkoutLogStatus
): boolean {
    return nextStatus === "COMPLETED" && previousStatus !== "COMPLETED";
}

export function shouldCreateInProgressLog(existingInProgressId: string | null | undefined): boolean {
    return !existingInProgressId;
}

export type WorkoutSaveConflict = "STALE_REVISION" | "ACTIVE_SESSION_EXISTS";

export function staleRevisionPayload(currentRevision: number) {
    return {
        error: "STALE_REVISION",
        message: "This workout was updated elsewhere. Reload to continue.",
        currentRevision,
    };
}
