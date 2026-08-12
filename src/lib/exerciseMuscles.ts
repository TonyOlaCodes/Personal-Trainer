/**
 * Maps exercise metadata onto anatomy regions for the muscle visual.
 *
 * Nothing here invents muscle data. Every region comes from an exercise's
 * `muscleGroup` — the only muscle field the library stores — so an exercise with no
 * metadata contributes nothing rather than a guess. Secondary muscles are therefore
 * only reported where the library genuinely distinguishes them, which today is
 * compound categories that name more than one region ("Full Body", "CrossFit").
 */

export type MuscleRegion =
    | "chest"
    | "upperBack"
    | "lats"
    | "lowerBack"
    | "traps"
    | "shoulders"
    | "biceps"
    | "triceps"
    | "forearms"
    | "core"
    | "obliques"
    | "glutes"
    | "quads"
    | "hamstrings"
    | "calves";

export const MUSCLE_REGION_LABELS: Record<MuscleRegion, string> = {
    chest: "Chest",
    upperBack: "Upper back",
    lats: "Lats",
    lowerBack: "Lower back",
    traps: "Traps",
    shoulders: "Shoulders",
    biceps: "Biceps",
    triceps: "Triceps",
    forearms: "Forearms",
    core: "Core",
    obliques: "Obliques",
    glutes: "Glutes",
    quads: "Quads",
    hamstrings: "Hamstrings",
    calves: "Calves",
};

/**
 * Regions a library muscle group trains. `primary` is what the metadata names
 * directly; `secondary` only appears for groups that explicitly describe a
 * multi-region category.
 */
const MUSCLE_GROUP_REGIONS: Record<string, { primary: MuscleRegion[]; secondary: MuscleRegion[] }> = {
    chest: { primary: ["chest"], secondary: [] },
    back: { primary: ["lats", "upperBack"], secondary: [] },
    lats: { primary: ["lats"], secondary: [] },
    shoulders: { primary: ["shoulders"], secondary: [] },
    biceps: { primary: ["biceps"], secondary: [] },
    triceps: { primary: ["triceps"], secondary: [] },
    forearms: { primary: ["forearms"], secondary: [] },
    traps: { primary: ["traps"], secondary: [] },
    quads: { primary: ["quads"], secondary: [] },
    hamstrings: { primary: ["hamstrings"], secondary: [] },
    glutes: { primary: ["glutes"], secondary: [] },
    calves: { primary: ["calves"], secondary: [] },
    legs: { primary: ["quads", "hamstrings", "glutes"], secondary: [] },
    core: { primary: ["core", "obliques"], secondary: [] },
    // Categories the library defines as whole-body work: the named regions are
    // primary movers, the rest support the movement.
    "full body": {
        primary: ["quads", "glutes", "upperBack", "shoulders"],
        secondary: ["core", "hamstrings", "lowerBack", "triceps", "biceps", "forearms"],
    },
    crossfit: {
        primary: ["quads", "glutes", "shoulders", "upperBack"],
        secondary: ["core", "hamstrings", "lowerBack", "triceps", "forearms"],
    },
    calisthenics: {
        primary: ["chest", "lats", "shoulders", "core"],
        secondary: ["triceps", "biceps", "glutes"],
    },
    // Cardio is not a muscle group; the library uses it as an activity category.
    cardio: { primary: [], secondary: [] },
};

export interface WorkoutMuscleBreakdown {
    primary: MuscleRegion[];
    secondary: MuscleRegion[];
    /** Library muscle groups seen, in display order. */
    groups: string[];
    /** Exercises whose metadata has no muscle group — surfaced instead of guessed. */
    unknownExerciseCount: number;
    /** Exercises categorised as an activity rather than a muscle group. */
    activityGroups: string[];
}

const EMPTY_BREAKDOWN: WorkoutMuscleBreakdown = {
    primary: [],
    secondary: [],
    groups: [],
    unknownExerciseCount: 0,
    activityGroups: [],
};

function normalizeGroup(group: string | null | undefined): string | null {
    const trimmed = (group ?? "").trim().toLowerCase();
    return trimmed || null;
}

/** Regions trained by a single exercise, from its muscle group metadata. */
export function musclesForExercise(
    muscleGroup: string | null | undefined
): { primary: MuscleRegion[]; secondary: MuscleRegion[] } {
    const key = normalizeGroup(muscleGroup);
    if (!key) return { primary: [], secondary: [] };
    const mapped = MUSCLE_GROUP_REGIONS[key];
    if (!mapped) return { primary: [], secondary: [] };
    return { primary: [...mapped.primary], secondary: [...mapped.secondary] };
}

/**
 * Aggregates a workout's exercises into primary and secondary regions.
 * A region named as primary by any exercise stays primary.
 */
export function buildWorkoutMuscleBreakdown(
    exercises: Array<{ name?: string; muscleGroup?: string | null }>
): WorkoutMuscleBreakdown {
    if (exercises.length === 0) return EMPTY_BREAKDOWN;

    const primary = new Set<MuscleRegion>();
    const secondary = new Set<MuscleRegion>();
    const groups: string[] = [];
    const activityGroups: string[] = [];
    let unknownExerciseCount = 0;

    for (const exercise of exercises) {
        const key = normalizeGroup(exercise.muscleGroup);
        if (!key) {
            unknownExerciseCount++;
            continue;
        }

        const mapped = MUSCLE_GROUP_REGIONS[key];
        if (!mapped) {
            unknownExerciseCount++;
            continue;
        }

        const display = exercise.muscleGroup!.trim();
        if (mapped.primary.length === 0 && mapped.secondary.length === 0) {
            if (!activityGroups.includes(display)) activityGroups.push(display);
            continue;
        }

        if (!groups.includes(display)) groups.push(display);
        for (const region of mapped.primary) primary.add(region);
        for (const region of mapped.secondary) secondary.add(region);
    }

    for (const region of primary) secondary.delete(region);

    return {
        primary: [...primary],
        secondary: [...secondary],
        groups,
        unknownExerciseCount,
        activityGroups,
    };
}

/** True when there is enough metadata to draw the muscle visual. */
export function hasMuscleData(breakdown: WorkoutMuscleBreakdown): boolean {
    return breakdown.primary.length > 0 || breakdown.secondary.length > 0;
}
