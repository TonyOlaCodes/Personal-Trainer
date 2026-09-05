import { prisma } from "@/lib/prisma";
import { activeWorkoutWhere } from "@/lib/planWorkouts";
import { loadPlanScheduleRevisions, type PlanScheduleRevisionRecord } from "@/lib/planScheduleHistory";
import {
    loadHistoricalMissedSessions,
    persistPastDueScheduledSessionsForUser,
    type HistoricalMissedSession,
} from "@/lib/planMissedSessionHistory";
import { getClientAttentionActions, getExcusedMissedWorkoutKeys } from "@/lib/coachAttentionActions";
import { toDateKey } from "@/lib/utils";
import { cleanupStaleInProgressSessions } from "@/lib/workoutSessionCleanup";
import { resolveLogSetExerciseName } from "@/lib/logSetExerciseName";
import { logSetDisplayOrderBy } from "@/lib/logSetGrouping";
import { serializePlanWeeksForSchedule, resolveScheduleWeeksForDate } from "@/lib/planScheduleHistory";
import { resolveOrderFromScheduleWorkout } from "@/lib/logSetExerciseOrder";
import {
    listSessionOverridesForUser,
    sessionOverrideMapKey,
} from "@/lib/workoutSessionOverrides";

export interface ClientCalendarPayload {
    activePlan: {
        id: string;
        name: string;
        weeks: Array<{
            weekNumber: number;
            workouts: Array<{
                dayNumber: number;
                dayOfWeek: number | null;
                name: string;
                id: string;
                exercises: Array<{ id: string; name: string; sets: number; reps: string; order: number; weightTargetKg: number | null }>;
            }>;
        }>;
    } | null;
    planStartedAt: string | null;
    loggedDates: Array<{
        id: string;
        date: string;
        workoutName: string;
        workoutId: string;
        duration: number | null;
        sets: Array<{
            exerciseId: string;
            exerciseName: string;
            exerciseOrder: number | null;
            setNumber: number;
            reps: number | null;
            weightKg: number | null;
            rpe: number | null;
        }>;
    }>;
    inProgressSessions: Array<{
        id: string;
        date: string;
        workoutId: string;
        workoutName: string;
    }>;
    scheduleRevisions: PlanScheduleRevisionRecord[];
    /** `${dateKey}:${workoutId}` keys for missed workouts excused by the coach */
    excusedMissedWorkoutKeys: string[];
    /** Missed sessions frozen before plan edits so past calendar cells stay accurate */
    historicalMissedSessions: HistoricalMissedSession[];
    /** One-off coach session overrides keyed by `${dateKey}:${workoutId}` */
    sessionOverrides: Record<
        string,
        {
            workoutName: string | null;
            exercises: Array<{
                id: string;
                name: string;
                sets: number;
                reps: string;
                order: number;
                weightTargetKg: number | null;
                setTargets?: Array<{
                    setNumber: number;
                    weightKg?: number | null;
                    reps?: number | null;
                }>;
            }>;
        }
    >;
}

export async function loadClientCalendarData(userId: string): Promise<ClientCalendarPayload> {
    await cleanupStaleInProgressSessions(userId);

    const [userPlan, completedLogs, inProgressLogs] = await Promise.all([
        persistPastDueScheduledSessionsForUser(userId).then(() => null),
        prisma.userPlan.findFirst({
            where: { userId, isActive: true },
            include: {
                plan: {
                    include: {
                        weeks: {
                            include: {
                                workouts: {
                                    where: activeWorkoutWhere(),
                                    include: {
                                        exercises: {
                                            where: { isCustom: false },
                                            orderBy: { order: "asc" },
                                        },
                                    },
                                    orderBy: { dayNumber: "asc" },
                                },
                            },
                            orderBy: { weekNumber: "asc" },
                        },
                    },
                },
            },
        }),
        prisma.workoutLog.findMany({
            where: { userId, status: "COMPLETED" },
            include: {
                workout: { select: { name: true, id: true } },
                sets: {
                    include: {
                        exercise: { select: { name: true, order: true, muscleGroup: true, isCustom: true } },
                    },
                    orderBy: logSetDisplayOrderBy,
                },
            },
            orderBy: { loggedAt: "desc" },
            take: 365,
        }),
        prisma.workoutLog.findMany({
            where: { userId, status: "IN_PROGRESS" },
            include: { workout: { select: { name: true, id: true } } },
            orderBy: { updatedAt: "desc" },
        }),
        persistPastDueScheduledSessionsForUser(userId),
    ]);

    const activePlan = userPlan?.plan ?? null;
    const [scheduleRevisions, clientActions, historicalMissedSessions, sessionOverrideRows] =
        await Promise.all([
            activePlan ? loadPlanScheduleRevisions(activePlan.id) : Promise.resolve([]),
            getClientAttentionActions(userId),
            loadHistoricalMissedSessions(userId),
            listSessionOverridesForUser(userId),
        ]);
    const excusedMissedWorkoutKeys = [...getExcusedMissedWorkoutKeys(clientActions)];
    const sessionOverrides = Object.fromEntries(
        sessionOverrideRows.map((row) => [
            sessionOverrideMapKey(row.dateKey, row.baseWorkoutId),
            {
                workoutName: row.workoutName,
                exercises: row.exercises.map((ex, index) => ({
                    id: ex.id,
                    name: ex.name,
                    sets: ex.sets,
                    reps: ex.reps,
                    order: ex.order ?? index,
                    weightTargetKg: ex.weightTargetKg ?? null,
                    setTargets: ex.setTargets,
                })),
            },
        ])
    );

    const serializedWeeks = activePlan
        ? serializePlanWeeksForSchedule(
            activePlan.weeks.map((week) => ({
                weekNumber: week.weekNumber,
                workouts: week.workouts.map((workout) => ({
                    id: workout.id,
                    name: workout.name,
                    dayNumber: workout.dayNumber,
                    dayOfWeek: (workout as { dayOfWeek?: number | null }).dayOfWeek ?? null,
                    exercises: workout.exercises.map((exercise) => ({
                        id: exercise.id,
                        name: exercise.name,
                        sets: exercise.sets,
                        reps: exercise.reps,
                        weightTargetKg: exercise.weightTargetKg ?? null,
                    })),
                })),
            }))
        )
        : [];

    const scheduleRevisionList = scheduleRevisions;

    return {
        activePlan: activePlan
            ? {
                  id: activePlan.id,
                  name: activePlan.name,
                  weeks: activePlan.weeks.map((w) => ({
                      weekNumber: w.weekNumber,
                      workouts: w.workouts.map((wd) => ({
                          dayNumber: wd.dayNumber,
                          dayOfWeek: (wd as { dayOfWeek?: number | null }).dayOfWeek ?? null,
                          name: wd.name,
                          id: wd.id,
                          exercises: wd.exercises.map((ex) => ({
                              id: ex.id,
                              name: ex.name,
                              sets: ex.sets,
                              reps: ex.reps,
                              order: ex.order,
                              weightTargetKg: ex.weightTargetKg ?? null,
                          })),
                      })),
                  })),
              }
            : null,
        planStartedAt: userPlan?.startedAt ? userPlan.startedAt.toISOString() : null,
        loggedDates: completedLogs.map((l) => {
            const loggedAt = l.loggedAt;
            const scheduleWeeks = resolveScheduleWeeksForDate(
                serializedWeeks,
                scheduleRevisionList,
                loggedAt,
                new Date()
            );
            const scheduleWorkout = scheduleWeeks
                .flatMap((week) => week.workouts)
                .find((workout) => workout.id === l.workoutId);
            const scheduleWorkoutSnapshot = scheduleWorkout
                ? {
                      ...scheduleWorkout,
                      dayOfWeek: scheduleWorkout.dayOfWeek ?? null,
                  }
                : null;

            const orderByExerciseId = new Map<string, number>();
            let appearanceIndex = 0;

            for (const set of l.sets) {
                if (orderByExerciseId.has(set.exerciseId)) continue;
                const persisted = (set as { exerciseOrder?: number | null }).exerciseOrder;
                if (typeof persisted === "number" && persisted >= 0) {
                    orderByExerciseId.set(set.exerciseId, persisted);
                    continue;
                }
                const order = set.exercise.isCustom
                    ? 1000 + appearanceIndex
                    : resolveOrderFromScheduleWorkout(
                        set.exerciseId,
                        resolveLogSetExerciseName(set),
                        scheduleWorkoutSnapshot as Parameters<typeof resolveOrderFromScheduleWorkout>[2],
                        appearanceIndex
                    );
                orderByExerciseId.set(set.exerciseId, order);
                appearanceIndex += 1;
            }

            return {
                id: l.id,
                date: toDateKey(loggedAt),
                workoutName: l.workout.name,
                workoutId: l.workoutId,
                duration: (l as { duration?: number | null }).duration ?? null,
                sets: l.sets.map((s) => ({
                    exerciseId: s.exerciseId,
                    exerciseName: resolveLogSetExerciseName(s),
                    exerciseOrder: orderByExerciseId.get(s.exerciseId) ?? s.exercise.order ?? null,
                    setNumber: s.setNumber,
                    reps: s.reps,
                    weightKg: s.weightKg,
                    rpe: (s as { rpe?: number | null }).rpe ?? null,
                })),
            };
        }),
        inProgressSessions: inProgressLogs.map((l) => ({
            id: l.id,
            date: toDateKey(l.loggedAt),
            workoutId: l.workoutId,
            workoutName: l.workout.name,
        })),
        scheduleRevisions,
        excusedMissedWorkoutKeys,
        historicalMissedSessions,
        sessionOverrides,
    };
}
