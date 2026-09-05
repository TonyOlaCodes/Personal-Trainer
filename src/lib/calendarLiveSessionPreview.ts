/**
 * Coach/client calendar preview for an IN_PROGRESS workout.
 * Always derived from the persisted active log — never the live plan template.
 */

import { resolveLogSetExerciseName } from "@/lib/logSetExerciseName";
import { groupLogSetsByExercise } from "@/lib/logSetGrouping";
import { toDateKey } from "@/lib/utils";

export type LivePreviewSet = {
    exerciseId: string;
    exerciseName?: string | null;
    exerciseOrder?: number | null;
    setNumber: number;
    reps?: number | null;
    weightKg?: number | null;
    rpe?: number | null;
    isWarmup?: boolean | null;
    isCompleted?: boolean | null;
};

export type InProgressSessionPreview = {
    id: string;
    date: string;
    workoutId: string;
    workoutName: string;
    duration: number | null;
    updatedAt: string | null;
    sets: LivePreviewSet[];
};

export type PersistedLiveLog = {
    id: string;
    workoutId: string;
    loggedAt: string | Date;
    updatedAt?: string | Date | null;
    duration?: number | null;
    status?: string | null;
    workout?: { name?: string | null } | null;
    sets?: Array<{
        exerciseId: string;
        exerciseName?: string | null;
        exerciseOrder?: number | null;
        setNumber: number;
        reps?: number | null;
        weightKg?: number | null;
        rpe?: number | null;
        isWarmup?: boolean | null;
        isCompleted?: boolean | null;
        exercise?: { name?: string | null; order?: number | null } | null;
    }>;
};

/** Working sets the athlete has actually logged — not untouched placeholders. */
export function isLoggedWorkingSet(set: LivePreviewSet): boolean {
    if (set.isWarmup) return false;
    return set.isCompleted === true;
}

export function countLoggedWorkingSets(sets: LivePreviewSet[]): number {
    return sets.filter(isLoggedWorkingSet).length;
}

/** Elapsed minutes from last persisted duration + time since that save. */
export function liveElapsedMinutes(
    durationMinutes: number | null | undefined,
    updatedAt: string | Date | null | undefined,
    now: Date
): number | null {
    const persisted = typeof durationMinutes === "number" && Number.isFinite(durationMinutes)
        ? Math.max(0, durationMinutes)
        : null;
    const updatedMs = updatedAt ? new Date(updatedAt).getTime() : NaN;
    if (!Number.isFinite(updatedMs)) return persisted;

    const extra = Math.max(0, Math.floor((now.getTime() - updatedMs) / 60_000));
    const total = (persisted ?? 0) + extra;
    if (total <= 0 && persisted == null) return null;
    return Math.min(total, 12 * 60);
}

export function belongsToExpectedActiveSession(
    preview: Pick<InProgressSessionPreview, "workoutId" | "date">,
    expected: Pick<InProgressSessionPreview, "workoutId" | "date">
): boolean {
    return preview.workoutId === expected.workoutId && preview.date === expected.date;
}

export function pickFresherLivePreview(
    a: InProgressSessionPreview,
    b: InProgressSessionPreview
): InProgressSessionPreview {
    const aMs = a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const bMs = b.updatedAt ? Date.parse(b.updatedAt) : 0;
    return Number.isFinite(bMs) && bMs >= (Number.isFinite(aMs) ? aMs : 0) ? b : a;
}

export function mapPersistedLogToInProgressPreview(
    log: PersistedLiveLog | null | undefined
): InProgressSessionPreview | null {
    if (!log?.id || !log.workoutId) return null;
    if (log.status && log.status !== "IN_PROGRESS") return null;

    const loggedAt = log.loggedAt instanceof Date ? log.loggedAt : new Date(log.loggedAt);
    if (Number.isNaN(loggedAt.getTime())) return null;

    return {
        id: log.id,
        date: toDateKey(loggedAt),
        workoutId: log.workoutId,
        workoutName: log.workout?.name?.trim() || "",
        duration: typeof log.duration === "number" && Number.isFinite(log.duration)
            ? Math.max(0, log.duration)
            : null,
        updatedAt: (() => {
            if (!log.updatedAt) return null;
            const updated = new Date(log.updatedAt);
            return Number.isNaN(updated.getTime()) ? null : updated.toISOString();
        })(),
        sets: (log.sets ?? []).map((set) => ({
            exerciseId: set.exerciseId,
            exerciseName: resolveLogSetExerciseName(set),
            exerciseOrder: typeof set.exerciseOrder === "number" && set.exerciseOrder >= 0
                ? set.exerciseOrder
                : set.exercise?.order ?? null,
            setNumber: set.setNumber,
            reps: set.reps ?? null,
            weightKg: set.weightKg ?? null,
            rpe: set.rpe ?? null,
            isWarmup: set.isWarmup ?? false,
            isCompleted: set.isCompleted ?? false,
        })),
    };
}

export function buildLiveExercisePreview(sets: LivePreviewSet[], limit = 4) {
    const groups = groupLogSetsByExercise(sets);
    const rows = groups.map((group) => ({
        exerciseId: group.exerciseId,
        name: group.name,
        loggedSets: group.sets.filter(isLoggedWorkingSet).length,
    }));

    return {
        totalLoggedSets: countLoggedWorkingSets(sets),
        preview: rows.slice(0, limit),
        moreCount: Math.max(0, rows.length - limit),
    };
}
