/**
 * Seed missing Shoulders canonical exercises, then merge historical duplicates onto them.
 *
 * Preserves plan exercises, log sets, PR snapshots and analytics by remapping names
 * through `mergeExercisesIntoTarget` — never hard-deletes workout logs.
 *
 * Run:
 *   npx tsx scripts/migrate-shoulders-catalog.ts --dry-run
 *   npx tsx scripts/migrate-shoulders-catalog.ts
 */

import { PrismaClient } from "@prisma/client";
import { mergeExercisesIntoTarget } from "../src/lib/mergeExercises";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
    SHOULDERS_CATALOG,
    shouldersMergeTargets,
} = require("./catalog/shoulders.js") as {
    SHOULDERS_CATALOG: Array<{
        name: string;
        muscleGroup: string;
        instructions?: string;
        aliases?: string[];
    }>;
    shouldersMergeTargets: () => Array<{
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

    for (const entry of SHOULDERS_CATALOG) {
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
                const clearBadVideo =
                    entry.instructions
                    && existing.instructions
                    && /bench|lie flat|dumbbell fly|chest|chin towards the bar/i.test(existing.instructions)
                    && !/overhead|shoulder|lateral|front raise|rear delt|face pull|upright|handstand|pike/i.test(
                        existing.instructions.slice(0, 80)
                    );

                await prisma.globalExercise.update({
                    where: { id: existing.id },
                    data: {
                        name: entry.name,
                        muscleGroup: entry.muscleGroup,
                        ...(entry.instructions
                            ? {
                                instructions: entry.instructions,
                                ...(clearBadVideo ? { videoUrl: null, thumbnailUrl: null } : {}),
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
    const targets = shouldersMergeTargets();

    const extra: Array<{ targetName: string; sourceNames: string[]; targetMuscleGroup: string }> = [
        {
            targetName: "Barbell Overhead Press",
            targetMuscleGroup: "Shoulders",
            sourceNames: ["Overhead Press", "Military Press", "OHP", "Barbell Shoulder Press"],
        },
        {
            targetName: "Seated Dumbbell Shoulder Press",
            targetMuscleGroup: "Shoulders",
            sourceNames: ["Dumbbell Shoulder Press", "Seated Dumbbell Press", "Dumbbell Press"],
        },
        {
            targetName: "Dumbbell Lateral Raise",
            targetMuscleGroup: "Shoulders",
            sourceNames: ["Lateral Raise", "Side Raise", "Side Lateral Raise"],
        },
        {
            targetName: "Dumbbell Front Raise",
            targetMuscleGroup: "Shoulders",
            sourceNames: ["Front Raise"],
        },
        {
            targetName: "Dumbbell Rear Delt Fly",
            targetMuscleGroup: "Shoulders",
            sourceNames: ["Rear Delt Fly"],
        },
        {
            targetName: "Cable Rear Delt Fly",
            targetMuscleGroup: "Shoulders",
            sourceNames: ["Rear Delt Cable Fly"],
        },
        {
            targetName: "Reverse Pec Deck",
            targetMuscleGroup: "Shoulders",
            sourceNames: ["Machine Rear Delt Fly", "Rear Delt Machine", "Rear Delt Machine Fly"],
        },
        {
            targetName: "Barbell Upright Row",
            targetMuscleGroup: "Shoulders",
            sourceNames: ["Upright Row"],
        },
        {
            targetName: "Face Pull",
            targetMuscleGroup: "Shoulders",
            sourceNames: ["Cable Face Pull"],
        },
        {
            targetName: "Dumbbell Y Raise",
            targetMuscleGroup: "Shoulders",
            sourceNames: ["Y Raise"],
        },
        {
            targetName: "Barbell Z Press",
            targetMuscleGroup: "Shoulders",
            sourceNames: ["Z Press"],
        },
        {
            targetName: "Plate Loaded Shoulder Press",
            targetMuscleGroup: "Shoulders",
            sourceNames: ["Hammer Strength Shoulder Press"],
        },
        {
            targetName: "Handstand Hold",
            targetMuscleGroup: "Shoulders",
            sourceNames: ["Wall Handstand Hold"],
        },
        {
            targetName: "Cuban Press",
            targetMuscleGroup: "Shoulders",
            sourceNames: ["Dumbbell Cuban Press"],
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

async function deactivateOrphanShoulderAliases() {
    const aliasNames = new Set<string>();
    for (const entry of SHOULDERS_CATALOG) {
        for (const alias of entry.aliases ?? []) {
            if (alias.toLowerCase() !== entry.name.toLowerCase()) {
                aliasNames.add(alias);
            }
        }
    }
    for (const extra of [
        "Overhead Press",
        "Military Press",
        "Dumbbell Shoulder Press",
        "Seated Dumbbell Press",
        "Lateral Raise",
        "Front Raise",
        "Rear Delt Fly",
        "Rear Delt Cable Fly",
        "Upright Row",
        "Y Raise",
        "Z Press",
        "Cable Face Pull",
        "Machine Rear Delt Fly",
        "Wall Handstand Hold",
        "Hammer Strength Shoulder Press",
    ]) {
        aliasNames.add(extra);
    }

    let removed = 0;
    for (const alias of aliasNames) {
        const row = await prisma.globalExercise.findFirst({
            where: { name: { equals: alias, mode: "insensitive" } },
        });
        if (!row) continue;

        if (SHOULDERS_CATALOG.some((c) => c.name.toLowerCase() === row.name.toLowerCase())) {
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
    console.log(DRY_RUN ? "Shoulders catalog migration (DRY RUN)" : "Shoulders catalog migration");
    const seeded = await seedCanonical();
    const merges = await mergeAliases();
    const removed = await deactivateOrphanShoulderAliases();
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
