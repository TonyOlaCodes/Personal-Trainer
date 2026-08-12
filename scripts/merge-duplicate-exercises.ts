/**
 * Safely merge duplicate exercises (Dip/Dips, Pull Up/Pull Ups, …) onto one canonical
 * name without deleting workout history.
 *
 * Remaps:
 * - global_exercises (merge rows + media)
 * - plan exercises (rename or merge within a workout)
 * - log_sets.exerciseId + exerciseName
 *
 * Run:
 *   npx tsx scripts/merge-duplicate-exercises.ts --dry-run
 *   npx tsx scripts/merge-duplicate-exercises.ts
 */

import { PrismaClient } from "@prisma/client";
import {
    canonicalExerciseName,
    findDuplicateExerciseGroups,
    mergeWouldLoseDistinction,
} from "../src/lib/exerciseCanonical";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

async function mergeGlobals(fromName: string, intoName: string) {
    const [from, into] = await Promise.all([
        prisma.globalExercise.findUnique({ where: { name: fromName } }),
        prisma.globalExercise.findUnique({ where: { name: intoName } }),
    ]);
    if (!from) return { deleted: 0, renamed: 0, mediaCopied: 0 };

    if (!into) {
        if (!DRY_RUN) {
            await prisma.globalExercise.update({
                where: { id: from.id },
                data: { name: intoName },
            });
        }
        console.log(`[global] rename ${fromName} → ${intoName}`);
        return { deleted: 0, renamed: 1, mediaCopied: 0 };
    }

    let mediaCopied = 0;
    const needsMedia =
        (!into.videoUrl && from.videoUrl)
        || (!into.thumbnailUrl && from.thumbnailUrl)
        || (!into.instructions && from.instructions)
        || (!into.muscleGroup && from.muscleGroup);

    if (needsMedia && !DRY_RUN) {
        await prisma.globalExercise.update({
            where: { id: into.id },
            data: {
                videoUrl: into.videoUrl ?? from.videoUrl,
                thumbnailUrl: into.thumbnailUrl ?? from.thumbnailUrl,
                instructions: into.instructions ?? from.instructions,
                muscleGroup: into.muscleGroup ?? from.muscleGroup,
            },
        });
        mediaCopied = 1;
    }

    if (!DRY_RUN) {
        await prisma.globalExercise.delete({ where: { id: from.id } });
    }
    console.log(`[global] merge ${fromName} → ${intoName}`);
    return { deleted: 1, renamed: 0, mediaCopied };
}

async function mergePlanExercises(fromName: string, intoName: string) {
    let renamed = 0;
    let merged = 0;
    let logSetsMoved = 0;

    const pluralRows = await prisma.exercise.findMany({
        where: { name: fromName },
        select: { id: true, workoutId: true, _count: { select: { logSets: true } } },
    });

    for (const fromEx of pluralRows) {
        const intoEx = await prisma.exercise.findFirst({
            where: {
                workoutId: fromEx.workoutId,
                name: intoName,
                id: { not: fromEx.id },
            },
            select: { id: true },
        });

        if (intoEx) {
            if (!DRY_RUN && fromEx._count.logSets > 0) {
                const result = await prisma.logSet.updateMany({
                    where: { exerciseId: fromEx.id },
                    data: { exerciseId: intoEx.id, exerciseName: intoName },
                });
                logSetsMoved += result.count;
            }

            if (!DRY_RUN) {
                const remaining = await prisma.logSet.count({ where: { exerciseId: fromEx.id } });
                if (remaining === 0) {
                    await prisma.exercise.delete({ where: { id: fromEx.id } });
                } else {
                    // Soft-hide rather than hard-delete if anything still points here.
                    await prisma.exercise.update({
                        where: { id: fromEx.id },
                        data: { isCustom: true, name: `${fromName} (merged)` },
                    });
                }
            }
            merged++;
            console.log(`[plan] merge ${fromName} → ${intoName} in workout ${fromEx.workoutId}`);
        } else {
            if (!DRY_RUN) {
                await prisma.exercise.update({
                    where: { id: fromEx.id },
                    data: { name: intoName },
                });
                await prisma.logSet.updateMany({
                    where: { exerciseId: fromEx.id },
                    data: { exerciseName: intoName },
                });
            }
            renamed++;
            console.log(`[plan] rename ${fromName} → ${intoName} (${fromEx.id})`);
        }
    }

    return { renamed, merged, logSetsMoved };
}

async function rewriteLogSetNames(fromName: string, intoName: string) {
    if (DRY_RUN) {
        const count = await prisma.logSet.count({ where: { exerciseName: fromName } });
        if (count > 0) console.log(`[logs] would rewrite ${count} set names ${fromName} → ${intoName}`);
        return count;
    }
    const result = await prisma.logSet.updateMany({
        where: { exerciseName: fromName },
        data: { exerciseName: intoName },
    });
    if (result.count > 0) {
        console.log(`[logs] rewrite ${result.count} set names ${fromName} → ${intoName}`);
    }
    return result.count;
}

async function main() {
    const [globals, planExercises, logNames] = await Promise.all([
        prisma.globalExercise.findMany({ select: { name: true } }),
        prisma.exercise.findMany({ select: { name: true } }),
        prisma.logSet.findMany({
            where: { exerciseName: { not: null } },
            select: { exerciseName: true },
            distinct: ["exerciseName"],
        }),
    ]);

    const allNames = [
        ...globals.map((g) => g.name),
        ...planExercises.map((e) => e.name),
        ...logNames.map((l) => l.exerciseName!).filter(Boolean),
    ];

    const groups = findDuplicateExerciseGroups(allNames);
    console.log(
        `${DRY_RUN ? "DRY RUN — " : ""}Found ${groups.length} duplicate group(s) to merge`
    );

    let totals = {
        globalDeleted: 0,
        globalRenamed: 0,
        planRenamed: 0,
        planMerged: 0,
        logSetsMoved: 0,
        logNamesRewritten: 0,
    };

    for (const group of groups) {
        const into = group.canonicalName;
        console.log(`\n→ ${into}`);
        for (const from of group.duplicateNames) {
            if (mergeWouldLoseDistinction(from, into)) {
                console.log(`  skip ${from} (would lose distinction)`);
                continue;
            }
            if (canonicalExerciseName(from) !== into && canonicalExerciseName(from) !== from) {
                // Prefer dictionary canonical when the group's pick differs.
            }
            const g = await mergeGlobals(from, into);
            totals.globalDeleted += g.deleted;
            totals.globalRenamed += g.renamed;
            const p = await mergePlanExercises(from, into);
            totals.planRenamed += p.renamed;
            totals.planMerged += p.merged;
            totals.logSetsMoved += p.logSetsMoved;
            totals.logNamesRewritten += await rewriteLogSetNames(from, into);
        }
    }

    // Also rename any non-canonical spellings that aren't in a multi-name group
    // (e.g. only "Dips" exists, no "Dip" yet — still rename to dictionary form).
    const uniquePlanNames = [...new Set(planExercises.map((e) => e.name))];
    for (const name of uniquePlanNames) {
        const canonical = canonicalExerciseName(name);
        if (!canonical || canonical === name) continue;
        if (mergeWouldLoseDistinction(name, canonical)) continue;
        if (groups.some((g) => g.duplicateNames.includes(name) || g.canonicalName === name)) continue;
        console.log(`\n→ rename lone spelling ${name} → ${canonical}`);
        const g = await mergeGlobals(name, canonical);
        totals.globalDeleted += g.deleted;
        totals.globalRenamed += g.renamed;
        const p = await mergePlanExercises(name, canonical);
        totals.planRenamed += p.renamed;
        totals.planMerged += p.merged;
        totals.logSetsMoved += p.logSetsMoved;
        totals.logNamesRewritten += await rewriteLogSetNames(name, canonical);
    }

    console.log("\nDone:", totals);
    if (DRY_RUN) console.log("Re-run without --dry-run to apply.");
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
