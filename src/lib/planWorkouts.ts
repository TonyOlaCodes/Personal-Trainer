/** Workouts at or above this dayNumber are hidden from plan editors and schedules (history-only). */
export const ARCHIVED_WORKOUT_DAY_BASE = 9000;

/** Normal plan days use dayNumber 1–999. */
export const ACTIVE_WORKOUT_DAY_MAX = 999;

export function activeWorkoutWhere() {
    return { dayNumber: { lte: ACTIVE_WORKOUT_DAY_MAX } } as const;
}

/** Relocate workouts left in the temporary sync offset range (1000–8999) into the archive band. */
export function legacyOrphanDayNumber(dayNumber: number): number | null {
    if (dayNumber > ACTIVE_WORKOUT_DAY_MAX && dayNumber < ARCHIVED_WORKOUT_DAY_BASE) {
        return ARCHIVED_WORKOUT_DAY_BASE + (dayNumber - 1000);
    }
    return null;
}
