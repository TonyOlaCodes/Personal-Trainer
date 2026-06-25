import { calculateOneRM } from "./oneRepMax";

export type ExerciseSessionEntry = {
    sessionId: string;
    date: string;
    weight: number;
    reps: number;
    volume: number;
    oneRM: number;
};

export function coerceSetNumber(value: unknown): number {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n;
}

/** 1RM always matches the displayed best set (weight × reps). */
export function deriveOneRMFromBestSet(weight: number, reps: number): number {
    return calculateOneRM(coerceSetNumber(weight), Math.round(coerceSetNumber(reps)));
}

export function finalizeExerciseSessionEntry(session: ExerciseSessionEntry): ExerciseSessionEntry {
    const weight = coerceSetNumber(session.weight);
    const reps = Math.round(coerceSetNumber(session.reps));
    return {
        ...session,
        weight,
        reps,
        oneRM: deriveOneRMFromBestSet(weight, reps),
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

/** Best set = heaviest non-warmup weight in the workout; 1RM is always from that set. */
export function mergeSetIntoExerciseSession(
    session: ExerciseSessionEntry,
    sWeight: number,
    sReps: number,
    sVol: number
) {
    const weight = coerceSetNumber(sWeight);
    const reps = Math.round(coerceSetNumber(sReps));
    if (weight <= 0 || reps <= 0) {
        session.volume += sVol;
        return;
    }

    if (weight > session.weight) {
        session.weight = weight;
        session.reps = reps;
    } else if (weight === session.weight && reps < session.reps) {
        session.reps = reps;
    }

    session.oneRM = deriveOneRMFromBestSet(session.weight, session.reps);
    session.volume += sVol;
}

export function createExerciseSessionEntry(
    sessionId: string,
    date: string,
    sWeight: number,
    sReps: number,
    sVol: number
): ExerciseSessionEntry {
    const weight = coerceSetNumber(sWeight);
    const reps = Math.round(coerceSetNumber(sReps));
    return finalizeExerciseSessionEntry({
        sessionId,
        date,
        weight,
        reps,
        volume: sVol,
        oneRM: deriveOneRMFromBestSet(weight, reps),
    });
}
