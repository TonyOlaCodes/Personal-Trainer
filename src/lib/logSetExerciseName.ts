import { prisma } from "@/lib/prisma";
import {
    loadPlanScheduleRevisions,
    resolveScheduleWeeksForDate,
    serializePlanWeeksForSchedule,
    type ScheduleWorkoutSnapshot,
} from "@/lib/planScheduleHistory";
import { activeWorkoutWhere } from "@/lib/planWorkouts";

const REPAIR_VERSION = 1;

let columnReady = false;
let readyPromise: Promise<void> | null = null;

export function resolveLogSetExerciseName(set: {
    exerciseName?: string | null;
    exercise?: { name?: string | null } | null;
}): string {
    const snap = set.exerciseName?.trim();
    if (snap) return snap;
    return set.exercise?.name?.trim() || "Unknown";
}

export async function ensureLogSetExerciseNameColumn() {
    if (columnReady) return;
    await prisma.$executeRaw`
        ALTER TABLE "log_sets"
        ADD COLUMN IF NOT EXISTS "exerciseName" TEXT
    `;
    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "_app_schema_meta" (
            "key" TEXT PRIMARY KEY,
            "value" TEXT NOT NULL
        )
    `;
    columnReady = true;
}

async function getRepairVersion(): Promise<number> {
    const rows = await prisma.$queryRaw<Array<{ value: string }>>`
        SELECT "value" FROM "_app_schema_meta" WHERE "key" = 'log_set_exercise_name_repair' LIMIT 1
    `;
    return rows[0] ? Number(rows[0].value) || 0 : 0;
}

async function setRepairVersion(version: number) {
    await prisma.$executeRaw`
        INSERT INTO "_app_schema_meta" ("key", "value")
        VALUES ('log_set_exercise_name_repair', ${String(version)})
        ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"
    `;
}

type PlanWeeksCache = {
    liveWeeks: ReturnType<typeof serializePlanWeeksForSchedule>;
    revisions: Awaited<ReturnType<typeof loadPlanScheduleRevisions>>;
};

const planCache = new Map<string, PlanWeeksCache>();

async function getPlanScheduleCache(planId: string): Promise<PlanWeeksCache> {
    const cached = planCache.get(planId);
    if (cached) return cached;

    const plan = await prisma.plan.findUnique({
        where: { id: planId },
        include: {
            weeks: {
                orderBy: { weekNumber: "asc" },
                include: {
                    workouts: {
                        where: activeWorkoutWhere(),
                        orderBy: { dayNumber: "asc" },
                        include: {
                            exercises: {
                                where: { isCustom: false },
                                orderBy: { order: "asc" },
                            },
                        },
                    },
                },
            },
        },
    });

    const liveWeeks = plan
        ? serializePlanWeeksForSchedule(
              plan.weeks.map((week) => ({
                  weekNumber: week.weekNumber,
                  workouts: week.workouts.map((workout) => ({
                      id: workout.id,
                      name: workout.name,
                      dayNumber: workout.dayNumber,
                      dayOfWeek: workout.dayOfWeek,
                      exercises: workout.exercises.map((exercise) => ({
                          id: exercise.id,
                          name: exercise.name,
                          sets: exercise.sets,
                          reps: exercise.reps,
                      })),
                  })),
              }))
          )
        : [];

    const revisions = await loadPlanScheduleRevisions(planId);
    const entry = { liveWeeks, revisions };
    planCache.set(planId, entry);
    return entry;
}

function findScheduleWorkout(
    cache: PlanWeeksCache,
    workoutId: string,
    loggedAt: Date
): ScheduleWorkoutSnapshot | null {
    const weeks = resolveScheduleWeeksForDate(cache.liveWeeks, cache.revisions, loggedAt, new Date());
    for (const week of weeks) {
        const workout = week.workouts.find((row) => row.id === workoutId);
        if (workout) {
            const withExercises = workout as ScheduleWorkoutSnapshot;
            return {
                id: workout.id,
                name: workout.name,
                dayNumber: workout.dayNumber,
                dayOfWeek: workout.dayOfWeek ?? null,
                exercises: withExercises.exercises,
            };
        }
    }
    return null;
}

function inferExerciseNamesForLog(
    sets: Array<{
        id: string;
        exerciseId: string;
        setNumber: number;
        exercise: { name: string; isCustom?: boolean };
    }>,
    scheduleWorkout: ScheduleWorkoutSnapshot | null
): Map<string, string> {
    const groups = new Map<string, { minSet: number; exercise: { name: string; isCustom?: boolean } }>();

    for (const set of sets) {
        const existing = groups.get(set.exerciseId);
        if (!existing) {
            groups.set(set.exerciseId, { minSet: set.setNumber, exercise: set.exercise });
            continue;
        }
        existing.minSet = Math.min(existing.minSet, set.setNumber);
    }

    const ordered = [...groups.entries()].sort((a, b) => a[1].minSet - b[1].minSet);
    const scheduleExercises = scheduleWorkout?.exercises ?? [];
    const result = new Map<string, string>();

    ordered.forEach(([exerciseId, group], index) => {
        if (group.exercise.isCustom) {
            result.set(exerciseId, group.exercise.name.trim() || "Custom Exercise");
            return;
        }

        const byId = scheduleExercises.find((row) => row.id === exerciseId);
        if (byId?.name) {
            result.set(exerciseId, byId.name.trim());
            return;
        }

        const byPosition = scheduleExercises[index]?.name?.trim();
        if (byPosition) {
            result.set(exerciseId, byPosition);
            return;
        }

        result.set(exerciseId, group.exercise.name.trim() || "Unknown");
    });

    return result;
}

function pickMajorityName(counts: Map<string, number>): string | null {
    let bestName: string | null = null;
    let bestCount = 0;
    for (const [name, count] of counts) {
        if (count > bestCount) {
            bestCount = count;
            bestName = name;
        }
    }
    return bestName;
}

/** Rebuild snapshotted exercise names from schedule history and log order. */
export async function repairLogSetExerciseNames() {
    await ensureLogSetExerciseNameColumn();

    const logs = await prisma.workoutLog.findMany({
        where: { status: "COMPLETED" },
        select: {
            id: true,
            workoutId: true,
            loggedAt: true,
            workout: {
                select: {
                    week: { select: { planId: true } },
                },
            },
            sets: {
                select: {
                    id: true,
                    exerciseId: true,
                    setNumber: true,
                    exerciseName: true,
                    exercise: { select: { name: true, isCustom: true } },
                },
                orderBy: { setNumber: "asc" },
            },
        },
    });

    const votesByExerciseId = new Map<string, Map<string, number>>();
    const setTargets = new Map<string, string>();

    for (const log of logs) {
        const planId = log.workout.week?.planId;
        let scheduleWorkout: ScheduleWorkoutSnapshot | null = null;
        if (planId) {
            const cache = await getPlanScheduleCache(planId);
            scheduleWorkout = findScheduleWorkout(cache, log.workoutId, log.loggedAt);
        }

        const inferred = inferExerciseNamesForLog(log.sets, scheduleWorkout);
        for (const set of log.sets) {
            const inferredName = inferred.get(set.exerciseId);
            if (!inferredName) continue;

            setTargets.set(set.id, inferredName);

            let counts = votesByExerciseId.get(set.exerciseId);
            if (!counts) {
                counts = new Map();
                votesByExerciseId.set(set.exerciseId, counts);
            }
            counts.set(inferredName, (counts.get(inferredName) ?? 0) + 1);
        }
    }

    const batchSize = 200;
    const updates = [...setTargets.entries()];
    for (let i = 0; i < updates.length; i += batchSize) {
        const chunk = updates.slice(i, i + batchSize);
        await prisma.$transaction(
            chunk.map(([id, exerciseName]) =>
                prisma.logSet.update({
                    where: { id },
                    data: { exerciseName },
                })
            )
        );
    }

    for (const [exerciseId, counts] of votesByExerciseId) {
        const canonical = pickMajorityName(counts);
        if (!canonical) continue;

        const exercise = await prisma.exercise.findUnique({
            where: { id: exerciseId },
            select: { name: true, isCustom: true },
        });
        if (!exercise || exercise.isCustom) continue;
        if (exercise.name.trim() === canonical) continue;

        const totalVotes = [...counts.values()].reduce((sum, count) => sum + count, 0);
        const canonicalVotes = counts.get(canonical) ?? 0;
        if (canonicalVotes < totalVotes / 2) continue;

        await prisma.exercise.update({
            where: { id: exerciseId },
            data: { name: canonical },
        });
    }
}

export async function ensureLogSetExerciseNamesReady() {
    if (readyPromise) return readyPromise;

    readyPromise = (async () => {
        await ensureLogSetExerciseNameColumn();
        const version = await getRepairVersion();
        if (version < REPAIR_VERSION) {
            await repairLogSetExerciseNames();
            await setRepairVersion(REPAIR_VERSION);
        }
    })();

    try {
        await readyPromise;
    } finally {
        readyPromise = null;
    }
}
