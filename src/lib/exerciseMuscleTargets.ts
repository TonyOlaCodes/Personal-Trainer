import { prisma } from "@/lib/prisma";
import { exerciseIdentityKey } from "@/lib/exerciseIdentity";
import {
    hitToTargets,
    normalizeMuscleTargets,
    parseMuscleTargetsJson,
    serializeMuscleTargets,
    targetsToHit,
    type MuscleTargetEntry,
} from "@/lib/muscleTargetEntries";

export type { MuscleTargetEntry };
export {
    hitToTargets,
    normalizeMuscleTargets,
    parseMuscleTargetsJson,
    serializeMuscleTargets,
    targetsToHit,
};

let columnReady = false;
const cacheByIdentity = new Map<string, MuscleTargetEntry[]>();
let catalogLoadedAt = 0;
const CACHE_TTL_MS = 60_000;

export async function ensureMuscleTargetsColumn() {
    if (columnReady) return;
    await prisma.$executeRawUnsafe(
        `ALTER TABLE "global_exercises" ADD COLUMN IF NOT EXISTS "muscleTargets" TEXT`
    );
    columnReady = true;
}

export function invalidateMuscleTargetsCache() {
    cacheByIdentity.clear();
    catalogLoadedAt = 0;
}

async function loadCatalog() {
    await ensureMuscleTargetsColumn();
    const now = Date.now();
    if (cacheByIdentity.size > 0 && now - catalogLoadedAt < CACHE_TTL_MS) return;

    const rows = await prisma.$queryRaw<Array<{ name: string; muscleTargets: string | null }>>`
        SELECT "name", "muscleTargets" FROM "global_exercises"
        WHERE "muscleTargets" IS NOT NULL AND "muscleTargets" <> ''
    `;
    cacheByIdentity.clear();
    for (const row of rows) {
        const key = exerciseIdentityKey(row.name);
        if (!key) continue;
        const targets = parseMuscleTargetsJson(row.muscleTargets);
        if (targets.length > 0) cacheByIdentity.set(key, targets);
    }
    catalogLoadedAt = now;
}

export async function getDictionaryMuscleTargets(
    name: string
): Promise<MuscleTargetEntry[] | null> {
    await loadCatalog();
    const key = exerciseIdentityKey(name);
    if (!key) return null;
    return cacheByIdentity.get(key) ?? null;
}

export async function getDictionaryMuscleTargetsMap(
    names: string[]
): Promise<Record<string, MuscleTargetEntry[]>> {
    await loadCatalog();
    const out: Record<string, MuscleTargetEntry[]> = {};
    for (const name of names) {
        const key = exerciseIdentityKey(name);
        if (!key) continue;
        const targets = cacheByIdentity.get(key);
        if (targets?.length) out[key] = targets;
    }
    return out;
}

export async function saveMuscleTargets(
    globalExerciseId: string,
    targets: MuscleTargetEntry[]
): Promise<void> {
    await ensureMuscleTargetsColumn();
    const normalized = normalizeMuscleTargets(targets);
    const json = normalized.length > 0 ? serializeMuscleTargets(normalized) : null;
    await prisma.$executeRaw`
        UPDATE "global_exercises"
        SET "muscleTargets" = ${json}
        WHERE "id" = ${globalExerciseId}
    `;
    invalidateMuscleTargetsCache();
}
