/**
 * Merge plural global exercises into singular canonical names.
 * - Copies media from plural → singular when singular has none
 * - Renames plan exercises (workout templates)
 * - Reassigns log sets when both plural and singular exist in same workout
 * - Deletes plural global_exercises rows
 *
 * Run: node scripts/merge-plural-exercises.js
 */
const { PrismaClient } = require("@prisma/client");
const { EXERCISE_PLURAL_MERGES } = require("./exercisePluralMerges");

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

async function mergeGlobalExercises() {
    let deleted = 0;
    let mediaCopied = 0;

    for (const [plural, singular] of EXERCISE_PLURAL_MERGES) {
        const [pluralRow, singularRow] = await Promise.all([
            prisma.globalExercise.findUnique({ where: { name: plural } }),
            prisma.globalExercise.findUnique({ where: { name: singular } }),
        ]);

        if (!pluralRow) continue;

        if (singularRow) {
            const needsMedia =
                (!singularRow.videoUrl && pluralRow.videoUrl)
                || (!singularRow.thumbnailUrl && pluralRow.thumbnailUrl)
                || (!singularRow.instructions && pluralRow.instructions);

            if (needsMedia && !DRY_RUN) {
                await prisma.globalExercise.update({
                    where: { id: singularRow.id },
                    data: {
                        videoUrl: singularRow.videoUrl ?? pluralRow.videoUrl,
                        thumbnailUrl: singularRow.thumbnailUrl ?? pluralRow.thumbnailUrl,
                        instructions: singularRow.instructions ?? pluralRow.instructions,
                        muscleGroup: singularRow.muscleGroup ?? pluralRow.muscleGroup,
                    },
                });
                mediaCopied++;
            }

            if (!DRY_RUN) {
                await prisma.globalExercise.delete({ where: { id: pluralRow.id } });
            }
            deleted++;
            console.log(`[global] ${plural} → ${singular} (deleted plural)`);
        } else if (!DRY_RUN) {
            await prisma.globalExercise.update({
                where: { id: pluralRow.id },
                data: { name: singular },
            });
            console.log(`[global] ${plural} → ${singular} (renamed)`);
        } else {
            console.log(`[global] ${plural} → ${singular} (would rename)`);
        }
    }

    return { deleted, mediaCopied };
}

async function mergeWorkoutExercises() {
    let renamed = 0;
    let mergedRows = 0;
    let logSetsReassigned = 0;

    for (const [plural, singular] of EXERCISE_PLURAL_MERGES) {
        const pluralRows = await prisma.exercise.findMany({
            where: { name: plural },
            select: {
                id: true,
                workoutId: true,
                _count: { select: { logSets: true } },
            },
        });

        for (const pluralEx of pluralRows) {
            const singularEx = await prisma.exercise.findFirst({
                where: {
                    workoutId: pluralEx.workoutId,
                    name: singular,
                    id: { not: pluralEx.id },
                },
                select: { id: true },
            });

            if (singularEx) {
                const setCount = pluralEx._count.logSets;
                if (setCount > 0 && !DRY_RUN) {
                    await prisma.logSet.updateMany({
                        where: { exerciseId: pluralEx.id },
                        data: { exerciseId: singularEx.id },
                    });
                    logSetsReassigned += setCount;
                }

                if (!DRY_RUN) {
                    const remaining = await prisma.logSet.count({ where: { exerciseId: pluralEx.id } });
                    if (remaining === 0) {
                        await prisma.exercise.delete({ where: { id: pluralEx.id } });
                    } else {
                        await prisma.exercise.update({
                            where: { id: pluralEx.id },
                            data: { isCustom: true },
                        });
                    }
                }
                mergedRows++;
                console.log(`[workout] merged ${plural} into ${singular} (workout ${pluralEx.workoutId})`);
            } else if (!DRY_RUN) {
                await prisma.exercise.update({
                    where: { id: pluralEx.id },
                    data: { name: singular },
                });
                renamed++;
            } else {
                renamed++;
            }
        }
    }

    return { renamed, mergedRows, logSetsReassigned };
}

async function main() {
    console.log(DRY_RUN ? "DRY RUN — no writes" : "Merging plural exercises...");
    console.log(`Pairs: ${EXERCISE_PLURAL_MERGES.length}`);

    const global = await mergeGlobalExercises();
    const workout = await mergeWorkoutExercises();

    console.log("\nDone.");
    console.log(`Global plurals removed/renamed: ${global.deleted}`);
    console.log(`Global media copied to singular: ${global.mediaCopied}`);
    console.log(`Workout exercises renamed: ${workout.renamed}`);
    console.log(`Workout duplicate rows merged: ${workout.mergedRows}`);
    console.log(`Log sets reassigned: ${workout.logSetsReassigned}`);
}

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
