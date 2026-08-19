/**
 * Seed missing Chest canonical exercises, then merge historical duplicates onto them.
 *
 * Preserves plan exercises, log sets, PR snapshots and analytics by remapping names
 * through `mergeExercisesIntoTarget` — never hard-deletes workout logs.
 *
 * Run:
 *   npx tsx scripts/migrate-chest-catalog.ts --dry-run
 *   npx tsx scripts/migrate-chest-catalog.ts
 */

import { PrismaClient } from "@prisma/client";
import { mergeExercisesIntoTarget } from "../src/lib/mergeExercises";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
    CHEST_CATALOG,
    chestMergeTargets,
} = require("./catalog/chest.js") as {
    CHEST_CATALOG: Array<{
        name: string;
        muscleGroup: string;
        instructions?: string;
        aliases?: string[];
    }>;
    chestMergeTargets: () => Array<{
        targetName: string;
        targetMuscleGroup: string;
        sourceNames: string[];
    }>;
};

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

async function seedCanonical() {
    let created = 0;
    let updated = 0;

    for (const entry of CHEST_CATALOG) {
        const existing = await prisma.globalExercise.findFirst({
            where: { name: { equals: entry.name, mode: "insensitive" } },
        });

        if (!existing) {
            if (!DRY_RUN) {
                await prisma.globalExercise.create({
                    data: {
                        name: entry.name,
                        muscleGroup: entry.muscleGroup,
                        instructions: entry.instructions ?? `Targets: ${entry.muscleGroup}`,
                    },
                });
            }
            created += 1;
            console.log(`[seed] create ${entry.name}`);
            continue;
        }

        const needsUpdate =
            existing.name !== entry.name
            || existing.muscleGroup !== entry.muscleGroup
            || (entry.instructions && existing.instructions !== entry.instructions);

        if (needsUpdate) {
            if (!DRY_RUN) {
                await prisma.globalExercise.update({
                    where: { id: existing.id },
                    data: {
                        name: entry.name,
                        muscleGroup: entry.muscleGroup,
                        ...(entry.instructions ? { instructions: entry.instructions } : {}),
                    },
                });
            }
            updated += 1;
            console.log(`[seed] update ${existing.name} → ${entry.name}`);
        }
    }

    return { created, updated };
}

async function mergeAliases() {
    let merges = 0;
    const targets = chestMergeTargets();

    // Extra historical duplicates that may exist in DB / plans but aren't listed as aliases.
    const extra: Array<{ targetName: string; sourceNames: string[]; targetMuscleGroup: string }> = [
        {
            targetName: "Close Grip Barbell Bench Press",
            targetMuscleGroup: "Chest",
            sourceNames: ["Close Grip Bench Press", "Close-Grip Bench Press"],
        },
        {
            targetName: "Barbell Floor Press",
            targetMuscleGroup: "Chest",
            sourceNames: ["Floor Press"],
        },
        {
            targetName: "Landmine Chest Press",
            targetMuscleGroup: "Chest",
            sourceNames: ["Landmine Press"],
        },
        {
            targetName: "Weighted Chest Dip",
            targetMuscleGroup: "Chest",
            sourceNames: ["Weighted Dip"],
        },
        {
            targetName: "Wide Grip Push-Up",
            targetMuscleGroup: "Chest",
            sourceNames: ["Wide Push-Up", "Wide Pushup"],
        },
    ];

    const allTargets = [...targets];
    for (const row of extra) {
        const existing = allTargets.find((t) => t.targetName === row.targetName);
        if (existing) {
            existing.sourceNames = [...new Set([...existing.sourceNames, ...row.sourceNames])];
        } else {
            allTargets.push(row);
        }
    }

    for (const target of allTargets) {
        // Only merge sources that actually exist as globals or plan/log names.
        const presentSources: string[] = [];
        for (const source of target.sourceNames) {
            if (source.toLowerCase() === target.targetName.toLowerCase()) continue;

            const [globalHit, planHit, logHit] = await Promise.all([
                prisma.globalExercise.findFirst({
                    where: { name: { equals: source, mode: "insensitive" } },
                    select: { id: true },
                }),
                prisma.exercise.findFirst({
                    where: { name: { equals: source, mode: "insensitive" } },
                    select: { id: true },
                }),
                prisma.logSet.findFirst({
                    where: { exerciseName: { equals: source, mode: "insensitive" } },
                    select: { id: true },
                }),
            ]);

            if (globalHit || planHit || logHit) presentSources.push(source);
        }

        if (presentSources.length === 0) continue;

        console.log(
            `[merge] ${presentSources.join(" + ")} → ${target.targetName}${DRY_RUN ? " (dry-run)" : ""}`
        );

        if (!DRY_RUN) {
            const result = await mergeExercisesIntoTarget({
                sourceNames: presentSources,
                targetName: target.targetName,
                targetMuscleGroup: target.targetMuscleGroup,
            });
            console.log(
                `        globals=${result.globalsMerged} plans=${result.planRenamed + result.planMerged} logs=${result.logSetsMoved + result.logNamesRewritten}`
            );
        }
        merges += 1;
    }

    return merges;
}

async function deactivateOrphanChestAliases() {
    /**
     * After merges, leftover GlobalExercise rows whose names are only aliases
     * (and no longer referenced) can be deleted safely. Plan/log remaps already ran.
     */
    const aliasNames = new Set<string>();
    for (const entry of CHEST_CATALOG) {
        for (const alias of entry.aliases ?? []) {
            if (alias.toLowerCase() !== entry.name.toLowerCase()) {
                aliasNames.add(alias);
            }
        }
    }
    // Common historical spellings
    for (const extra of [
        "Bench Press",
        "Incline Bench Press",
        "Decline Bench Press",
        "Close Grip Bench Press",
        "Close-Grip Bench Press",
        "Floor Press",
        "Landmine Press",
        "Weighted Dip",
        "Wide Push-Up",
        "Pushup",
        "Wall Pushup",
        "Pec Deck",
        "Cable Fly",
        "Low Cable Fly",
        "High Cable Fly",
        "Incline Dumbbell Press",
        "Incline Dumbbell Fly",
        "Flat Dumbbell Fly",
        "Chest Fly",
        "Incline Machine Press",
        "Smith Machine Incline Press",
    ]) {
        aliasNames.add(extra);
    }

    let removed = 0;
    for (const alias of aliasNames) {
        const row = await prisma.globalExercise.findFirst({
            where: { name: { equals: alias, mode: "insensitive" } },
        });
        if (!row) continue;

        // Never delete a row that is itself a canonical catalog name.
        if (CHEST_CATALOG.some((c) => c.name.toLowerCase() === row.name.toLowerCase())) {
            continue;
        }

        const [planRefs, logRefs] = await Promise.all([
            prisma.exercise.count({ where: { name: { equals: row.name, mode: "insensitive" } } }),
            prisma.logSet.count({ where: { exerciseName: { equals: row.name, mode: "insensitive" } } }),
        ]);

        if (planRefs > 0 || logRefs > 0) {
            console.log(`[cleanup] skip ${row.name} — still referenced (plans=${planRefs}, logs=${logRefs})`);
            continue;
        }

        if (!DRY_RUN) {
            await prisma.globalExercise.delete({ where: { id: row.id } });
        }
        removed += 1;
        console.log(`[cleanup] remove orphan global ${row.name}`);
    }

    return removed;
}

async function main() {
    console.log(DRY_RUN ? "Chest catalog migration (DRY RUN)" : "Chest catalog migration");
    const seeded = await seedCanonical();
    const merges = await mergeAliases();
    const removed = await deactivateOrphanChestAliases();
    console.log(
        `\nDone. seeded+updated=${seeded.created + seeded.updated} (created ${seeded.created}, updated ${seeded.updated}), merge groups=${merges}, orphans removed=${removed}`
    );
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
