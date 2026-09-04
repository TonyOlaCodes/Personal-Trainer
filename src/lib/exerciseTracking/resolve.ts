import { prisma } from "@/lib/prisma";
import { exerciseIdentityKey } from "@/lib/exerciseIdentity";
import { ensureExerciseTrackingSchema } from "./ensure";
import { parseTrackingSchemaFromDb, normalizeTrackingSchema } from "./schema";
import { guessTrackingSchema } from "./guess";
import { DEFAULT_STRENGTH_SCHEMA } from "./presets";
import type { ExerciseTrackingSchema } from "./types";
import { serializeTrackingFields } from "./schema";

type TrackingRow = {
    name: string;
    muscleGroup: string | null;
    trackingPreset: string | null;
    trackingFields: string | null;
};

const cacheByIdentity = new Map<string, ExerciseTrackingSchema>();
let catalogLoadedAt = 0;
const CACHE_TTL_MS = 60_000;

async function loadCatalog(): Promise<void> {
    await ensureExerciseTrackingSchema();
    const now = Date.now();
    if (cacheByIdentity.size > 0 && now - catalogLoadedAt < CACHE_TTL_MS) return;

    const rows = await prisma.$queryRaw<TrackingRow[]>`
        SELECT "name", "muscleGroup", "trackingPreset", "trackingFields"
        FROM "global_exercises"
    `;

    cacheByIdentity.clear();
    for (const row of rows) {
        const key = exerciseIdentityKey(row.name);
        if (!key) continue;
        const hasConfig = Boolean(row.trackingPreset || row.trackingFields);
        const schema = hasConfig
            ? parseTrackingSchemaFromDb(row)
            : guessTrackingSchema(row.name, row.muscleGroup);
        cacheByIdentity.set(key, schema);
    }
    catalogLoadedAt = now;
}

export function invalidateTrackingSchemaCache() {
    cacheByIdentity.clear();
    catalogLoadedAt = 0;
}

/** Resolve tracking schema for an exercise name (dictionary → guess → strength). */
export async function resolveTrackingSchema(
    name: string,
    muscleGroup?: string | null
): Promise<ExerciseTrackingSchema> {
    await loadCatalog();
    const key = exerciseIdentityKey(name);
    if (key && cacheByIdentity.has(key)) {
        return cacheByIdentity.get(key)!;
    }
    return guessTrackingSchema(name, muscleGroup);
}

export async function resolveTrackingSchemasForNames(
    names: Array<{ name: string; muscleGroup?: string | null }>
): Promise<Record<string, ExerciseTrackingSchema>> {
    await loadCatalog();
    const out: Record<string, ExerciseTrackingSchema> = {};
    for (const item of names) {
        const key = exerciseIdentityKey(item.name) || item.name.toLowerCase();
        out[key] = await resolveTrackingSchema(item.name, item.muscleGroup);
    }
    return out;
}

export async function saveTrackingSchema(
    globalExerciseId: string,
    schema: ExerciseTrackingSchema
): Promise<void> {
    await ensureExerciseTrackingSchema();
    const normalized = normalizeTrackingSchema(schema);
    await prisma.$executeRaw`
        UPDATE "global_exercises"
        SET "trackingPreset" = ${normalized.preset},
            "trackingFields" = ${serializeTrackingFields(normalized)}
        WHERE "id" = ${globalExerciseId}
    `;
    invalidateTrackingSchemaCache();
}

/** One-shot: persist guessed presets for dictionary rows missing config (safe defaults). */
export async function backfillMissingTrackingConfigs(): Promise<number> {
    await ensureExerciseTrackingSchema();
    const rows = await prisma.$queryRaw<Array<{ id: string; name: string; muscleGroup: string | null }>>`
        SELECT "id", "name", "muscleGroup"
        FROM "global_exercises"
        WHERE "trackingPreset" IS NULL
    `;

    let updated = 0;
    for (const row of rows) {
        const schema = guessTrackingSchema(row.name, row.muscleGroup);
        // Only persist non-strength guesses OR strength explicitly so admin UI shows a preset.
        await prisma.$executeRaw`
            UPDATE "global_exercises"
            SET "trackingPreset" = ${schema.preset},
                "trackingFields" = ${serializeTrackingFields(schema)}
            WHERE "id" = ${row.id} AND "trackingPreset" IS NULL
        `;
        updated += 1;
    }
    invalidateTrackingSchemaCache();
    return updated;
}

export function strengthFallback(): ExerciseTrackingSchema {
    return {
        ...DEFAULT_STRENGTH_SCHEMA,
        fields: DEFAULT_STRENGTH_SCHEMA.fields.map((f) => ({ ...f })),
    };
}
