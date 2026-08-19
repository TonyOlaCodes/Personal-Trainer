/**
 * Seed missing Back canonical exercises, then merge historical duplicates onto them.
 *
 * Preserves plan exercises, log sets, PR snapshots and analytics by remapping names
 * through `mergeExercisesIntoTarget` — never hard-deletes workout logs.
 *
 * Run:
 *   npx tsx scripts/migrate-back-catalog.ts --dry-run
 *   npx tsx scripts/migrate-back-catalog.ts
 */

import { PrismaClient } from "@prisma/client";
import { mergeExercisesIntoTarget } from "../src/lib/mergeExercises";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
    BACK_CATALOG,
    backMergeTargets,
} = require("./catalog/back.js") as {
    BACK_CATALOG: Array<{
        name: string;
        muscleGroup: string;
        instructions?: string;
        aliases?: string[];
    }>;
    backMergeTargets: () => Array<{
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

    for (const entry of BACK_CATALOG) {
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
            || (entry.instructions && existing.instructions !== entry.instructions)
            // Clear clearly wrong copied media instructions when catalog has accurate copy
            || (entry.instructions
                && existing.instructions
                && existing.instructions.includes("chin")
                && entry.name !== "Chin-Up"
                && entry.name !== "Weighted Chin-Up"
                && entry.name !== "Assisted Chin-Up");

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
                                // Drop mismatched videos when rewriting known-bad instruction sets
                                ...(existing.instructions
                                    && /chin|pull your chin|supinated grip, grasp the pull/i.test(
                                        existing.instructions
                                    )
                                    && !/chin-up|chin up/i.test(entry.name)
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
    const targets = backMergeTargets();

    const extra: Array<{ targetName: string; sourceNames: string[]; targetMuscleGroup: string }> = [
        {
            targetName: "Conventional Deadlift",
            targetMuscleGroup: "Back",
            sourceNames: ["Deadlift", "Barbell Deadlift", "Conventional Barbell Deadlift"],
        },
        {
            targetName: "Single Arm Dumbbell Row",
            targetMuscleGroup: "Back",
            sourceNames: ["Single-Arm Dumbbell Row", "Dumbbell Row", "One Arm Dumbbell Row"],
        },
        {
            targetName: "Close Grip Seated Cable Row",
            targetMuscleGroup: "Back",
            sourceNames: ["Close-Grip Cable Row", "Close Grip Cable Row"],
        },
        {
            targetName: "Wide Grip Seated Cable Row",
            targetMuscleGroup: "Back",
            sourceNames: ["Wide-Grip Cable Row", "Wide Grip Cable Row"],
        },
        {
            targetName: "Wide Grip Lat Pulldown",
            targetMuscleGroup: "Back",
            sourceNames: ["Wide-Grip Lat Pulldown"],
        },
        {
            targetName: "Close Grip Lat Pulldown",
            targetMuscleGroup: "Back",
            sourceNames: ["Close-Grip Lat Pulldown"],
        },
        {
            targetName: "Neutral Grip Lat Pulldown",
            targetMuscleGroup: "Back",
            sourceNames: ["Neutral-Grip Lat Pulldown"],
        },
        {
            targetName: "Reverse Grip Lat Pulldown",
            targetMuscleGroup: "Back",
            sourceNames: ["Reverse-Grip Lat Pulldown"],
        },
        {
            targetName: "Straight Arm Cable Pulldown",
            targetMuscleGroup: "Back",
            sourceNames: ["Straight-Arm Pulldown", "Straight Arm Pulldown"],
        },
        {
            targetName: "Cable Lat Pullover",
            targetMuscleGroup: "Back",
            sourceNames: ["Lat Pullover"],
        },
        {
            targetName: "Back Extension",
            targetMuscleGroup: "Back",
            sourceNames: ["Hyperextension"],
        },
        {
            targetName: "45 Degree Back Extension",
            targetMuscleGroup: "Back",
            sourceNames: ["45-Degree Back Extension"],
        },
        {
            targetName: "Barbell Chest Supported Row",
            targetMuscleGroup: "Back",
            sourceNames: ["Chest-Supported Row", "Chest Supported Row"],
        },
        {
            targetName: "Wide Grip Pull-Up",
            targetMuscleGroup: "Back",
            sourceNames: ["Wide-Grip Pull-Up"],
        },
        {
            targetName: "Close Grip Pull-Up",
            targetMuscleGroup: "Back",
            sourceNames: ["Close-Grip Pull-Up"],
        },
        {
            targetName: "Neutral Grip Pull-Up",
            targetMuscleGroup: "Back",
            sourceNames: ["Neutral-Grip Pull-Up"],
        },
        {
            targetName: "Plate Loaded Row",
            targetMuscleGroup: "Back",
            sourceNames: ["Hammer Strength Row", "HS Row"],
        },
        {
            targetName: "Romanian Deadlift",
            targetMuscleGroup: "Hamstrings",
            sourceNames: ["Barbell Romanian Deadlift", "RDL", "Barbell RDL"],
        },
        {
            targetName: "90 Degree Back Extension",
            targetMuscleGroup: "Back",
            sourceNames: ["GHD Back Extension"],
        },
        {
            targetName: "Good Morning",
            targetMuscleGroup: "Back",
            sourceNames: ["Good Mornings"],
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

async function deactivateOrphanBackAliases() {
    const aliasNames = new Set<string>();
    for (const entry of BACK_CATALOG) {
        for (const alias of entry.aliases ?? []) {
            if (alias.toLowerCase() !== entry.name.toLowerCase()) {
                aliasNames.add(alias);
            }
        }
    }
    for (const extra of [
        "Deadlift",
        "Barbell Deadlift",
        "Single-Arm Dumbbell Row",
        "Dumbbell Row",
        "Close-Grip Cable Row",
        "Wide-Grip Cable Row",
        "Wide-Grip Lat Pulldown",
        "Close-Grip Lat Pulldown",
        "Neutral-Grip Lat Pulldown",
        "Reverse-Grip Lat Pulldown",
        "Straight-Arm Pulldown",
        "Lat Pullover",
        "Hyperextension",
        "45-Degree Back Extension",
        "Chest-Supported Row",
        "Wide-Grip Pull-Up",
        "Close-Grip Pull-Up",
        "Neutral-Grip Pull-Up",
        "Hammer Strength Row",
        "Barbell Romanian Deadlift",
        "GHD Back Extension",
        "Bent Over Row",
        "Australian Pull-Up",
    ]) {
        aliasNames.add(extra);
    }

    let removed = 0;
    for (const alias of aliasNames) {
        const row = await prisma.globalExercise.findFirst({
            where: { name: { equals: alias, mode: "insensitive" } },
        });
        if (!row) continue;

        if (BACK_CATALOG.some((c) => c.name.toLowerCase() === row.name.toLowerCase())) {
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
    console.log(DRY_RUN ? "Back catalog migration (DRY RUN)" : "Back catalog migration");
    const seeded = await seedCanonical();
    const merges = await mergeAliases();
    const removed = await deactivateOrphanBackAliases();
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
