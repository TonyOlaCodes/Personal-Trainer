/**
 * Shared personal-record and previous-session logic.
 *
 * One implementation feeds the live workout screen, the save endpoint, the session
 * review pages and the coach progression views, so a "New Best" badge shown while
 * training is the same judgement that gets persisted on the set.
 *
 * Isomorphic: no Prisma, no server-only imports.
 */

import { exerciseIdentityKey } from "@/lib/exerciseIdentity";
import { calculateOneRM } from "@/lib/oneRepMax";

export interface HistoricalSetInput {
    exerciseName: string | null | undefined;
    setNumber: number;
    weightKg?: number | null;
    reps?: number | null;
    rpe?: number | null;
    isWarmup?: boolean | null;
    isCompleted?: boolean | null;
}

export interface HistoricalSessionInput {
    /** `YYYY-MM-DD` in app timezone. */
    dateKey: string;
    logId?: string;
    workoutName?: string;
    sets: HistoricalSetInput[];
}

/** A set as it was actually performed, ready to render as a comparison row. */
export interface PreviousSet {
    setNumber: number;
    weightKg: number | null;
    reps: number | null;
    rpe: number | null;
}

export interface PreviousSessionPerformance {
    dateKey: string;
    logId?: string;
    workoutName?: string;
    /** Only the sets that were actually performed, ordered by set number. */
    sets: PreviousSet[];
}

/** Best-ever numbers for one movement, used to judge new records. */
export interface ExerciseRecords {
    /** Heaviest completed working weight ever logged. */
    bestWeightKg: number | null;
    /** Reps achieved at `bestWeightKg`. */
    bestWeightReps: number | null;
    /** Highest reps ever recorded at each weight. */
    bestRepsByWeight: Record<string, number>;
    /** Best estimated one-rep max. */
    bestOneRm: number | null;
}

export const EMPTY_EXERCISE_RECORDS: ExerciseRecords = {
    bestWeightKg: null,
    bestWeightReps: null,
    bestRepsByWeight: {},
    bestOneRm: null,
};

/** Weight keys are strings so the record survives JSON transport intact. */
export function weightKey(weightKg: number): string {
    return String(Math.round(weightKg * 100) / 100);
}

function isWorkingSet(set: HistoricalSetInput): boolean {
    if (set.isWarmup) return false;
    if (set.isCompleted === false) return false;
    return (set.weightKg ?? 0) > 0 && (set.reps ?? 0) > 0;
}

/**
 * The most recent session where this exercise was actually performed.
 *
 * Deliberately returns that one session's sets and nothing else: a set 3 that was
 * never performed last time must stay blank rather than borrowing an older value.
 */
export function findPreviousSessionPerformance(
    sessions: HistoricalSessionInput[],
    exerciseName: string,
    options?: { beforeDateKey?: string; excludeLogId?: string }
): PreviousSessionPerformance | null {
    const key = exerciseIdentityKey(exerciseName);
    if (!key) return null;

    const candidates = sessions
        .filter((session) => {
            if (options?.excludeLogId && session.logId === options.excludeLogId) return false;
            if (options?.beforeDateKey && session.dateKey > options.beforeDateKey) return false;
            return true;
        })
        .sort((a, b) => (a.dateKey === b.dateKey ? 0 : a.dateKey < b.dateKey ? 1 : -1));

    for (const session of candidates) {
        const matching = session.sets.filter(
            (set) => exerciseIdentityKey(set.exerciseName) === key && isWorkingSet(set)
        );
        if (matching.length === 0) continue;

        const sets = matching
            .slice()
            .sort((a, b) => a.setNumber - b.setNumber)
            .map((set) => ({
                setNumber: set.setNumber,
                weightKg: set.weightKg ?? null,
                reps: set.reps ?? null,
                rpe: set.rpe ?? null,
            }));

        return {
            dateKey: session.dateKey,
            logId: session.logId,
            workoutName: session.workoutName,
            sets,
        };
    }

    return null;
}

/** Aggregates all-time records for one movement from its full history. */
export function buildExerciseRecords(
    sessions: HistoricalSessionInput[],
    exerciseName: string,
    options?: { excludeLogId?: string }
): ExerciseRecords {
    const key = exerciseIdentityKey(exerciseName);
    if (!key) return { ...EMPTY_EXERCISE_RECORDS, bestRepsByWeight: {} };

    const records: ExerciseRecords = {
        bestWeightKg: null,
        bestWeightReps: null,
        bestRepsByWeight: {},
        bestOneRm: null,
    };

    for (const session of sessions) {
        if (options?.excludeLogId && session.logId === options.excludeLogId) continue;
        for (const set of session.sets) {
            if (exerciseIdentityKey(set.exerciseName) !== key) continue;
            if (!isWorkingSet(set)) continue;

            const weight = set.weightKg as number;
            const reps = set.reps as number;

            if (records.bestWeightKg === null || weight > records.bestWeightKg) {
                records.bestWeightKg = weight;
                records.bestWeightReps = reps;
            } else if (weight === records.bestWeightKg && reps > (records.bestWeightReps ?? 0)) {
                records.bestWeightReps = reps;
            }

            const wKey = weightKey(weight);
            if (reps > (records.bestRepsByWeight[wKey] ?? 0)) {
                records.bestRepsByWeight[wKey] = reps;
            }

            const oneRm = calculateOneRM(weight, reps);
            if (oneRm > (records.bestOneRm ?? 0)) records.bestOneRm = oneRm;
        }
    }

    return records;
}

/** Records for every movement in a history, keyed by exercise identity. */
export function buildRecordsByExercise(
    sessions: HistoricalSessionInput[],
    options?: { excludeLogId?: string }
): Record<string, ExerciseRecords> {
    const names = new Map<string, string>();
    for (const session of sessions) {
        for (const set of session.sets) {
            const key = exerciseIdentityKey(set.exerciseName);
            if (key && !names.has(key)) names.set(key, set.exerciseName ?? "");
        }
    }

    const result: Record<string, ExerciseRecords> = {};
    for (const [key, name] of names) {
        result[key] = buildExerciseRecords(sessions, name, options);
    }
    return result;
}

export type PrKind = "weight" | "reps" | "oneRm";

export interface SetPrResult {
    isPr: boolean;
    /** Strongest achievement for this set — one badge only, never a stack. */
    kind: PrKind | null;
    label: string | null;
}

const NO_PR: SetPrResult = { isPr: false, kind: null, label: null };

/**
 * Judges one performed set against all-time records.
 *
 * `records` must exclude the session being judged, otherwise a set would compare
 * against itself and the badge would flicker off as soon as it is saved.
 */
export function evaluateSetPr(
    set: { weightKg?: number | null; reps?: number | null; isWarmup?: boolean | null; isCompleted?: boolean | null },
    records: ExerciseRecords | undefined
): SetPrResult {
    if (!records) return NO_PR;
    if (set.isWarmup) return NO_PR;
    if (set.isCompleted === false) return NO_PR;

    const weight = set.weightKg ?? 0;
    const reps = set.reps ?? 0;
    if (weight <= 0 || reps <= 0) return NO_PR;

    if (records.bestWeightKg === null) {
        return { isPr: true, kind: "weight", label: "New Best" };
    }

    if (weight > records.bestWeightKg) {
        return { isPr: true, kind: "weight", label: "Weight PR" };
    }

    const bestRepsAtWeight = records.bestRepsByWeight[weightKey(weight)] ?? 0;
    if (reps > bestRepsAtWeight) {
        return { isPr: true, kind: "reps", label: "Rep PR" };
    }

    const oneRm = calculateOneRM(weight, reps);
    if (records.bestOneRm !== null && oneRm > records.bestOneRm) {
        return { isPr: true, kind: "oneRm", label: "Est. 1RM PR" };
    }

    return NO_PR;
}

/**
 * Flags PRs across a whole session.
 *
 * Records advance set by set so two identical sets in one session cannot both claim
 * the same record — the first earns it, the second does not.
 */
export function evaluateSessionPrs<
    T extends {
        exerciseName: string | null | undefined;
        weightKg?: number | null;
        reps?: number | null;
        isWarmup?: boolean | null;
        isCompleted?: boolean | null;
    },
>(
    sets: T[],
    recordsByExercise: Record<string, ExerciseRecords>
): Array<{ set: T; pr: SetPrResult }> {
    const working: Record<string, ExerciseRecords> = {};
    for (const [key, records] of Object.entries(recordsByExercise)) {
        working[key] = {
            bestWeightKg: records.bestWeightKg,
            bestWeightReps: records.bestWeightReps,
            bestRepsByWeight: { ...records.bestRepsByWeight },
            bestOneRm: records.bestOneRm,
        };
    }

    return sets.map((set) => {
        const key = exerciseIdentityKey(set.exerciseName);
        if (!key) return { set, pr: NO_PR };

        const records = working[key] ?? {
            bestWeightKg: null,
            bestWeightReps: null,
            bestRepsByWeight: {},
            bestOneRm: null,
        };
        working[key] = records;

        const pr = evaluateSetPr(set, records);

        const weight = set.weightKg ?? 0;
        const reps = set.reps ?? 0;
        if (!set.isWarmup && set.isCompleted !== false && weight > 0 && reps > 0) {
            if (records.bestWeightKg === null || weight > records.bestWeightKg) {
                records.bestWeightKg = weight;
                records.bestWeightReps = reps;
            } else if (weight === records.bestWeightKg && reps > (records.bestWeightReps ?? 0)) {
                records.bestWeightReps = reps;
            }
            const wKey = weightKey(weight);
            if (reps > (records.bestRepsByWeight[wKey] ?? 0)) records.bestRepsByWeight[wKey] = reps;
            const oneRm = calculateOneRM(weight, reps);
            if (oneRm > (records.bestOneRm ?? 0)) records.bestOneRm = oneRm;
        }

        return { set, pr };
    });
}

/** Compact "100kg × 8" summary line for a previous session. */
export function formatPreviousSetLine(set: PreviousSet): string {
    const weight = set.weightKg != null && set.weightKg > 0 ? `${trimNumber(set.weightKg)}kg` : "BW";
    const reps = set.reps != null && set.reps > 0 ? ` × ${set.reps}` : "";
    return `${weight}${reps}`;
}

function trimNumber(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}
