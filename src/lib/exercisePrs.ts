/**
 * Shared personal-record and previous-session logic.
 *
 * ============================================================================
 * STRENGTH PR DEFINITIONS (canonical — use everywhere)
 * ============================================================================
 *
 * NEW BEST
 *   Highest estimated 1RM (canonical calculateOneRM) ever for the exercise.
 *   Strict: currentE1RM > previousBestE1RM. Equal does NOT count.
 *
 * WEIGHT PR
 *   Heaviest absolute weight successfully completed, regardless of reps.
 *   Strict: currentWeight > highestWeightBeforeThisSet. Equal does NOT count.
 *
 * REP PR (X REP PR)
 *   Heaviest weight ever completed for that EXACT rep count.
 *   Example: 105×8 beats prior 100×8 → 8 REP PR.
 *   First-ever performance at a rep count is NOT a Rep PR (no prior to beat).
 *   Strict: currentWeight > highestWeightForExactRepCount. Equal does NOT count.
 *
 * Display priority (one main badge): NEW BEST > WEIGHT PR > REP PR
 * Internally all applicable kinds are recorded on `kinds`.
 *
 * Matching a record shows nothing. Warm-ups / invalid sets never count.
 * Earlier sets in the current session advance the board immediately.
 * First-ever performance at a metric (weight / e1RM / exact rep count) establishes
 * the board but is not itself a PR — only beating an established record counts.
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
    durationSec?: number | null;
    distanceMeters?: number | null;
    heightCm?: number | null;
    resistance?: number | null;
    inclinePct?: number | null;
    calories?: number | null;
    heartRate?: number | null;
    speedKph?: number | null;
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
    durationSec?: number | null;
    distanceMeters?: number | null;
    heightCm?: number | null;
    resistance?: number | null;
    inclinePct?: number | null;
    calories?: number | null;
    heartRate?: number | null;
    speedKph?: number | null;
}

export interface PreviousSessionPerformance {
    dateKey: string;
    logId?: string;
    workoutName?: string;
    sets: PreviousSet[];
}

/** Best-ever numbers for one movement, used to judge new records. */
export interface ExerciseRecords {
    /** Heaviest completed working weight ever logged. */
    bestWeightKg: number | null;
    /** Reps achieved at `bestWeightKg` (informational). */
    bestWeightReps: number | null;
    /**
     * Heaviest weight completed for each exact rep count (`"8"` → 105).
     * First-time rep counts have no entry → cannot earn Rep PR until established.
     */
    bestWeightByReps: Record<string, number>;
    /**
     * @deprecated Kept for older payloads; prefer bestWeightByReps.
     * Not used by evaluateSetPr.
     */
    bestRepsByWeight?: Record<string, number>;
    /** Best estimated one-rep max. */
    bestOneRm: number | null;
}

export const EMPTY_EXERCISE_RECORDS: ExerciseRecords = {
    bestWeightKg: null,
    bestWeightReps: null,
    bestWeightByReps: {},
    bestOneRm: null,
};

/** Weight keys are strings so the record survives JSON transport intact. */
export function weightKey(weightKg: number): string {
    return String(Math.round(weightKg * 100) / 100);
}

export function repsKey(reps: number): string {
    return String(Math.round(reps));
}

export function isWorkingSet(set: {
    weightKg?: number | null;
    reps?: number | null;
    durationSec?: number | null;
    distanceMeters?: number | null;
    heightCm?: number | null;
    speedKph?: number | null;
    calories?: number | null;
    resistance?: number | null;
    isWarmup?: boolean | null;
    isCompleted?: boolean | null;
}): boolean {
    if (set.isWarmup) return false;
    if (set.isCompleted === false) return false;
    if (set.isCompleted !== true && set.isCompleted !== undefined && set.isCompleted !== null) {
        return false;
    }
    if ((set.weightKg ?? 0) > 0 && (set.reps ?? 0) > 0) return true;
    if ((set.durationSec ?? 0) > 0) return true;
    if ((set.distanceMeters ?? 0) > 0) return true;
    if ((set.heightCm ?? 0) > 0) return true;
    if ((set.reps ?? 0) > 0) return true;
    if ((set.speedKph ?? 0) > 0) return true;
    if ((set.calories ?? 0) > 0) return true;
    if ((set.resistance ?? 0) > 0) return true;
    return false;
}

/** Strict completed working set — used for live PR advancement. */
export function isCompletedWorkingSet(set: {
    weightKg?: number | null;
    reps?: number | null;
    durationSec?: number | null;
    distanceMeters?: number | null;
    heightCm?: number | null;
    isWarmup?: boolean | null;
    isCompleted?: boolean | null;
}): boolean {
    if (set.isWarmup) return false;
    if (set.isCompleted !== true) return false;
    if ((set.weightKg ?? 0) > 0 && (set.reps ?? 0) > 0) return true;
    if ((set.durationSec ?? 0) > 0) return true;
    if ((set.distanceMeters ?? 0) > 0) return true;
    if ((set.heightCm ?? 0) > 0) return true;
    if ((set.reps ?? 0) > 0) return true;
    return false;
}

export function cloneExerciseRecords(records: ExerciseRecords): ExerciseRecords {
    return {
        bestWeightKg: records.bestWeightKg,
        bestWeightReps: records.bestWeightReps,
        bestWeightByReps: { ...(records.bestWeightByReps ?? {}) },
        bestRepsByWeight: records.bestRepsByWeight
            ? { ...records.bestRepsByWeight }
            : undefined,
        bestOneRm: records.bestOneRm,
    };
}

/** Fold one completed working set into the running record board. */
export function applySetToRecords(
    records: ExerciseRecords,
    set: { weightKg?: number | null; reps?: number | null }
): void {
    const weight = set.weightKg ?? 0;
    const reps = set.reps ?? 0;
    if (weight <= 0 || reps <= 0) return;

    if (records.bestWeightKg === null || weight > records.bestWeightKg) {
        records.bestWeightKg = weight;
        records.bestWeightReps = reps;
    } else if (weight === records.bestWeightKg && reps > (records.bestWeightReps ?? 0)) {
        records.bestWeightReps = reps;
    }

    if (!records.bestWeightByReps) records.bestWeightByReps = {};
    const rKey = repsKey(reps);
    const priorAtReps = records.bestWeightByReps[rKey];
    if (priorAtReps == null || weight > priorAtReps) {
        records.bestWeightByReps[rKey] = weight;
    }

    const oneRm = calculateOneRM(weight, reps);
    if (records.bestOneRm === null || oneRm > records.bestOneRm) {
        records.bestOneRm = oneRm;
    }
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
                durationSec: set.durationSec ?? null,
                distanceMeters: set.distanceMeters ?? null,
                heightCm: set.heightCm ?? null,
                resistance: set.resistance ?? null,
                inclinePct: set.inclinePct ?? null,
                calories: set.calories ?? null,
                heartRate: set.heartRate ?? null,
                speedKph: set.speedKph ?? null,
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
    if (!key) return { ...EMPTY_EXERCISE_RECORDS, bestWeightByReps: {} };

    const records: ExerciseRecords = {
        bestWeightKg: null,
        bestWeightReps: null,
        bestWeightByReps: {},
        bestOneRm: null,
    };

    for (const session of sessions) {
        if (options?.excludeLogId && session.logId === options.excludeLogId) continue;
        for (const set of session.sets) {
            if (exerciseIdentityKey(set.exerciseName) !== key) continue;
            if (!isWorkingSet(set)) continue;
            applySetToRecords(records, set);
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
    /** Highest-priority badge to show (New Best > Weight PR > Rep PR). */
    kind: PrKind | null;
    label: string | null;
    /** Every PR kind this set earned (for persistence / analytics). */
    kinds: PrKind[];
    /** Exact rep count when a Rep PR was earned (for "8 REP PR"). */
    repCount?: number | null;
    /** Extra kinds beyond the main badge (for expandable details). */
    alsoKinds?: PrKind[];
}

const NO_PR: SetPrResult = {
    isPr: false,
    kind: null,
    label: null,
    kinds: [],
    repCount: null,
    alsoKinds: [],
};

/** UI shows one badge; this order is the display priority. */
export const PR_DISPLAY_PRIORITY: PrKind[] = ["oneRm", "weight", "reps"];

export function formatStrengthPrLabel(kind: PrKind, reps?: number | null): string {
    if (kind === "oneRm") return "NEW BEST";
    if (kind === "weight") return "WEIGHT PR";
    if (kind === "reps") {
        const n = reps != null && reps > 0 ? Math.round(reps) : null;
        return n != null ? `${n} REP PR` : "REP PR";
    }
    return "PR";
}

/** Secondary labels for expandable "Also achieved" details. */
export function formatAlsoStrengthPrLabels(
    alsoKinds: PrKind[] | undefined,
    reps?: number | null
): string[] {
    if (!alsoKinds?.length) return [];
    return alsoKinds.map((k) => formatStrengthPrLabel(k, k === "reps" ? reps : null));
}

function pickDisplayKind(kinds: PrKind[]): PrKind | null {
    for (const kind of PR_DISPLAY_PRIORITY) {
        if (kinds.includes(kind)) return kind;
    }
    return null;
}

/**
 * Judges one performed set against a record board.
 *
 * `records` must already exclude later sets in the same session (and the session
 * being saved when judging on complete) — otherwise a set competes with itself.
 */
export function evaluateSetPr(
    set: {
        weightKg?: number | null;
        reps?: number | null;
        isWarmup?: boolean | null;
        isCompleted?: boolean | null;
    },
    records: ExerciseRecords | undefined
): SetPrResult {
    if (!records) return NO_PR;
    if (set.isWarmup) return NO_PR;
    // Live workout: only completed sets earn badges. Save path marks completed sets true.
    if (set.isCompleted === false) return NO_PR;

    const weight = set.weightKg ?? 0;
    const reps = set.reps ?? 0;
    if (weight <= 0 || reps <= 0) return NO_PR;

    const kinds: PrKind[] = [];

    // Weight PR — must beat an established absolute-weight record (strict >).
    // First-ever weight on an exercise establishes the board but is not a PR.
    if (records.bestWeightKg != null && weight > records.bestWeightKg) {
        kinds.push("weight");
    }

    // Rep PR — heaviest weight for this exact rep count, only if that rep count
    // already has an established record (first-time rep count is NOT a Rep PR).
    const rKey = repsKey(reps);
    const priorBestWeightAtReps = records.bestWeightByReps?.[rKey];
    if (priorBestWeightAtReps != null && weight > priorBestWeightAtReps) {
        kinds.push("reps");
    }

    // New Best — must beat an established best e1RM (strict >). First e1RM
    // establishes the board but is not a New Best by itself.
    const oneRm = calculateOneRM(weight, reps);
    if (records.bestOneRm != null && oneRm > records.bestOneRm) {
        kinds.push("oneRm");
    }

    if (kinds.length === 0) return NO_PR;

    const kind = pickDisplayKind(kinds);
    const alsoKinds = kinds.filter((k) => k !== kind);
    return {
        isPr: true,
        kind,
        label: kind ? formatStrengthPrLabel(kind, kind === "reps" ? reps : null) : null,
        kinds,
        repCount: kinds.includes("reps") ? Math.round(reps) : null,
        alsoKinds,
    };
}

/**
 * Flags PRs across a whole session in order.
 *
 * Records advance after each completed working set so two identical PRs in one
 * session cannot both claim the badge — the first earns it, the second does not.
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
        working[key] = cloneExerciseRecords(records);
    }

    return sets.map((set) => {
        const key = exerciseIdentityKey(set.exerciseName);
        if (!key) return { set, pr: NO_PR };

        const records = working[key] ?? cloneExerciseRecords(EMPTY_EXERCISE_RECORDS);
        working[key] = records;

        const pr = evaluateSetPr(set, records);

        if (!set.isWarmup && set.isCompleted !== false) {
            const weight = set.weightKg ?? 0;
            const reps = set.reps ?? 0;
            if (weight > 0 && reps > 0) applySetToRecords(records, set);
        }

        return { set, pr };
    });
}

/**
 * Live workout helper: evaluate every set of one exercise against history +
 * earlier completed sets in this session. Re-run after edits/deletes.
 *
 * Only `isCompleted === true` sets earn badges and advance the board.
 */
export function evaluateLiveExercisePrs<
    T extends {
        weightKg?: number | null;
        reps?: number | null;
        isWarmup?: boolean | null;
        isCompleted?: boolean | null;
    },
>(sets: T[], baselineRecords: ExerciseRecords | undefined): SetPrResult[] {
    const records = cloneExerciseRecords(baselineRecords ?? EMPTY_EXERCISE_RECORDS);

    return sets.map((set) => {
        const normalized = {
            weightKg: set.weightKg,
            reps: set.reps,
            isWarmup: set.isWarmup,
            isCompleted: set.isCompleted === true,
        };
        const pr = evaluateSetPr(normalized, records);
        if (isCompletedWorkingSet(normalized)) {
            applySetToRecords(records, normalized);
        }
        return pr;
    });
}

/** Meaningful rep-record rows for history UI (prefer common ranges + user's history). */
export function meaningfulRepRecords(
    records: ExerciseRecords,
    options?: { prefer?: number[]; limit?: number }
): Array<{ reps: number; weightKg: number }> {
    const prefer = options?.prefer ?? [1, 3, 5, 6, 8, 10, 12];
    const limit = options?.limit ?? 12;
    const entries = Object.entries(records.bestWeightByReps ?? {})
        .map(([k, weightKg]) => ({ reps: Number(k), weightKg }))
        .filter((e) => Number.isFinite(e.reps) && e.reps > 0 && e.weightKg > 0)
        .sort((a, b) => a.reps - b.reps);

    const preferred = prefer
        .map((r) => entries.find((e) => e.reps === r))
        .filter((e): e is { reps: number; weightKg: number } => Boolean(e));

    const extras = entries.filter((e) => !prefer.includes(e.reps));
    return [...preferred, ...extras].slice(0, limit);
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
