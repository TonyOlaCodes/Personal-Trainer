import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureGlobalExerciseMediaColumns } from "@/lib/exerciseMedia";

type Db = PrismaClient | Prisma.TransactionClient;

export type MergeExercisesResult = {
  targetName: string;
  sourceNames: string[];
  globalsMerged: number;
  planRenamed: number;
  planMerged: number;
  logSetsMoved: number;
  logNamesRewritten: number;
};

/**
 * Merge one or more exercises into a surviving target name.
 * Remaps plan exercises + log_sets so history from every source joins the target.
 * Never deletes workout logs — only remaps exercise references.
 */
export async function mergeExercisesIntoTarget(options: {
  sourceNames: string[];
  targetName: string;
  targetMuscleGroup?: string | null;
  db?: Db;
}): Promise<MergeExercisesResult> {
  const db = options.db ?? prisma;
  await ensureGlobalExerciseMediaColumns(db);
  const targetName = options.targetName.trim();
  if (!targetName) throw new Error("Target name is required");

  const sourceNames = [
    ...new Set(
      options.sourceNames
        .map((n) => n.trim())
        .filter((n) => n && n.toLowerCase() !== targetName.toLowerCase())
    ),
  ];
  if (sourceNames.length === 0) throw new Error("Select at least one exercise to merge");

  let globalsMerged = 0;
  let planRenamed = 0;
  let planMerged = 0;
  let logSetsMoved = 0;
  let logNamesRewritten = 0;

  // Ensure target global exists (prefer existing row; else rename first source; else create).
  let target = await db.globalExercise.findFirst({
    where: { name: { equals: targetName, mode: "insensitive" } },
  });

  const sourceGlobals = await db.globalExercise.findMany({
    where: {
      OR: sourceNames.map((name) => ({ name: { equals: name, mode: "insensitive" } })),
    },
  });

  if (!target && sourceGlobals.length > 0) {
    const first = sourceGlobals[0];
    target = await db.globalExercise.update({
      where: { id: first.id },
      data: {
        name: targetName,
        ...(options.targetMuscleGroup !== undefined
          ? { muscleGroup: options.targetMuscleGroup?.trim() || null }
          : {}),
      },
    });
    globalsMerged += 0;
  } else if (!target) {
    target = await db.globalExercise.create({
      data: {
        name: targetName,
        muscleGroup: options.targetMuscleGroup?.trim() || null,
      },
    });
  } else if (options.targetMuscleGroup !== undefined) {
    target = await db.globalExercise.update({
      where: { id: target.id },
      data: {
        name: targetName,
        muscleGroup: options.targetMuscleGroup?.trim() || null,
      },
    });
  } else if (target.name !== targetName) {
    target = await db.globalExercise.update({
      where: { id: target.id },
      data: { name: targetName },
    });
  }

  // Fold remaining source globals into target (copy missing media, then delete).
  for (const from of sourceGlobals) {
    if (from.id === target.id) continue;

    await db.globalExercise.update({
      where: { id: target.id },
      data: {
        videoUrl: target.videoUrl ?? from.videoUrl,
        muscleGroup: target.muscleGroup ?? from.muscleGroup,
      },
    });

    // Media columns may live via raw SQL helpers — best-effort copy via Prisma fields if present.
    await db.$executeRawUnsafe(
      `UPDATE "global_exercises"
       SET "instructions" = COALESCE("instructions", $1),
           "thumbnailUrl" = COALESCE("thumbnailUrl", $2)
       WHERE "id" = $3`,
      from.instructions ?? null,
      from.thumbnailUrl ?? null,
      target.id
    );

    await db.globalExercise.delete({ where: { id: from.id } });
    globalsMerged += 1;
    target = await db.globalExercise.findUniqueOrThrow({ where: { id: target.id } });
  }

  // Remap plan exercises + log sets for each source name (and case variants).
  for (const fromName of sourceNames) {
    const planRows = await db.exercise.findMany({
      where: { name: { equals: fromName, mode: "insensitive" } },
      select: { id: true, workoutId: true, _count: { select: { logSets: true } } },
    });

    for (const fromEx of planRows) {
      const intoEx = await db.exercise.findFirst({
        where: {
          workoutId: fromEx.workoutId,
          name: { equals: targetName, mode: "insensitive" },
          id: { not: fromEx.id },
        },
        select: { id: true },
      });

      if (intoEx) {
        if (fromEx._count.logSets > 0) {
          const moved = await db.logSet.updateMany({
            where: { exerciseId: fromEx.id },
            data: { exerciseId: intoEx.id, exerciseName: targetName },
          });
          logSetsMoved += moved.count;
        }
        const remaining = await db.logSet.count({ where: { exerciseId: fromEx.id } });
        if (remaining === 0) {
          await db.exercise.delete({ where: { id: fromEx.id } });
        } else {
          await db.exercise.update({
            where: { id: fromEx.id },
            data: { isCustom: true, name: `${fromName} (merged)` },
          });
        }
        planMerged += 1;
      } else {
        await db.exercise.update({
          where: { id: fromEx.id },
          data: { name: targetName },
        });
        const renamedLogs = await db.logSet.updateMany({
          where: { exerciseId: fromEx.id },
          data: { exerciseName: targetName },
        });
        logSetsMoved += renamedLogs.count;
        planRenamed += 1;
      }
    }

    const rewritten = await db.logSet.updateMany({
      where: { exerciseName: { equals: fromName, mode: "insensitive" } },
      data: { exerciseName: targetName },
    });
    logNamesRewritten += rewritten.count;
  }

  return {
    targetName,
    sourceNames,
    globalsMerged,
    planRenamed,
    planMerged,
    logSetsMoved,
    logNamesRewritten,
  };
}

/**
 * After renaming / retargeting a dictionary entry, keep plan rows + log snapshots in sync.
 */
export async function syncExerciseRename(options: {
  fromName: string;
  toName: string;
  muscleGroup?: string | null;
  db?: Db;
}) {
  const db = options.db ?? prisma;
  const fromName = options.fromName.trim();
  const toName = options.toName.trim();
  if (!fromName || !toName || fromName === toName) {
    if (options.muscleGroup !== undefined && toName) {
      await db.exercise.updateMany({
        where: { name: { equals: toName, mode: "insensitive" } },
        data: { muscleGroup: options.muscleGroup?.trim() || null },
      });
    }
    return { planUpdated: 0, logsUpdated: 0 };
  }

  const planUpdated = await db.exercise.updateMany({
    where: { name: { equals: fromName, mode: "insensitive" } },
    data: {
      name: toName,
      ...(options.muscleGroup !== undefined
        ? { muscleGroup: options.muscleGroup?.trim() || null }
        : {}),
    },
  });

  const logsUpdated = await db.logSet.updateMany({
    where: { exerciseName: { equals: fromName, mode: "insensitive" } },
    data: { exerciseName: toName },
  });

  return { planUpdated: planUpdated.count, logsUpdated: logsUpdated.count };
}
