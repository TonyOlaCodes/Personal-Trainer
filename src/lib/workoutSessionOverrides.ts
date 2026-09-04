import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { PlannedWorkoutExercise, ResolvedPlannedWorkout } from "@/lib/plannedWorkoutResolve";

/** Per-set planned targets for a session override (one scheduled day). */
export type SessionSetTarget = {
    setNumber: number;
    weightKg?: number | null;
    reps?: number | null;
    durationSec?: number | null;
    distanceMeters?: number | null;
    heightCm?: number | null;
    rpe?: number | null;
    resistance?: number | null;
    inclinePct?: number | null;
};

export type SessionOverrideExercise = {
    id: string;
    name: string;
    sets: number;
    reps: string;
    order: number;
    weightTargetKg: number | null;
    notes?: string | null;
    /** When present, each set can have independent targets. */
    setTargets?: SessionSetTarget[];
};

export type WorkoutSessionOverride = {
    id: string;
    userId: string;
    dateKey: string;
    baseWorkoutId: string;
    workoutName: string | null;
    notes: string | null;
    exercises: SessionOverrideExercise[];
    updatedAt: Date;
};

let tableReady = false;

export async function ensureWorkoutSessionOverridesTable() {
    if (tableReady) return;

    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "workout_session_overrides" (
            "id" TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "dateKey" TEXT NOT NULL,
            "baseWorkoutId" TEXT NOT NULL,
            "workoutName" TEXT,
            "notes" TEXT,
            "exercises" JSONB NOT NULL,
            "createdById" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE ("userId", "dateKey", "baseWorkoutId")
        )
    `;
    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "workout_session_overrides_user_date_idx"
        ON "workout_session_overrides"("userId", "dateKey")
    `;

    tableReady = true;
}

function optionalFiniteNumber(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    return value;
}

function normalizeSetTargets(
    raw: unknown,
    setCount: number,
    fallback: { reps: string; weightTargetKg: number | null }
): SessionSetTarget[] {
    const byNumber = new Map<number, SessionSetTarget>();
    if (Array.isArray(raw)) {
        for (const item of raw) {
            if (!item || typeof item !== "object") continue;
            const row = item as Partial<SessionSetTarget>;
            const setNumber = Number(row.setNumber);
            if (!Number.isFinite(setNumber) || setNumber < 1) continue;
            byNumber.set(Math.round(setNumber), {
                setNumber: Math.round(setNumber),
                weightKg: optionalFiniteNumber(row.weightKg),
                reps: optionalFiniteNumber(row.reps),
                durationSec: optionalFiniteNumber(row.durationSec),
                distanceMeters: optionalFiniteNumber(row.distanceMeters),
                heightCm: optionalFiniteNumber(row.heightCm),
                rpe: optionalFiniteNumber(row.rpe),
                resistance: optionalFiniteNumber(row.resistance),
                inclinePct: optionalFiniteNumber(row.inclinePct),
            });
        }
    }

    const parsedReps = Number.parseInt(fallback.reps, 10);
    const defaultReps = Number.isFinite(parsedReps) && parsedReps > 0 ? parsedReps : null;

    const targets: SessionSetTarget[] = [];
    for (let i = 1; i <= setCount; i += 1) {
        const existing = byNumber.get(i);
        if (existing) {
            targets.push({ ...existing, setNumber: i });
        } else {
            targets.push({
                setNumber: i,
                weightKg: fallback.weightTargetKg,
                reps: defaultReps,
            });
        }
    }
    return targets;
}

function summarizeFromSetTargets(setTargets: SessionSetTarget[]): {
    sets: number;
    reps: string;
    weightTargetKg: number | null;
} {
    const sets = Math.max(1, setTargets.length);
    const first = setTargets[0];
    const allSameReps = setTargets.every((t) => t.reps === first?.reps);
    const allSameWeight = setTargets.every((t) => t.weightKg === first?.weightKg);
    const reps =
        allSameReps && first?.reps != null && first.reps > 0
            ? String(Math.round(first.reps))
            : setTargets
                  .map((t) => (t.reps != null && t.reps > 0 ? String(Math.round(t.reps)) : "—"))
                  .join("/");
    return {
        sets,
        reps: reps || "8-12",
        weightTargetKg: allSameWeight ? (first?.weightKg ?? null) : (first?.weightKg ?? null),
    };
}

function normalizeExercises(raw: unknown): SessionOverrideExercise[] {
    if (!Array.isArray(raw)) return [];
    const normalized: SessionOverrideExercise[] = [];
    for (let index = 0; index < raw.length; index += 1) {
        const item = raw[index] as Partial<SessionOverrideExercise> & { setTargets?: unknown };
        const name = typeof item.name === "string" ? item.name.trim() : "";
        if (!name) continue;
        const setsRaw = Number(item.sets);
        const setsHint = Number.isFinite(setsRaw) && setsRaw > 0 ? Math.round(setsRaw) : 3;
        const reps =
            typeof item.reps === "string" && item.reps.trim() ? item.reps.trim() : "8-12";
        const weightTargetKg =
            typeof item.weightTargetKg === "number" && Number.isFinite(item.weightTargetKg)
                ? item.weightTargetKg
                : null;
        const setTargets = normalizeSetTargets(item.setTargets, setsHint, {
            reps,
            weightTargetKg,
        });
        const summary = summarizeFromSetTargets(setTargets);
        normalized.push({
            id: typeof item.id === "string" && item.id ? item.id : `override-ex-${index}`,
            name,
            sets: summary.sets,
            reps: summary.reps,
            order: typeof item.order === "number" ? item.order : index,
            weightTargetKg: summary.weightTargetKg,
            notes: typeof item.notes === "string" ? item.notes : null,
            setTargets,
        });
    }
    return normalized
        .sort((a, b) => a.order - b.order)
        .map((row, index) => ({ ...row, order: index }));
}

function mapRow(row: {
    id: string;
    userId: string;
    dateKey: string;
    baseWorkoutId: string;
    workoutName: string | null;
    notes: string | null;
    exercises: unknown;
    updatedAt: Date;
}): WorkoutSessionOverride {
    return {
        id: row.id,
        userId: row.userId,
        dateKey: row.dateKey,
        baseWorkoutId: row.baseWorkoutId,
        workoutName: row.workoutName,
        notes: row.notes,
        exercises: normalizeExercises(row.exercises),
        updatedAt: row.updatedAt,
    };
}

export async function getSessionOverride(
    userId: string,
    dateKey: string,
    baseWorkoutId: string
): Promise<WorkoutSessionOverride | null> {
    await ensureWorkoutSessionOverridesTable();
    const rows = await prisma.$queryRaw<Array<{
        id: string;
        userId: string;
        dateKey: string;
        baseWorkoutId: string;
        workoutName: string | null;
        notes: string | null;
        exercises: unknown;
        updatedAt: Date;
    }>>`
        SELECT "id", "userId", "dateKey", "baseWorkoutId", "workoutName", "notes", "exercises", "updatedAt"
        FROM "workout_session_overrides"
        WHERE "userId" = ${userId}
          AND "dateKey" = ${dateKey}
          AND "baseWorkoutId" = ${baseWorkoutId}
        LIMIT 1
    `;
    return rows[0] ? mapRow(rows[0]) : null;
}

export async function listSessionOverridesForUser(
    userId: string,
    dateKeys?: string[]
): Promise<WorkoutSessionOverride[]> {
    await ensureWorkoutSessionOverridesTable();
    if (dateKeys && dateKeys.length === 0) return [];

    const rows = dateKeys
        ? await prisma.$queryRaw<Array<{
            id: string;
            userId: string;
            dateKey: string;
            baseWorkoutId: string;
            workoutName: string | null;
            notes: string | null;
            exercises: unknown;
            updatedAt: Date;
        }>>`
            SELECT "id", "userId", "dateKey", "baseWorkoutId", "workoutName", "notes", "exercises", "updatedAt"
            FROM "workout_session_overrides"
            WHERE "userId" = ${userId}
              AND "dateKey" IN (${Prisma.join(dateKeys)})
        `
        : await prisma.$queryRaw<Array<{
            id: string;
            userId: string;
            dateKey: string;
            baseWorkoutId: string;
            workoutName: string | null;
            notes: string | null;
            exercises: unknown;
            updatedAt: Date;
        }>>`
            SELECT "id", "userId", "dateKey", "baseWorkoutId", "workoutName", "notes", "exercises", "updatedAt"
            FROM "workout_session_overrides"
            WHERE "userId" = ${userId}
        `;

    return rows.map(mapRow);
}

export async function upsertSessionOverride(input: {
    userId: string;
    dateKey: string;
    baseWorkoutId: string;
    workoutName?: string | null;
    notes?: string | null;
    exercises: SessionOverrideExercise[];
    createdById: string;
}): Promise<WorkoutSessionOverride> {
    await ensureWorkoutSessionOverridesTable();
    const exercises = normalizeExercises(input.exercises);
    const id = randomUUID();
    const exercisesJson = JSON.stringify(exercises);

    await prisma.$executeRaw`
        INSERT INTO "workout_session_overrides"
            ("id", "userId", "dateKey", "baseWorkoutId", "workoutName", "notes", "exercises", "createdById", "createdAt", "updatedAt")
        VALUES
            (${id}, ${input.userId}, ${input.dateKey}, ${input.baseWorkoutId},
             ${input.workoutName ?? null}, ${input.notes ?? null},
             ${exercisesJson}::jsonb, ${input.createdById}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("userId", "dateKey", "baseWorkoutId") DO UPDATE SET
            "workoutName" = EXCLUDED."workoutName",
            "notes" = EXCLUDED."notes",
            "exercises" = EXCLUDED."exercises",
            "updatedAt" = CURRENT_TIMESTAMP
    `;

    const saved = await getSessionOverride(input.userId, input.dateKey, input.baseWorkoutId);
    if (!saved) throw new Error("Failed to save session override");
    return saved;
}

export async function deleteSessionOverride(
    userId: string,
    dateKey: string,
    baseWorkoutId: string
): Promise<void> {
    await ensureWorkoutSessionOverridesTable();
    await prisma.$executeRaw`
        DELETE FROM "workout_session_overrides"
        WHERE "userId" = ${userId}
          AND "dateKey" = ${dateKey}
          AND "baseWorkoutId" = ${baseWorkoutId}
    `;
}

/** Apply a session override onto a resolved planned workout (same workout id, swapped content). */
export function applySessionOverrideToPlanned(
    planned: ResolvedPlannedWorkout,
    override: WorkoutSessionOverride | null | undefined
): ResolvedPlannedWorkout {
    if (!override || override.baseWorkoutId !== planned.id) return planned;
    const exercises: PlannedWorkoutExercise[] = override.exercises.map((ex, index) => ({
        id: ex.id,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        order: index,
        weightTargetKg: ex.weightTargetKg,
        setTargets: ex.setTargets,
    }));
    return {
        ...planned,
        name: override.workoutName?.trim() || planned.name,
        exercises,
    };
}

export function sessionOverrideMapKey(dateKey: string, workoutId: string) {
    return `${dateKey}:${workoutId}`;
}

/** Build default setTargets from a compact exercise definition. */
export function buildDefaultSetTargets(input: {
    sets: number;
    reps: string;
    weightTargetKg?: number | null;
}): SessionSetTarget[] {
    return normalizeSetTargets(undefined, Math.max(1, input.sets), {
        reps: input.reps || "8-12",
        weightTargetKg: input.weightTargetKg ?? null,
    });
}
