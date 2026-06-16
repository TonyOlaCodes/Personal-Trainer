import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

export interface WorkoutNoteItem {
    id: string;
    workoutLogId: string;
    coachId: string;
    coachName: string | null;
    text: string;
    createdAt: Date;
}

let workoutNotesReady = false;

export async function ensureWorkoutNotesTable() {
    if (workoutNotesReady) return;

    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "workout_notes" (
            "id" TEXT PRIMARY KEY,
            "workoutLogId" TEXT NOT NULL REFERENCES "workout_logs"("id") ON DELETE CASCADE,
            "coachId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "text" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `;
    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "workout_notes_workoutLogId_idx"
        ON "workout_notes"("workoutLogId")
    `;
    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "workout_notes_coachId_idx"
        ON "workout_notes"("coachId")
    `;

    workoutNotesReady = true;
}

export async function createWorkoutNote(workoutLogId: string, coachId: string, text: string) {
    await ensureWorkoutNotesTable();

    await prisma.$executeRaw`
        INSERT INTO "workout_notes" ("id", "workoutLogId", "coachId", "text")
        VALUES (${randomUUID()}, ${workoutLogId}, ${coachId}, ${text})
    `;
}

export async function getWorkoutNotes(workoutLogId: string) {
    await ensureWorkoutNotesTable();

    return prisma.$queryRaw<WorkoutNoteItem[]>`
        SELECT
            wn."id",
            wn."workoutLogId",
            wn."coachId",
            u."name" AS "coachName",
            wn."text",
            wn."createdAt"
        FROM "workout_notes" wn
        JOIN "users" u ON u."id" = wn."coachId"
        WHERE wn."workoutLogId" = ${workoutLogId}
        ORDER BY wn."createdAt" ASC
    `;
}
