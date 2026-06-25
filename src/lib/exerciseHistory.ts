import { calculateOneRM } from "./oneRepMax";

export type ExerciseSessionEntry = {
    date: string;
    weight: number;
    reps: number;
    volume: number;
    oneRM: number;
};

/** Best set = heaviest weight that day; 1RM always derived from that set only. */
export function mergeSetIntoExerciseSession(
    session: ExerciseSessionEntry,
    sWeight: number,
    sReps: number,
    sVol: number
) {
    if (sWeight > session.weight) {
        session.weight = sWeight;
        session.reps = sReps;
    }
    session.oneRM = calculateOneRM(session.weight, session.reps);
    session.volume += sVol;
}

export function createExerciseSessionEntry(
    date: string,
    sWeight: number,
    sReps: number,
    sVol: number
): ExerciseSessionEntry {
    return {
        date,
        weight: sWeight,
        reps: sReps,
        volume: sVol,
        oneRM: calculateOneRM(sWeight, sReps),
    };
}
