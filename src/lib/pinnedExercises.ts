import { prisma } from "@/lib/prisma";

export const MAX_PINNED_EXERCISES = 3;

let pinnedExercisesReady = false;

export async function ensurePinnedExercisesColumn() {
    if (pinnedExercisesReady) return;

    await prisma.$executeRaw`
        ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "pinnedExercises" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
    `;

    pinnedExercisesReady = true;
}

export function normalizePinnedExercises(
    pinned: string[] | null | undefined,
    validNames?: string[]
): string[] {
    const seen = new Set<string>();
    const list: string[] = [];

    for (const name of pinned ?? []) {
        if (typeof name !== "string") continue;
        const trimmed = name.trim();
        if (!trimmed || seen.has(trimmed)) continue;
        if (validNames && !validNames.includes(trimmed)) continue;
        seen.add(trimmed);
        list.push(trimmed);
        if (list.length >= MAX_PINNED_EXERCISES) break;
    }

    return list;
}

/** Pinned exercises first (in pin order), then the rest via optional secondary sort. */
export function orderExerciseNames(
    names: string[],
    pinned: string[],
    secondarySort?: (a: string, b: string) => number
): string[] {
    const pinnedOrdered = pinned.filter((name) => names.includes(name));
    const pinnedSet = new Set(pinnedOrdered);
    const rest = names.filter((name) => !pinnedSet.has(name));
    if (secondarySort) rest.sort(secondarySort);
    return [...pinnedOrdered, ...rest];
}

export async function getUserPinnedExercises(userId: string): Promise<string[]> {
    await ensurePinnedExercisesColumn();

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { pinnedExercises: true },
        });
        return normalizePinnedExercises(user?.pinnedExercises);
    } catch {
        await ensurePinnedExercisesColumn();
        const rows = await prisma.$queryRaw<Array<{ pinnedExercises: string[] | null }>>`
            SELECT "pinnedExercises" FROM "users" WHERE "id" = ${userId} LIMIT 1
        `;
        return normalizePinnedExercises(rows[0]?.pinnedExercises);
    }
}

export async function updateUserPinnedExercises(userId: string, pinnedExercises: string[]) {
    await ensurePinnedExercisesColumn();
    const normalized = normalizePinnedExercises(pinnedExercises);

    try {
        return await prisma.user.update({
            where: { id: userId },
            data: { pinnedExercises: normalized },
            select: { pinnedExercises: true },
        });
    } catch {
        await prisma.$executeRaw`
            UPDATE "users"
            SET "pinnedExercises" = ${normalized}::text[], "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${userId}
        `;
        return { pinnedExercises: normalized };
    }
}
