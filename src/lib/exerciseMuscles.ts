/**
 * Maps exercises onto anatomy regions for the muscle visual.
 *
 * Resolution order for each exercise:
 * 1. Dictionary muscleTargets (admin-configured) when provided
 * 2. Per-movement overrides (e.g. Bench Press → chest + shoulders + triceps)
 * 3. Name heuristics for common compounds
 * 4. Muscle-group defaults (category secondaries, e.g. Chest → triceps/shoulders assist)
 *
 * Intensity is scored across the workout so lightly worked muscles read yellow and
 * heavily worked ones read red on a grey body.
 */

import { exerciseIdentityKey } from "@/lib/exerciseIdentity";
import {
    ALL_MUSCLE_REGIONS,
    MUSCLE_REGION_LABELS,
    type MuscleRegion,
} from "@/lib/muscleRegions";
import {
    MUSCLE_CONTRIBUTION_WEIGHTS,
    heatFromContribution,
    muscleHeatFill,
    muscleHeatOpacity,
    muscleHeatStroke,
    type MuscleHeatLevel,
} from "@/lib/muscleContribution";
import {
    targetsToHit,
    type MuscleTargetEntry,
} from "@/lib/muscleTargetEntries";

export type { MuscleRegion, MuscleHeatLevel };
export { ALL_MUSCLE_REGIONS, MUSCLE_REGION_LABELS };
export { muscleHeatFill, muscleHeatStroke, muscleHeatOpacity };

export type MuscleHit = {
    primary: MuscleRegion[];
    secondary: MuscleRegion[];
    minor: MuscleRegion[];
};

/** Loose hit shape used by overrides/heuristics — `minor` defaults in cleanHit. */
type MuscleHitInput = {
    primary: MuscleRegion[];
    secondary: MuscleRegion[];
    minor?: MuscleRegion[];
};

/** Category defaults — primary is the named group; secondary is typical assistance. */
const MUSCLE_GROUP_REGIONS: Record<string, MuscleHit> = {
    chest: { primary: ["chest"], secondary: ["shoulders", "triceps"], minor: [] },
    back: { primary: ["lats", "upperBack"], secondary: ["biceps", "traps", "forearms"], minor: [] },
    lats: { primary: ["lats"], secondary: ["biceps", "upperBack"], minor: [] },
    shoulders: { primary: ["shoulders"], secondary: ["triceps", "traps"], minor: [] },
    biceps: { primary: ["biceps"], secondary: ["forearms"], minor: [] },
    triceps: { primary: ["triceps"], secondary: ["shoulders"], minor: [] },
    forearms: { primary: ["forearms"], secondary: [], minor: [] },
    traps: { primary: ["traps"], secondary: ["shoulders"], minor: [] },
    quads: { primary: ["quads"], secondary: ["glutes", "core"], minor: [] },
    hamstrings: { primary: ["hamstrings"], secondary: ["glutes", "lowerBack"], minor: [] },
    glutes: { primary: ["glutes"], secondary: ["hamstrings", "core"], minor: [] },
    calves: { primary: ["calves"], secondary: [], minor: [] },
    legs: { primary: ["quads", "hamstrings", "glutes"], secondary: ["calves", "core"], minor: [] },
    core: { primary: ["core", "obliques"], secondary: [], minor: [] },
    "full body": {
        primary: ["quads", "glutes", "upperBack", "shoulders"],
        secondary: ["core", "hamstrings", "lowerBack", "triceps", "biceps", "forearms", "chest"],
        minor: [],
    },
    crossfit: {
        primary: ["quads", "glutes", "shoulders", "upperBack"],
        secondary: ["core", "hamstrings", "lowerBack", "triceps", "forearms", "chest"],
        minor: [],
    },
    calisthenics: {
        primary: ["chest", "lats", "shoulders", "core"],
        secondary: ["triceps", "biceps", "glutes"],
        minor: [],
    },
    cardio: { primary: [], secondary: [], minor: [] },
};

/**
 * Per-movement overrides keyed by `exerciseIdentityKey`.
 * These beat the category defaults so Bench Press lights chest + shoulders + triceps
 * even though its muscleGroup is simply "Chest".
 */
const EXERCISE_MUSCLE_OVERRIDES: Record<string, MuscleHitInput> = {
    // Chest presses (keys are post-alias identity keys from the Chest catalog)
    "barbell bench press": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
    "incline barbell bench press": { primary: ["chest", "shoulders"], secondary: ["triceps"] },
    "decline barbell bench press": { primary: ["chest"], secondary: ["triceps", "shoulders"] },
    "close grip barbell bench press": { primary: ["triceps", "chest"], secondary: ["shoulders"] },
    "wide grip barbell bench press": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
    "paused barbell bench press": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
    "spoto press": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
    "larsen press": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
    "barbell floor press": { primary: ["chest"], secondary: ["triceps", "shoulders"] },
    "guillotine press": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
    "dumbbell bench press": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
    "incline dumbbell bench press": { primary: ["chest", "shoulders"], secondary: ["triceps"] },
    "decline dumbbell bench press": { primary: ["chest"], secondary: ["triceps", "shoulders"] },
    "neutral grip dumbbell bench press": { primary: ["chest"], secondary: ["triceps", "shoulders"] },
    "machine chest press": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
    "incline machine chest press": { primary: ["chest", "shoulders"], secondary: ["triceps"] },
    "smith machine bench press": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
    "smith machine incline bench press": { primary: ["chest", "shoulders"], secondary: ["triceps"] },
    "cable chest press": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
    "landmine chest press": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
    "push up": { primary: ["chest"], secondary: ["shoulders", "triceps", "core"] },
    "wide grip push up": { primary: ["chest"], secondary: ["shoulders", "triceps", "core"] },
    "diamond push up": { primary: ["chest", "triceps"], secondary: ["shoulders"] },
    "dumbbell chest fly": { primary: ["chest"], secondary: ["shoulders"] },
    "incline dumbbell chest fly": { primary: ["chest", "shoulders"], secondary: [] },
    "cable chest fly": { primary: ["chest"], secondary: ["shoulders"] },
    "low to high cable fly": { primary: ["chest"], secondary: ["shoulders"] },
    "high to low cable fly": { primary: ["chest"], secondary: ["shoulders"] },
    "pec deck fly": { primary: ["chest"], secondary: [] },
    "machine chest fly": { primary: ["chest"], secondary: ["shoulders"] },
    "chest dip": { primary: ["chest", "triceps"], secondary: ["shoulders"] },
    "weighted chest dip": { primary: ["chest", "triceps"], secondary: ["shoulders"] },
    "assisted chest dip": { primary: ["chest", "triceps"], secondary: ["shoulders"] },
    "svend press": { primary: ["chest"], secondary: ["shoulders"] },
    "dip": { primary: ["chest", "triceps"], secondary: ["shoulders"] },

    // Shoulders
    "barbell overhead press": {
        primary: ["shoulders"],
        secondary: ["triceps", "traps", "chest", "core"],
    },
    "push press": { primary: ["shoulders"], secondary: ["triceps", "quads", "glutes", "core"] },
    "seated dumbbell shoulder press": { primary: ["shoulders"], secondary: ["triceps", "traps"] },
    "standing dumbbell shoulder press": { primary: ["shoulders"], secondary: ["triceps", "core"] },
    "arnold press": { primary: ["shoulders"], secondary: ["triceps"] },
    "machine shoulder press": { primary: ["shoulders"], secondary: ["triceps"] },
    "smith machine shoulder press": { primary: ["shoulders"], secondary: ["triceps"] },
    "plate loaded shoulder press": { primary: ["shoulders"], secondary: ["triceps"] },
    "landmine shoulder press": { primary: ["shoulders"], secondary: ["triceps", "chest", "core"] },
    "dumbbell lateral raise": { primary: ["shoulders"], secondary: ["traps"] },
    "cable lateral raise": { primary: ["shoulders"], secondary: ["traps"] },
    "machine lateral raise": { primary: ["shoulders"], secondary: ["traps"] },
    "lu raise": { primary: ["shoulders"], secondary: ["traps"] },
    "dumbbell front raise": { primary: ["shoulders"], secondary: ["chest"] },
    "cable front raise": { primary: ["shoulders"], secondary: [] },
    "plate front raise": { primary: ["shoulders"], secondary: [] },
    "dumbbell rear delt fly": { primary: ["shoulders", "upperBack"], secondary: ["traps"] },
    "cable rear delt fly": { primary: ["shoulders", "upperBack"], secondary: ["traps"] },
    "reverse pec deck": { primary: ["shoulders", "upperBack"], secondary: ["traps"] },
    "face pull": { primary: ["shoulders", "upperBack"], secondary: ["traps", "biceps"] },
    "barbell upright row": { primary: ["shoulders", "traps"], secondary: ["biceps"] },
    "cable upright row": { primary: ["shoulders", "traps"], secondary: ["biceps"] },
    "dumbbell y raise": { primary: ["shoulders"], secondary: ["traps", "upperBack"] },
    "w raise": { primary: ["shoulders", "upperBack"], secondary: ["traps"] },
    "cuban press": { primary: ["shoulders"], secondary: ["traps"] },
    "pike push up": { primary: ["shoulders"], secondary: ["triceps", "chest", "core"] },
    "handstand push up": { primary: ["shoulders"], secondary: ["triceps", "traps", "core"] },
    "handstand hold": { primary: ["shoulders"], secondary: ["traps", "core", "triceps"] },
    "shrug": { primary: ["traps"], secondary: ["shoulders"] },
    "barbell shrug": { primary: ["traps"], secondary: ["shoulders"] },
    "dumbbell shrug": { primary: ["traps"], secondary: ["shoulders"] },

    // Back
    "pull up": { primary: ["lats"], secondary: ["upperBack", "biceps", "forearms"] },
    "chin up": { primary: ["lats", "biceps"], secondary: ["upperBack", "forearms"] },
    "neutral grip pull up": { primary: ["lats"], secondary: ["upperBack", "biceps"] },
    "lat pulldown": { primary: ["lats"], secondary: ["biceps", "upperBack"] },
    "wide grip lat pulldown": { primary: ["lats"], secondary: ["upperBack", "biceps"] },
    "straight arm cable pulldown": { primary: ["lats"], secondary: ["core"] },
    "cable lat pullover": { primary: ["lats"], secondary: ["chest", "triceps"] },
    "dumbbell pullover": { primary: ["lats", "chest"], secondary: ["triceps"] },
    "seated cable row": { primary: ["upperBack", "lats"], secondary: ["biceps", "forearms"] },
    "close grip seated cable row": { primary: ["lats", "upperBack"], secondary: ["biceps"] },
    "wide grip seated cable row": { primary: ["upperBack", "lats"], secondary: ["biceps"] },
    "barbell row": { primary: ["upperBack"], secondary: ["lats", "biceps", "shoulders", "lowerBack"] },
    "pendlay row": { primary: ["upperBack", "lats"], secondary: ["biceps", "lowerBack"] },
    "single arm dumbbell row": { primary: ["lats"], secondary: ["upperBack", "biceps", "core"] },
    "t bar row": { primary: ["lats", "upperBack"], secondary: ["biceps", "lowerBack"] },
    "meadows row": { primary: ["lats", "upperBack"], secondary: ["biceps", "core"] },
    "inverted row": { primary: ["upperBack", "lats"], secondary: ["biceps", "core"] },
    "machine row": { primary: ["upperBack", "lats"], secondary: ["biceps"] },
    "plate loaded row": { primary: ["upperBack", "lats"], secondary: ["biceps"] },
    "conventional deadlift": {
        primary: ["hamstrings", "glutes", "lowerBack"],
        secondary: ["traps", "lats", "forearms", "quads", "core"],
    },
    "trap bar deadlift": {
        primary: ["glutes", "quads", "hamstrings"],
        secondary: ["lowerBack", "traps", "core"],
    },
    "rack pull": { primary: ["upperBack", "traps", "lowerBack"], secondary: ["glutes", "hamstrings", "forearms"] },
    "romanian deadlift": { primary: ["hamstrings", "glutes"], secondary: ["lowerBack", "core"] },
    "sumo deadlift": { primary: ["glutes", "hamstrings", "quads"], secondary: ["lowerBack", "traps", "core"] },
    "back extension": { primary: ["lowerBack"], secondary: ["glutes", "hamstrings"] },
    "good morning": { primary: ["hamstrings", "lowerBack"], secondary: ["glutes"] },
    "reverse hyperextension": { primary: ["glutes", "hamstrings"], secondary: ["lowerBack"] },

    // Legs
    "squat": { primary: ["quads", "glutes"], secondary: ["hamstrings", "core", "lowerBack"] },
    "barbell squat": { primary: ["quads", "glutes"], secondary: ["hamstrings", "core", "lowerBack"] },
    "back squat": { primary: ["quads", "glutes"], secondary: ["hamstrings", "core", "lowerBack"] },
    "front squat": { primary: ["quads", "core"], secondary: ["glutes", "upperBack"] },
    "goblet squat": { primary: ["quads", "glutes"], secondary: ["core"] },
    "leg press": { primary: ["quads", "glutes"], secondary: ["hamstrings"] },
    "leg extension": { primary: ["quads"], secondary: [] },
    "leg curl": { primary: ["hamstrings"], secondary: [] },
    "lying leg curl": { primary: ["hamstrings"], secondary: [] },
    "seated leg curl": { primary: ["hamstrings"], secondary: [] },
    "lunge": { primary: ["quads", "glutes"], secondary: ["hamstrings", "core"] },
    "walking lunge": { primary: ["quads", "glutes"], secondary: ["hamstrings", "core"] },
    "bulgarian split squat": { primary: ["quads", "glutes"], secondary: ["hamstrings", "core"] },
    "hip thrust": { primary: ["glutes"], secondary: ["hamstrings", "core"] },
    "glute bridge": { primary: ["glutes"], secondary: ["hamstrings", "core"] },
    "calf raise": { primary: ["calves"], secondary: [] },
    "standing calf raise": { primary: ["calves"], secondary: [] },
    "seated calf raise": { primary: ["calves"], secondary: [] },
    "leg raise": { primary: ["core"], secondary: ["obliques"] },
    "hanging leg raise": { primary: ["core"], secondary: ["obliques", "forearms"] },

    // Arms — biceps
    "barbell curl": { primary: ["biceps"], secondary: ["forearms"] },
    "ez bar curl": { primary: ["biceps"], secondary: ["forearms"] },
    "dumbbell curl": { primary: ["biceps"], secondary: ["forearms"] },
    "alternating dumbbell curl": { primary: ["biceps"], secondary: ["forearms"] },
    "incline dumbbell curl": { primary: ["biceps"], secondary: ["forearms"] },
    "concentration curl": { primary: ["biceps"], secondary: [] },
    "cable curl": { primary: ["biceps"], secondary: ["forearms"] },
    "bayesian curl": { primary: ["biceps"], secondary: ["forearms"] },
    "ez bar preacher curl": { primary: ["biceps"], secondary: ["forearms"] },
    "machine preacher curl": { primary: ["biceps"], secondary: ["forearms"] },
    "machine bicep curl": { primary: ["biceps"], secondary: ["forearms"] },
    "ez bar spider curl": { primary: ["biceps"], secondary: [] },
    "hammer curl": { primary: ["biceps", "forearms"], secondary: [] },
    "cross body hammer curl": { primary: ["biceps", "forearms"], secondary: [] },
    "rope hammer curl": { primary: ["biceps", "forearms"], secondary: [] },
    "reverse barbell curl": { primary: ["forearms", "biceps"], secondary: [] },
    "zottman curl": { primary: ["biceps", "forearms"], secondary: [] },
    "21": { primary: ["biceps"], secondary: ["forearms"] },
    // Arms — triceps
    "floor press": { primary: ["triceps", "chest"], secondary: ["shoulders"] },
    "jm press": { primary: ["triceps"], secondary: ["chest"] },
    "straight bar tricep pushdown": { primary: ["triceps"], secondary: [] },
    "rope tricep pushdown": { primary: ["triceps"], secondary: [] },
    "v bar tricep pushdown": { primary: ["triceps"], secondary: [] },
    "reverse grip tricep pushdown": { primary: ["triceps"], secondary: [] },
    "cable overhead tricep extension": { primary: ["triceps"], secondary: [] },
    "rope overhead tricep extension": { primary: ["triceps"], secondary: [] },
    "dumbbell overhead tricep extension": { primary: ["triceps"], secondary: [] },
    "ez bar skull crusher": { primary: ["triceps"], secondary: [] },
    "dumbbell skull crusher": { primary: ["triceps"], secondary: [] },
    "dumbbell tricep kickback": { primary: ["triceps"], secondary: [] },
    "cable tricep kickback": { primary: ["triceps"], secondary: [] },
    "tate press": { primary: ["triceps"], secondary: ["chest"] },
    "tricep dip": { primary: ["triceps"], secondary: ["chest", "shoulders"] },
    "bench dip": { primary: ["triceps"], secondary: ["chest", "shoulders"] },
    "machine tricep extension": { primary: ["triceps"], secondary: [] },
    "tricep pushdown": { primary: ["triceps"], secondary: [] },
    "skull crusher": { primary: ["triceps"], secondary: [] },
    "overhead tricep extension": { primary: ["triceps"], secondary: [] },
    "close grip bench press": { primary: ["triceps", "chest"], secondary: ["shoulders"] },
    "tricep extension": { primary: ["triceps"], secondary: ["shoulders"] },

    // Core
    "plank": { primary: ["core"], secondary: ["shoulders", "glutes"] },
    "crunch": { primary: ["core"], secondary: [] },
    "sit up": { primary: ["core"], secondary: [] },
    "russian twist": { primary: ["obliques", "core"], secondary: [] },
    "cable crunch": { primary: ["core"], secondary: [] },
    "ab wheel": { primary: ["core"], secondary: ["shoulders"] },

    // Full body / olympic-ish
    "clean": { primary: ["quads", "glutes", "traps", "shoulders"], secondary: ["core", "hamstrings", "forearms"] },
    "power clean": { primary: ["quads", "glutes", "traps", "shoulders"], secondary: ["core", "hamstrings", "forearms"] },
    "snatch": { primary: ["quads", "glutes", "shoulders", "traps"], secondary: ["core", "upperBack"] },
    "thruster": { primary: ["quads", "shoulders", "glutes"], secondary: ["triceps", "core"] },
    "burpee": { primary: ["chest", "quads", "shoulders"], secondary: ["core", "triceps", "glutes"] },
    "kettlebell swing": { primary: ["glutes", "hamstrings"], secondary: ["core", "shoulders", "forearms"] },
    "farmer carry": { primary: ["forearms", "traps", "core"], secondary: ["shoulders", "glutes"] },
    "suitcase carry": { primary: ["forearms", "core"], secondary: ["traps", "obliques"] },
    "barbell wrist curl": { primary: ["forearms"], secondary: [] },
    "barbell reverse wrist curl": { primary: ["forearms"], secondary: [] },
    "dumbbell wrist curl": { primary: ["forearms"], secondary: [] },
    "dead hang": { primary: ["forearms"], secondary: ["lats", "shoulders"] },
    "plate pinch hold": { primary: ["forearms"], secondary: [] },
    "hand gripper": { primary: ["forearms"], secondary: [] },
    "wrist roller": { primary: ["forearms"], secondary: [] },
    "barbell hold": { primary: ["forearms"], secondary: ["traps"] },
};

/** Keyword heuristics when no exact override exists — checked in order. */
const NAME_HEURISTICS: Array<{ match: RegExp; hit: MuscleHitInput }> = [
    { match: /\bbench\b.*\bpress\b|\bpress\b.*\bbench\b/i, hit: { primary: ["chest"], secondary: ["shoulders", "triceps"] } },
    { match: /\bincline\b.*\bpress\b/i, hit: { primary: ["chest", "shoulders"], secondary: ["triceps"] } },
    { match: /\boverhead\b|\bmilitary\b|\bshoulder press\b|\bohp\b/i, hit: { primary: ["shoulders"], secondary: ["triceps", "traps", "core"] } },
    { match: /\bpull[\s-]?up\b|\bchin[\s-]?up\b/i, hit: { primary: ["lats", "upperBack"], secondary: ["biceps", "forearms"] } },
    { match: /\brow\b/i, hit: { primary: ["lats", "upperBack"], secondary: ["biceps", "forearms"] } },
    { match: /\bdeadlift\b|\brdl\b/i, hit: { primary: ["hamstrings", "glutes", "lowerBack"], secondary: ["traps", "forearms", "core"] } },
    { match: /\bsquat\b/i, hit: { primary: ["quads", "glutes"], secondary: ["hamstrings", "core", "lowerBack"] } },
    { match: /\blunge\b|\bsplit squat\b/i, hit: { primary: ["quads", "glutes"], secondary: ["hamstrings", "core"] } },
    { match: /\bcurl\b/i, hit: { primary: ["biceps"], secondary: ["forearms"] } },
    { match: /\btricep|\bextension\b.*\boverhead\b|\bpushdown\b|\bskull/i, hit: { primary: ["triceps"], secondary: [] } },
    { match: /\bfly\b|\bflye\b/i, hit: { primary: ["chest"], secondary: ["shoulders"] } },
    { match: /\bdip\b/i, hit: { primary: ["chest", "triceps"], secondary: ["shoulders"] } },
    { match: /\blateral raise\b|\bside raise\b/i, hit: { primary: ["shoulders"], secondary: ["traps"] } },
    { match: /\bshrug\b/i, hit: { primary: ["traps"], secondary: ["shoulders"] } },
    { match: /\bplank\b|\bcrunch\b|\bsit[\s-]?up\b|\bcore\b/i, hit: { primary: ["core"], secondary: ["obliques"] } },
    { match: /\bcalf\b/i, hit: { primary: ["calves"], secondary: [] } },
    { match: /\bhip thrust\b|\bglute\b/i, hit: { primary: ["glutes"], secondary: ["hamstrings", "core"] } },
    { match: /\bleg press\b/i, hit: { primary: ["quads", "glutes"], secondary: ["hamstrings"] } },
    { match: /\bleg curl\b/i, hit: { primary: ["hamstrings"], secondary: [] } },
    { match: /\bleg extension\b/i, hit: { primary: ["quads"], secondary: [] } },
    { match: /\bpulldown\b|\bpull down\b/i, hit: { primary: ["lats"], secondary: ["biceps", "upperBack"] } },
];

function normalizeGroup(group: string | null | undefined): string | null {
    const trimmed = (group ?? "").trim().toLowerCase();
    return trimmed || null;
}

function cleanHit(hit: MuscleHitInput): MuscleHit {
    const primary = [...new Set(hit.primary)];
    const secondary = [...new Set(hit.secondary)].filter((r) => !primary.includes(r));
    const minor = [...new Set(hit.minor ?? [])].filter(
        (r) => !primary.includes(r) && !secondary.includes(r)
    );
    return { primary, secondary, minor };
}

/**
 * Regions trained by one exercise.
 * Dictionary targets win when non-empty; otherwise overrides → heuristics → group defaults.
 */
export function musclesForExercise(
    name: string | null | undefined,
    muscleGroup?: string | null,
    dictionaryTargets?: MuscleTargetEntry[] | null
): MuscleHit {
    if (dictionaryTargets && dictionaryTargets.length > 0) {
        return cleanHit(targetsToHit(dictionaryTargets));
    }

    const key = exerciseIdentityKey(name);
    if (key && EXERCISE_MUSCLE_OVERRIDES[key]) {
        return cleanHit(EXERCISE_MUSCLE_OVERRIDES[key]);
    }

    if (name) {
        for (const rule of NAME_HEURISTICS) {
            if (rule.match.test(name)) return cleanHit(rule.hit);
        }
    }

    const groupKey = normalizeGroup(muscleGroup);
    if (groupKey && MUSCLE_GROUP_REGIONS[groupKey]) {
        return cleanHit(MUSCLE_GROUP_REGIONS[groupKey]);
    }

    return { primary: [], secondary: [], minor: [] };
}

export interface WorkoutMuscleBreakdown {
    primary: MuscleRegion[];
    secondary: MuscleRegion[];
    /** Relative work per region, 0–1. */
    intensity: Partial<Record<MuscleRegion, number>>;
    /** Discrete heat band for colouring. */
    heat: Partial<Record<MuscleRegion, MuscleHeatLevel>>;
    groups: string[];
    unknownExerciseCount: number;
    activityGroups: string[];
}

const EMPTY_BREAKDOWN: WorkoutMuscleBreakdown = {
    primary: [],
    secondary: [],
    intensity: {},
    heat: {},
    groups: [],
    unknownExerciseCount: 0,
    activityGroups: [],
};

export type WorkoutMuscleExerciseInput = {
    name?: string;
    muscleGroup?: string | null;
    sets?: number;
    muscleTargets?: MuscleTargetEntry[];
};

/**
 * Aggregates a workout into primary/secondary regions plus per-region intensity.
 * Score = contribution weight × sets; heat bands from muscleContribution.
 */
export function buildWorkoutMuscleBreakdown(
    exercises: WorkoutMuscleExerciseInput[]
): WorkoutMuscleBreakdown {
    if (exercises.length === 0) return EMPTY_BREAKDOWN;

    const scores: Partial<Record<MuscleRegion, number>> = {};
    const primary = new Set<MuscleRegion>();
    const secondary = new Set<MuscleRegion>();
    const groups: string[] = [];
    const activityGroups: string[] = [];
    let unknownExerciseCount = 0;

    for (const exercise of exercises) {
        const hit = musclesForExercise(
            exercise.name,
            exercise.muscleGroup,
            exercise.muscleTargets
        );
        const groupKey = normalizeGroup(exercise.muscleGroup);
        const setMultiplier = Math.max(1, exercise.sets || 1);

        if (
            hit.primary.length === 0 &&
            hit.secondary.length === 0 &&
            hit.minor.length === 0
        ) {
            if (groupKey === "cardio" && exercise.muscleGroup) {
                const display = exercise.muscleGroup.trim();
                if (!activityGroups.includes(display)) activityGroups.push(display);
            } else {
                unknownExerciseCount++;
            }
            continue;
        }

        if (exercise.muscleGroup?.trim() && !groups.includes(exercise.muscleGroup.trim())) {
            groups.push(exercise.muscleGroup.trim());
        }

        for (const region of hit.primary) {
            primary.add(region);
            scores[region] =
                (scores[region] ?? 0) + MUSCLE_CONTRIBUTION_WEIGHTS.primary * setMultiplier;
        }
        for (const region of hit.secondary) {
            if (!primary.has(region)) secondary.add(region);
            scores[region] =
                (scores[region] ?? 0) + MUSCLE_CONTRIBUTION_WEIGHTS.secondary * setMultiplier;
        }
        for (const region of hit.minor) {
            scores[region] =
                (scores[region] ?? 0) + MUSCLE_CONTRIBUTION_WEIGHTS.minor * setMultiplier;
        }
    }

    for (const region of primary) secondary.delete(region);

    const maxScore = Math.max(0, ...Object.values(scores));
    const intensity: Partial<Record<MuscleRegion, number>> = {};
    const heat: Partial<Record<MuscleRegion, MuscleHeatLevel>> = {};
    for (const region of ALL_MUSCLE_REGIONS) {
        const score = scores[region] ?? 0;
        if (score <= 0) continue;
        intensity[region] = maxScore > 0 ? score / maxScore : 0;
        heat[region] = heatFromContribution(score, maxScore);
    }

    return {
        primary: [...primary],
        secondary: [...secondary],
        intensity,
        heat,
        groups,
        unknownExerciseCount,
        activityGroups,
    };
}

export function hasMuscleData(breakdown: WorkoutMuscleBreakdown): boolean {
    return breakdown.primary.length > 0 || breakdown.secondary.length > 0;
}
