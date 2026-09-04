/**
 * Assign dictionary tracking types to every GlobalExercise row.
 * Updates only trackingPreset + trackingFields. Does not touch names, muscles, or logs.
 *
 * Run:
 *   npx tsx scripts/migrate-exercise-tracking.ts --dry-run
 *   npx tsx scripts/migrate-exercise-tracking.ts
 */
import { PrismaClient } from "@prisma/client";
import { classifyDictionaryTrackingPreset } from "../src/lib/exerciseTracking/classify";
import { schemaFromPreset, serializeTrackingFields } from "../src/lib/exerciseTracking/schema";
import { PRESET_LABELS, type DictionaryTrackingPreset } from "../src/lib/exerciseTracking/types";
import { invalidateTrackingSchemaCache } from "../src/lib/exerciseTracking/resolve";
import { ensureExerciseTrackingSchema } from "../src/lib/exerciseTracking/ensure";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

const AMBIGUOUS_HINT =
    /\b(carry|sled|prowler|yoke|box jump|broad jump|depth jump|dead hang|climb|bike|treadmill|swim|crawl|erg)\b/i;

async function main() {
    await ensureExerciseTrackingSchema();
    const rows = await prisma.globalExercise.findMany({
        select: { id: true, name: true, muscleGroup: true, trackingPreset: true },
        orderBy: { name: "asc" },
    });

    const counts: Record<DictionaryTrackingPreset, number> = {
        strength: 0,
        timed: 0,
        distance_time: 0,
        weight_distance: 0,
        height_reps: 0,
    };
    const assigned: Array<{
        name: string;
        muscleGroup: string | null;
        preset: DictionaryTrackingPreset;
        previous: string | null;
        changed: boolean;
        ambiguous: boolean;
    }> = [];

    for (const row of rows) {
        const preset = classifyDictionaryTrackingPreset(row.name, row.muscleGroup);
        counts[preset] += 1;
        const changed = row.trackingPreset !== preset;
        const listed =
            preset !== "strength" ||
            /\b(burpee|box step|double under|jump rope|jumping jack|mountain climber|skipp)/i.test(row.name);
        const ambiguous = preset === "strength" && AMBIGUOUS_HINT.test(row.name) && !listed;
        assigned.push({
            name: row.name,
            muscleGroup: row.muscleGroup,
            preset,
            previous: row.trackingPreset,
            changed,
            ambiguous,
        });
    }

    if (!DRY_RUN) {
        for (const row of rows) {
            const preset = classifyDictionaryTrackingPreset(row.name, row.muscleGroup);
            const schema = schemaFromPreset(preset);
            await prisma.globalExercise.update({
                where: { id: row.id },
                data: {
                    trackingPreset: schema.preset,
                    trackingFields: serializeTrackingFields(schema),
                },
            });
        }
        invalidateTrackingSchemaCache();
    }

    console.log(`\nGlobalExercise tracking ${DRY_RUN ? "dry-run" : "update"} (${rows.length} rows)\n`);
    console.log(`  STRENGTH:       ${counts.strength}`);
    console.log(`  TIMED:          ${counts.timed}`);
    console.log(`  DISTANCE:       ${counts.distance_time}`);
    console.log(`  LOAD_DISTANCE:  ${counts.weight_distance}`);
    console.log(`  HEIGHT:         ${counts.height_reps}`);

    const nonStrength = assigned.filter((row) => row.preset !== "strength");
    console.log("\nNon-strength assignments:");
    for (const row of nonStrength) {
        console.log(`  ${PRESET_LABELS[row.preset].padEnd(16)} ${row.name}`);
    }

    const ambiguous = assigned.filter((row) => row.ambiguous);
    if (ambiguous.length) {
        console.log("\nPossibly ambiguous (left as Strength):");
        for (const row of ambiguous) {
            console.log(`  ${row.name}${row.muscleGroup ? ` [${row.muscleGroup}]` : ""}`);
        }
    }

    console.log(`\n${DRY_RUN ? "No rows written." : `Updated ${rows.length} dictionary rows.`}\n`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
