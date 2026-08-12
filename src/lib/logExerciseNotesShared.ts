/**
 * Constants shared by the client note field and the server that stores it.
 *
 * Kept apart from `logExerciseNotes.ts` because that module imports Prisma; the workout
 * screen only needs the limit, not the database.
 */

export const EXERCISE_NOTE_MAX_LENGTH = 500;
