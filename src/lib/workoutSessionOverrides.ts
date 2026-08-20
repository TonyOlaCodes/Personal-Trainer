import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { PlannedWorkoutExercise, ResolvedPlannedWorkout } from "@/lib/plannedWorkoutResolve";

export type SessionOverrideExercise = {
    id: string;
    name: string;
    sets: number;
    reps: string;
    order: number;
    weightTargetKg: number | null;
    notes?: string | null;
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

function normalizeExercises(raw: unknown): SessionOverrideExercise[] {
    if (!Array.isArray(raw)) return [];
    const normalized: SessionOverrideExercise[] = [];
    for (let index = 0; index < raw.length; index += 1) {
        const item = raw[index] as Partial<SessionOverrideExercise>;
        const name = typeof item.name === "string" ? item.name.trim() : "";
        if (!name) continue;
        const sets = Number(item.sets);
        normalized.push({
            id: typeof item.id === "string" && item.id ? item.id : `override-ex-${index}`,
            name,
            sets: Number.isFinite(sets) && sets > 0 ? Math.round(sets) : 3,
            reps: typeof item.reps === "string" && item.reps.trim() ? item.reps.trim() : "8-12",
            order: typeof item.order === "number" ? item.order : index,
            weightTargetKg:
                typeof item.weightTargetKg === "number" && Number.isFinite(item.weightTargetKg)
                    ? item.weightTargetKg
                    : null,
            notes: typeof item.notes === "string" ? item.notes : null,
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
