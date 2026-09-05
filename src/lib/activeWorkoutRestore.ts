/**
 * Resume an IN_PROGRESS workout from the persisted instance, not the plan.
 * The plan only seeds the first Start Workout create.
 */

export function uniquePersistedExerciseIds(
    sets: Array<{ exerciseId?: string | null }>
): string[] {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const set of sets) {
        const id = set.exerciseId?.trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
    }
    return ids;
}

/**
 * Keep plan metadata (targets, notes) for IDs that still exist on the log.
 * Never re-insert a plan exercise that has no persisted sets.
 */
export function restoreExercisesFromPersistedSets<T extends { id: string; order?: number }>(
    persistedExercises: T[],
    planExercises: T[]
): T[] {
    const planById = new Map(planExercises.map((exercise) => [exercise.id, exercise]));
    return persistedExercises.map((exercise) => {
        const plan = planById.get(exercise.id);
        if (!plan) return exercise;
        return {
            ...plan,
            ...exercise,
            order: exercise.order ?? plan.order,
        };
    });
}
