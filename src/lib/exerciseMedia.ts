import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type ExerciseMediaDb = PrismaClient | Prisma.TransactionClient;

export type ExerciseMedia = {
    id: string;
    name: string;
    videoUrl: string | null;
    instructions: string | null;
    thumbnailUrl: string | null;
};

export async function ensureGlobalExerciseMediaColumns(db: ExerciseMediaDb = prisma) {
    await db.$executeRawUnsafe('ALTER TABLE "global_exercises" ADD COLUMN IF NOT EXISTS "instructions" TEXT');
    await db.$executeRawUnsafe('ALTER TABLE "global_exercises" ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT');
}

export async function updateGlobalExerciseMedia(
    exerciseId: string,
    media: { instructions?: string | null; thumbnailUrl?: string | null },
    db: ExerciseMediaDb = prisma
) {
    await ensureGlobalExerciseMediaColumns(db);
    await db.$executeRawUnsafe(
        'UPDATE "global_exercises" SET "instructions" = $1, "thumbnailUrl" = $2 WHERE "id" = $3',
        media.instructions ?? null,
        media.thumbnailUrl ?? null,
        exerciseId
    );
}

export async function getExerciseMediaByNames(names: string[], db: ExerciseMediaDb = prisma) {
    await ensureGlobalExerciseMediaColumns(db);
    const uniqueNames = Array.from(new Set(names.filter(Boolean)));
    if (uniqueNames.length === 0) return new Map<string, ExerciseMedia>();

    const rows = await db.$queryRaw<ExerciseMedia[]>`
        SELECT "id", "name", "videoUrl", "instructions", "thumbnailUrl"
        FROM "global_exercises"
        WHERE "name" IN (${Prisma.join(uniqueNames)})
    `;

    return new Map(rows.map((row) => [row.name, row]));
}

export async function getExerciseMediaByIds(ids: string[], db: ExerciseMediaDb = prisma) {
    await ensureGlobalExerciseMediaColumns(db);
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) return new Map<string, ExerciseMedia>();

    const rows = await db.$queryRaw<ExerciseMedia[]>`
        SELECT "id", "name", "videoUrl", "instructions", "thumbnailUrl"
        FROM "global_exercises"
        WHERE "id" IN (${Prisma.join(uniqueIds)})
    `;

    return new Map(rows.map((row) => [row.id, row]));
}
