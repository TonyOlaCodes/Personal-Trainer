/**
 * Seed missing Biceps canonical exercises, then merge historical duplicates onto them.
 *
 * Preserves plan exercises, log sets, PR snapshots and analytics by remapping names
 * through `mergeExercisesIntoTarget` — never hard-deletes workout logs.
 *
 * Run:
 *   npx tsx scripts/migrate-biceps-catalog.ts --dry-run
 *   npx tsx scripts/migrate-biceps-catalog.ts
 */

import { PrismaClient } from "@prisma/client";
import { mergeExercisesIntoTarget } from "../src/lib/mergeExercises";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
    BICEPS_CATALOG,
    bicepsMergeTargets,
} = require("./catalog/biceps.js") as {
    BICEPS_CATALOG: Array<{
        name: string;
        muscleGroup: string;
        instructions?: string;
        aliases?: string[];
    }>;
    bicepsMergeTargets: () => Array<{
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

    for (const entry of BICEPS_CATALOG) {
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
                        ...(entry.instructions
                            ? {
                                instructions: entry.instructions,
                                // Drop video when stored instructions look copied from incline curl / wrong lift
                                ...(existing.instructions
                                    && /incline bench|hanging back|lie chest/i.test(existing.instructions)
                                    && entry.name !== "Incline Dumbbell Curl"
                                    && !/spider|incline/i.test(entry.name)
                                    ? { videoUrl: null, thumbnailUrl: null }
                                    : {}),
                            }
                            : {}),
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
    const targets = bicepsMergeTargets();

    const extra: Array<{ targetName: string; sourceNames: string[]; targetMuscleGroup: string }> = [
        {
            targetName: "Barbell Curl",
            targetMuscleGroup: "Biceps",
            sourceNames: ["Barbell Bicep Curl", "BB Curl"],
        },
        {
            targetName: "Cable Curl",
            targetMuscleGroup: "Biceps",
            sourceNames: ["Cable Bicep Curl"],
        },
        {
            targetName: "EZ Bar Preacher Curl",
            targetMuscleGroup: "Biceps",
            sourceNames: ["Preacher Curl"],
        },
        {
            targetName: "EZ Bar Spider Curl",
            targetMuscleGroup: "Biceps",
            sourceNames: ["Spider Curl"],
        },
        {
            targetName: "Cross Body Hammer Curl",
            targetMuscleGroup: "Biceps",
            sourceNames: ["Cross-Body Hammer Curl", "Crossbody Hammer Curl"],
        },
        {
            targetName: "Dumbbell Curl",
            targetMuscleGroup: "Biceps",
            sourceNames: ["Standing Dumbbell Curl", "Bicep Curl", "Dumbbell Bicep Curl"],
        },
        {
            targetName: "Machine Bicep Curl",
            targetMuscleGroup: "Biceps",
            sourceNames: ["Machine Curl", "Bicep Curl Machine"],
        },
    ];

    const allTargets = [...targets];
    for (const row of extra) {
        const existing = allTargets.find((t) => t.targetName === row.targetName);
        if (existing) {
            existing.sourceNames = [...new Set([...existing.sourceNames, ...row.sourceNames])];
            existing.targetMuscleGroup = row.targetMuscleGroup;
        } else {
            allTargets.push(row);
        }
    }

    for (const target of allTargets) {
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

async function deactivateOrphanBicepsAliases() {
    const aliasNames = new Set<string>();
    for (const entry of BICEPS_CATALOG) {
        for (const alias of entry.aliases ?? []) {
            if (alias.toLowerCase() !== entry.name.toLowerCase()) {
                aliasNames.add(alias);
            }
        }
    }
    for (const extra of [
        "Barbell Bicep Curl",
        "Cable Bicep Curl",
        "Preacher Curl",
        "Spider Curl",
        "Cross-Body Hammer Curl",
        "Standing Dumbbell Curl",
        "Bicep Curl",
        "Machine Curl",
    ]) {
        aliasNames.add(extra);
    }

    let removed = 0;
    for (const alias of aliasNames) {
        const row = await prisma.globalExercise.findFirst({
            where: { name: { equals: alias, mode: "insensitive" } },
        });
        if (!row) continue;

        if (BICEPS_CATALOG.some((c) => c.name.toLowerCase() === row.name.toLowerCase())) {
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
    console.log(DRY_RUN ? "Biceps catalog migration (DRY RUN)" : "Biceps catalog migration");
    const seeded = await seedCanonical();
    const merges = await mergeAliases();
    const removed = await deactivateOrphanBicepsAliases();
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
