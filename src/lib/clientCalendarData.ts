import { prisma } from "@/lib/prisma";
import { activeWorkoutWhere } from "@/lib/planWorkouts";
import { loadPlanScheduleRevisions, type PlanScheduleRevisionRecord } from "@/lib/planScheduleHistory";
import {
    loadHistoricalMissedSessions,
    type HistoricalMissedSession,
} from "@/lib/planMissedSessionHistory";
import { getClientAttentionActions, getExcusedMissedWorkoutKeys } from "@/lib/coachAttentionActions";
import { toDateKey } from "@/lib/utils";
import { cleanupStaleInProgressSessions } from "@/lib/workoutSessionCleanup";
import { resolveLogSetExerciseName } from "@/lib/logSetExerciseName";
import { logSetDisplayOrderBy } from "@/lib/logSetGrouping";

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
                exercises: Array<{ name: string; sets: number; reps: string }>;
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
}

export async function loadClientCalendarData(userId: string): Promise<ClientCalendarPayload> {
    await cleanupStaleInProgressSessions(userId);

    const [userPlan, completedLogs, inProgressLogs] = await Promise.all([
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
                        exercise: { select: { name: true, order: true, muscleGroup: true } },
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
    ]);

    const activePlan = userPlan?.plan ?? null;
    const [scheduleRevisions, clientActions, historicalMissedSessions] = await Promise.all([
        activePlan ? loadPlanScheduleRevisions(activePlan.id) : Promise.resolve([]),
        getClientAttentionActions(userId),
        loadHistoricalMissedSessions(userId),
    ]);
    const excusedMissedWorkoutKeys = [...getExcusedMissedWorkoutKeys(clientActions)];

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
                              name: ex.name,
                              sets: ex.sets,
                              reps: ex.reps,
                          })),
                      })),
                  })),
              }
            : null,
        planStartedAt: userPlan?.startedAt ? userPlan.startedAt.toISOString() : null,
        loggedDates: completedLogs.map((l) => ({
            id: l.id,
            date: toDateKey(l.loggedAt),
            workoutName: l.workout.name,
            workoutId: l.workoutId,
            duration: (l as { duration?: number | null }).duration ?? null,
            sets: l.sets.map((s) => ({
                exerciseId: s.exerciseId,
                exerciseName: resolveLogSetExerciseName(s),
                exerciseOrder: (s as { exerciseOrder?: number | null }).exerciseOrder ?? s.exercise.order ?? null,
                setNumber: s.setNumber,
                reps: s.reps,
                weightKg: s.weightKg,
                rpe: (s as { rpe?: number | null }).rpe ?? null,
            })),
        })),
        inProgressSessions: inProgressLogs.map((l) => ({
            id: l.id,
            date: toDateKey(l.loggedAt),
            workoutId: l.workoutId,
            workoutName: l.workout.name,
        })),
        scheduleRevisions,
        excusedMissedWorkoutKeys,
        historicalMissedSessions,
    };
}
