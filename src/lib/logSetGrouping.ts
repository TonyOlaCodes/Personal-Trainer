import { resolveLogSetExerciseName } from "@/lib/logSetExerciseName";

export type GroupableLogSet = {
    id?: string;
    exerciseId: string;
    exerciseName?: string | null;
    exerciseOrder?: number | null;
    setNumber: number;
    reps?: number | null;
    weightKg?: number | null;
    rpe?: number | null;
    durationSec?: number | null;
    distanceMeters?: number | null;
    heightCm?: number | null;
    resistance?: number | null;
    inclinePct?: number | null;
    calories?: number | null;
    heartRate?: number | null;
    speedKph?: number | null;
    rir?: number | null;
    isWarmup?: boolean | null;
    isCompleted?: boolean | null;
    isPR?: boolean | null;
    videoUrl?: string | null;
    exercise?: {
        id?: string;
        name?: string | null;
        muscleGroup?: string | null;
        order?: number | null;
        isCustom?: boolean | null;
    } | null;
};

export type GroupedLogExercise<T extends GroupableLogSet> = {
    exerciseId: string;
    name: string;
    muscleGroup: string | null;
    order: number;
    sets: T[];
};

/** Stable sort order for log-set queries: session order, then set number. */
export const logSetDisplayOrderBy = [
    { exerciseOrder: "asc" as const },
    { exercise: { order: "asc" as const } },
    { setNumber: "asc" as const },
];

export function resolveExerciseOrderFromSet(set: GroupableLogSet, fallbackIndex: number): number {
    if (typeof set.exerciseOrder === "number" && set.exerciseOrder >= 0) {
        return set.exerciseOrder;
    }
    if (typeof set.exercise?.order === "number" && set.exercise.order >= 0) {
        return set.exercise.order;
    }
    return 1000 + fallbackIndex;
}

export function formatLoggedWeight(weightKg?: number | null): string {
    if (weightKg == null || weightKg <= 0) return "—";
    const rounded = Number.isInteger(weightKg) ? weightKg : Math.round(weightKg * 10) / 10;
    return `${rounded}kg`;
}

/** Group log sets by exercise, preserving plan/session order at log time. */
export function groupLogSetsByExercise<T extends GroupableLogSet>(
    sets: T[],
    resolveName: (set: T) => string = (set) => resolveLogSetExerciseName(set)
): GroupedLogExercise<T>[] {
    const groups = new Map<string, GroupedLogExercise<T> & { firstIndex: number }>();

    sets.forEach((set, index) => {
        const order = resolveExerciseOrderFromSet(set, index);
        const existing = groups.get(set.exerciseId);

        if (!existing) {
            groups.set(set.exerciseId, {
                exerciseId: set.exerciseId,
                name: resolveName(set),
                muscleGroup: set.exercise?.muscleGroup ?? null,
                order,
                sets: [set],
                firstIndex: index,
            });
            return;
        }

        existing.name = resolveName(set);
        existing.order = Math.min(existing.order, order);
        existing.sets.push(set);
    });

    return [...groups.values()]
        .sort((a, b) => a.order - b.order || a.firstIndex - b.firstIndex)
        .map(({ firstIndex: _firstIndex, ...group }) => ({
            ...group,
            sets: group.sets.slice().sort((a, b) => a.setNumber - b.setNumber),
        }));
}
