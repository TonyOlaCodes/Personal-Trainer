/**
 * Historical duration estimate for a scheduled workout.
 * Uses completed sessions of the same workout id only.
 */

export type DurationLogSample = {
    workoutId: string;
    status?: string | null;
    duration?: number | null;
};

export function isValidCompletedDuration(duration: number | null | undefined): duration is number {
    return typeof duration === "number" && Number.isFinite(duration) && duration > 0 && duration <= 1440;
}

export function averageHistoricalDurationMinutes(
    logs: DurationLogSample[],
    workoutId: string
): number | null {
    const samples = logs.filter(
        (log) =>
            log.workoutId === workoutId
            && (log.status == null || log.status === "COMPLETED")
            && isValidCompletedDuration(log.duration)
    );
    if (samples.length === 0) return null;
    const total = samples.reduce((sum, log) => sum + (log.duration as number), 0);
    return Math.round(total / samples.length);
}

export function fallbackPlannedDurationMinutes(
    exercises: Array<{ sets?: number | null }>
): number {
    const sets = exercises.reduce((sum, exercise) => sum + Math.max(0, exercise.sets ?? 0), 0);
    if (sets <= 0) return 45;
    return Math.min(120, Math.max(30, Math.round(sets * 3)));
}

export function formatWorkoutDurationEstimate(minutes: number): string {
    return `≈${minutes} min`;
}

export function resolveWorkoutDurationEstimate(
    workoutId: string,
    logs: DurationLogSample[],
    exercises: Array<{ sets?: number | null }>
): { minutes: number; fromHistory: boolean } {
    const historical = averageHistoricalDurationMinutes(logs, workoutId);
    if (historical != null) return { minutes: historical, fromHistory: true };
    return { minutes: fallbackPlannedDurationMinutes(exercises), fromHistory: false };
}
