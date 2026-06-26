import { prisma } from "@/lib/prisma";
import { activeWorkoutWhere } from "@/lib/planWorkouts";
import { toDateKey } from "@/lib/utils";
import { cleanupStaleInProgressSessions } from "@/lib/workoutSessionCleanup";

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
            exerciseName: string;
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
                sets: { include: { exercise: { select: { name: true } } } },
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
                exerciseName: s.exercise.name,
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
    };
}
