import { prisma } from "@/lib/prisma";
import {
    loadPlanScheduleRevisions,
    resolveScheduleWeeksForDate,
    serializePlanWeeksForSchedule,
    type ScheduleWorkoutSnapshot,
} from "@/lib/planScheduleHistory";
import { activeWorkoutWhere } from "@/lib/planWorkouts";
import { ensureLogSetExerciseNameColumn } from "@/lib/logSetExerciseName";

const REPAIR_VERSION = 2;

let columnReady = false;
let readyPromise: Promise<void> | null = null;

export async function ensureLogSetExerciseOrderColumn() {
    if (columnReady) return;
    await ensureLogSetExerciseNameColumn();
    await prisma.$executeRaw`
        ALTER TABLE "log_sets"
        ADD COLUMN IF NOT EXISTS "exerciseOrder" INTEGER
    `;
    columnReady = true;
}

async function getRepairVersion(): Promise<number> {
    const rows = await prisma.$queryRaw<Array<{ value: string }>>`
        SELECT "value" FROM "_app_schema_meta" WHERE "key" = 'log_set_exercise_order_repair' LIMIT 1
    `;
    return rows[0] ? Number(rows[0].value) || 0 : 0;
}

async function setRepairVersion(version: number) {
    await prisma.$executeRaw`
        INSERT INTO "_app_schema_meta" ("key", "value")
        VALUES ('log_set_exercise_order_repair', ${String(version)})
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

function resolveOrderFromSchedule(
    exerciseId: string,
    exerciseName: string | null | undefined,
    scheduleWorkout: ScheduleWorkoutSnapshot | null,
    fallbackIndex: number
): number {
    return resolveOrderFromScheduleWorkout(
        exerciseId,
        exerciseName,
        scheduleWorkout,
        fallbackIndex
    );
}

export function resolveOrderFromScheduleWorkout(
    exerciseId: string,
    exerciseName: string | null | undefined,
    scheduleWorkout: ScheduleWorkoutSnapshot | null,
    fallbackIndex: number
): number {
    const scheduleExercises = scheduleWorkout?.exercises ?? [];
    const byId = scheduleExercises.findIndex((row) => row.id === exerciseId);
    if (byId >= 0) return byId;

    const normalizedName = exerciseName?.trim().toLowerCase();
    if (normalizedName) {
        const byName = scheduleExercises.findIndex(
            (row) => row.name.trim().toLowerCase() === normalizedName
        );
        if (byName >= 0) return byName;
    }

    return 1000 + fallbackIndex;
}

/** Backfill snapshotted exercise order for historical logs. */
export async function repairLogSetExerciseOrders() {
    await ensureLogSetExerciseOrderColumn();

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
                    exerciseName: true,
                    exerciseOrder: true,
                    setNumber: true,
                    exercise: { select: { order: true, isCustom: true, name: true } },
                },
                orderBy: [{ exerciseOrder: "asc" }, { setNumber: "asc" }],
            },
        },
    });

    const updates = new Map<string, number>();

    for (const log of logs) {
        const planId = log.workout.week?.planId;
        let scheduleWorkout: ScheduleWorkoutSnapshot | null = null;
        if (planId) {
            const cache = await getPlanScheduleCache(planId);
            scheduleWorkout = findScheduleWorkout(cache, log.workoutId, log.loggedAt);
        }

        const seenExerciseIds = new Set<string>();
        let appearanceIndex = 0;

        for (const set of log.sets) {
            if (seenExerciseIds.has(set.exerciseId)) continue;
            seenExerciseIds.add(set.exerciseId);

            const fallbackIndex = appearanceIndex++;
            const resolvedName = set.exerciseName?.trim() || set.exercise.name?.trim() || null;
            const order = set.exercise.isCustom
                ? 1000 + fallbackIndex
                : resolveOrderFromSchedule(
                    set.exerciseId,
                    resolvedName,
                    scheduleWorkout,
                    fallbackIndex
                );

            for (const row of log.sets) {
                if (row.exerciseId === set.exerciseId) {
                    updates.set(row.id, order);
                }
            }
        }
    }

    const batchSize = 200;
    const entries = [...updates.entries()];
    for (let i = 0; i < entries.length; i += batchSize) {
        const chunk = entries.slice(i, i + batchSize);
        await prisma.$transaction(
            chunk.map(([id, exerciseOrder]) =>
                prisma.logSet.update({
                    where: { id },
                    data: { exerciseOrder },
                })
            )
        );
    }
}

export async function ensureLogSetExerciseOrdersReady() {
    if (readyPromise) return readyPromise;

    readyPromise = (async () => {
        await ensureLogSetExerciseOrderColumn();
        const version = await getRepairVersion();
        if (version < REPAIR_VERSION) {
            await repairLogSetExerciseOrders();
            await setRepairVersion(REPAIR_VERSION);
        }
    })();

    try {
        await readyPromise;
    } finally {
        readyPromise = null;
    }
}

export function resolvePersistedExerciseOrder(
    exerciseOrder: number | undefined,
    exerciseListIndex: number
): number {
    if (typeof exerciseOrder === "number" && exerciseOrder >= 0) return exerciseOrder;
    return exerciseListIndex >= 0 ? exerciseListIndex : 999;
}
