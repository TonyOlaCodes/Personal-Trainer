/**
 * Athlete notes attached to one exercise within one logged session.
 *
 * Stored separately from `LogSet` on purpose: saving a workout replaces its set rows,
 * so a note living on a set would be destroyed on every autosave. These rows persist
 * across resumes and stay visible in session review and to the coach.
 */

import { prisma } from "@/lib/prisma";
import { canonicalExerciseName } from "@/lib/exerciseCanonical";
import { EXERCISE_NOTE_MAX_LENGTH } from "@/lib/logExerciseNotesShared";

export { EXERCISE_NOTE_MAX_LENGTH };

export interface LogExerciseNoteRecord {
    exerciseId: string;
    exerciseName: string;
    text: string;
}

let tableReady = false;

export async function ensureLogExerciseNotesTable(): Promise<void> {
    if (tableReady) return;

    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "log_exercise_notes" (
            "id" TEXT NOT NULL,
            "workoutLogId" TEXT NOT NULL,
            "exerciseId" TEXT NOT NULL,
            "exerciseName" TEXT NOT NULL,
            "text" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "log_exercise_notes_pkey" PRIMARY KEY ("id")
        )
    `);

    await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "log_exercise_notes_workoutLogId_exerciseId_key"
            ON "log_exercise_notes"("workoutLogId", "exerciseId")
    `);

    await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "log_exercise_notes_workoutLogId_idx"
            ON "log_exercise_notes"("workoutLogId")
    `);

    await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
            ALTER TABLE "log_exercise_notes"
                ADD CONSTRAINT "log_exercise_notes_workoutLogId_fkey"
                FOREIGN KEY ("workoutLogId") REFERENCES "workout_logs"("id")
                ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
    `);

    tableReady = true;
}

function normalizeNoteText(text: string | null | undefined): string {
    return (text ?? "").trim().slice(0, EXERCISE_NOTE_MAX_LENGTH);
}

/**
 * Replaces the note set for a session. Empty notes are removed rather than stored
 * blank, and notes for exercises no longer in the session are dropped.
 *
 * Never touches sets or the log itself, so a failed note save cannot lose training data.
 */
export async function saveLogExerciseNotes(
    workoutLogId: string,
    notes: Array<{ exerciseId: string; exerciseName?: string | null; text: string | null | undefined }>
): Promise<void> {
    await ensureLogExerciseNotesTable();

    const withText: Array<{ exerciseId: string; exerciseName: string; text: string }> = [];
    for (const note of notes) {
        const text = normalizeNoteText(note.text);
        if (!text) continue;
        withText.push({
            exerciseId: note.exerciseId,
            exerciseName: canonicalExerciseName(note.exerciseName) || "Exercise",
            text,
        });
    }

    const keepIds = withText.map((note) => note.exerciseId);

    if (keepIds.length === 0) {
        await prisma.$executeRaw`DELETE FROM "log_exercise_notes" WHERE "workoutLogId" = ${workoutLogId}`;
        return;
    }

    await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
            `DELETE FROM "log_exercise_notes"
             WHERE "workoutLogId" = $1
               AND "exerciseId" <> ALL($2::text[])`,
            workoutLogId,
            keepIds
        );

        for (const note of withText) {
            await tx.$executeRawUnsafe(
                `INSERT INTO "log_exercise_notes"
                    ("id", "workoutLogId", "exerciseId", "exerciseName", "text", "createdAt", "updatedAt")
                 VALUES (gen_random_uuid()::text, $1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 ON CONFLICT ("workoutLogId", "exerciseId")
                 DO UPDATE SET "text" = EXCLUDED."text",
                               "exerciseName" = EXCLUDED."exerciseName",
                               "updatedAt" = CURRENT_TIMESTAMP`,
                workoutLogId,
                note.exerciseId,
                note.exerciseName,
                note.text
            );
        }
    });
}

/** Notes for one session, keyed by exercise id. */
export async function getLogExerciseNotes(workoutLogId: string): Promise<Record<string, string>> {
    await ensureLogExerciseNotesTable();

    const rows = await prisma.$queryRaw<Array<{ exerciseId: string; text: string }>>`
        SELECT "exerciseId", "text"
        FROM "log_exercise_notes"
        WHERE "workoutLogId" = ${workoutLogId}
    `;

    return Object.fromEntries(rows.map((row) => [row.exerciseId, row.text]));
}

/** Notes for several sessions at once, keyed by log id then exercise id. */
export async function getLogExerciseNotesForLogs(
    workoutLogIds: string[]
): Promise<Record<string, Record<string, string>>> {
    if (workoutLogIds.length === 0) return {};
    await ensureLogExerciseNotesTable();

    const rows = await prisma.$queryRaw<
        Array<{ workoutLogId: string; exerciseId: string; exerciseName: string; text: string }>
    >`
        SELECT "workoutLogId", "exerciseId", "exerciseName", "text"
        FROM "log_exercise_notes"
        WHERE "workoutLogId" = ANY(${workoutLogIds}::text[])
    `;

    const grouped: Record<string, Record<string, string>> = {};
    for (const row of rows) {
        grouped[row.workoutLogId] ??= {};
        grouped[row.workoutLogId][row.exerciseId] = row.text;
    }
    return grouped;
}
