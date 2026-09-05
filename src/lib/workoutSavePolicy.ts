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

export function incomingSetIsMeaningful(set: {
    isCompleted?: boolean | null;
    reps?: number | null;
    weightKg?: number | null;
    rpe?: number | null;
    videoUrl?: string | null;
}): boolean {
    return (
        Boolean(set.isCompleted) ||
        (typeof set.reps === "number" && set.reps > 0) ||
        (typeof set.weightKg === "number" && set.weightKg > 0) ||
        (typeof set.rpe === "number" && set.rpe > 0) ||
        Boolean(set.videoUrl)
    );
}

/**
 * Start Workout may re-post empty plan placeholders. Ignore those so they cannot
 * wipe an open session. After the first accepted revision, the payload IS the
 * session: delete/add/swap must apply even when remaining sets are empty.
 */
export function shouldApplyInProgressSetReplacement(input: {
    incomingHasMeaningfulSets: boolean;
    expectedRevision: number | null | undefined;
    incomingExerciseIds: readonly string[];
    existingExerciseIds: readonly string[];
}): boolean {
    if (input.incomingHasMeaningfulSets) return true;
    if (input.expectedRevision != null && input.expectedRevision > 0) return true;

    const incoming = new Set(input.incomingExerciseIds);
    const existing = new Set(input.existingExerciseIds);
    if (incoming.size !== existing.size) return true;
    for (const id of existing) {
        if (!incoming.has(id)) return true;
    }
    return false;
}

export type WorkoutSaveConflict = "STALE_REVISION" | "ACTIVE_SESSION_EXISTS";

export function staleRevisionPayload(currentRevision: number) {
    return {
        error: "STALE_REVISION",
        message: "This workout was updated elsewhere. Reload to continue.",
        currentRevision,
    };
}
