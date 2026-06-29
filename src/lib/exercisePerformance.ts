export interface PerformanceLogSet {
    exerciseId: string;
    exerciseName: string;
    setNumber: number;
    reps?: number | null;
    weightKg?: number | null;
}

export interface PerformanceLoggedSession {
    date: string;
    sets: PerformanceLogSet[];
}

export interface ExercisePerformanceSnapshot {
    weight: number;
    reps: number | null;
    date: string;
}

function pickBestWorkingSet(sets: PerformanceLogSet[]): ExercisePerformanceSnapshot | null {
    const working = sets.filter((s) => (s.weightKg ?? 0) > 0 && (s.reps ?? 0) > 0);
    if (working.length === 0) return null;

    const maxWeight = Math.max(...working.map((s) => s.weightKg ?? 0));
    const atMaxWeight = working.filter((s) => s.weightKg === maxWeight);
    const bestSet = atMaxWeight.reduce(
        (best, s) => ((s.reps ?? 0) > (best.reps ?? 0) ? s : best),
        atMaxWeight[0]
    );

    return {
        weight: maxWeight,
        reps: bestSet.reps ?? null,
        date: "",
    };
}

/** Most recent performance for an exercise before a date — matches by exerciseId first, then name. */
export function getPreviousExercisePerformance(
    sessions: PerformanceLoggedSession[],
    input: { exerciseId?: string; exerciseName: string; beforeDateKey: string }
): ExercisePerformanceSnapshot | null {
    const prevSessions = sessions
        .filter((session) => session.date < input.beforeDateKey)
        .sort((a, b) => b.date.localeCompare(a.date));

    const normalizedName = input.exerciseName.trim().toLowerCase();

    for (const session of prevSessions) {
        const matchingSets = session.sets.filter((set) => {
            if (input.exerciseId) return set.exerciseId === input.exerciseId;
            return set.exerciseName.trim().toLowerCase() === normalizedName;
        });

        const best = pickBestWorkingSet(matchingSets);
        if (best) {
            return { ...best, date: session.date };
        }
    }

    return null;
}
