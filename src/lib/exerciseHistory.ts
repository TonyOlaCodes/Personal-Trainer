import { deriveOneRMFromBestSet, isBetterSet } from "./oneRepMax";

export type ExerciseSessionEntry = {
    sessionId: string;
    date: string;
    weight: number;
    reps: number;
    volume: number;
    oneRM: number;
    /** Extended metrics for non-strength tracking schemas */
    durationSec?: number;
    distanceMeters?: number;
    heightCm?: number;
    /** Which chart metric is primary for this exercise family */
    primaryMetric?: "weight" | "duration" | "distance" | "height" | "reps";
};

export function coerceSetNumber(value: unknown): number {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n;
}

export function finalizeExerciseSessionEntry(session: ExerciseSessionEntry): ExerciseSessionEntry {
    const weight = coerceSetNumber(session.weight);
    const reps = Math.round(coerceSetNumber(session.reps));
    const useOneRm = weight > 0 && reps > 0;
    return {
        ...session,
        weight,
        reps,
        oneRM: useOneRm ? deriveOneRMFromBestSet(weight, reps) : 0,
        durationSec: session.durationSec ? coerceSetNumber(session.durationSec) : undefined,
        distanceMeters: session.distanceMeters ? coerceSetNumber(session.distanceMeters) : undefined,
        heightCm: session.heightCm ? coerceSetNumber(session.heightCm) : undefined,
    };
}

export function normalizeExerciseHistory(
    history: Record<string, ExerciseSessionEntry[]>
): Record<string, ExerciseSessionEntry[]> {
    return Object.fromEntries(
        Object.entries(history).map(([name, sessions]) => [
            name,
            sessions.map((session) => finalizeExerciseSessionEntry(session)),
        ])
    );
}

/** Best set = heaviest non-warmup weight; at equal weight, highest reps. 1RM from that set. */
export function mergeSetIntoExerciseSession(
    session: ExerciseSessionEntry,
    sWeight: number,
    sReps: number,
    sVol: number,
    extras?: {
        durationSec?: number;
        distanceMeters?: number;
        heightCm?: number;
        primaryMetric?: ExerciseSessionEntry["primaryMetric"];
    }
) {
    const weight = coerceSetNumber(sWeight);
    const reps = Math.round(coerceSetNumber(sReps));
    if (weight > 0 && reps > 0) {
        if (isBetterSet(weight, reps, session.weight, session.reps)) {
            session.weight = weight;
            session.reps = reps;
        }
        session.oneRM = deriveOneRMFromBestSet(session.weight, session.reps);
    } else if (reps > 0 && weight <= 0 && reps > session.reps) {
        session.reps = reps;
    }

    if (extras?.durationSec && extras.durationSec > (session.durationSec ?? 0)) {
        session.durationSec = extras.durationSec;
    }
    if (extras?.distanceMeters && extras.distanceMeters > (session.distanceMeters ?? 0)) {
        session.distanceMeters = extras.distanceMeters;
    }
    if (extras?.heightCm && extras.heightCm > (session.heightCm ?? 0)) {
        session.heightCm = extras.heightCm;
    }
    if (extras?.primaryMetric) session.primaryMetric = extras.primaryMetric;

    session.volume += sVol;
}

export function createExerciseSessionEntry(
    sessionId: string,
    date: string,
    sWeight: number,
    sReps: number,
    sVol: number,
    extras?: {
        durationSec?: number;
        distanceMeters?: number;
        heightCm?: number;
        primaryMetric?: ExerciseSessionEntry["primaryMetric"];
    }
): ExerciseSessionEntry {
    const weight = coerceSetNumber(sWeight);
    const reps = Math.round(coerceSetNumber(sReps));
    return finalizeExerciseSessionEntry({
        sessionId,
        date,
        weight,
        reps,
        volume: sVol,
        oneRM: weight > 0 && reps > 0 ? deriveOneRMFromBestSet(weight, reps) : 0,
        durationSec: extras?.durationSec,
        distanceMeters: extras?.distanceMeters,
        heightCm: extras?.heightCm,
        primaryMetric: extras?.primaryMetric,
    });
}

export function inferPrimaryMetric(session: ExerciseSessionEntry): NonNullable<ExerciseSessionEntry["primaryMetric"]> {
    if (session.primaryMetric) return session.primaryMetric;
    if ((session.weight ?? 0) > 0) return "weight";
    if ((session.durationSec ?? 0) > 0) return "duration";
    if ((session.distanceMeters ?? 0) > 0) return "distance";
    if ((session.heightCm ?? 0) > 0) return "height";
    if ((session.reps ?? 0) > 0) return "reps";
    return "weight";
}
