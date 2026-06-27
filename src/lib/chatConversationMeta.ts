import { prisma } from "@/lib/prisma";
import { getCheckInDueState, getUserCheckInSchedule } from "@/lib/checkInSchedule";
import { getPlannedWorkoutForDate, activeWorkoutWhere } from "@/lib/planSchedule";
import { getWeekNumber, toDateKey } from "@/lib/utils";
import { isInactiveAccount } from "@/lib/userDeactivation";

export type CoachClientFilterFlags = {
    checkInDue: boolean;
    missedWorkout: boolean;
};

export async function getCoachClientFilterFlags(
    clientIds: string[]
): Promise<Record<string, CoachClientFilterFlags>> {
    if (clientIds.length === 0) return {};

    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const dateKey = toDateKey(today);
    const [y, m, d] = dateKey.split("-").map(Number);
    const dayStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
    const weekNumber = getWeekNumber(today);

    const clients = await prisma.user.findMany({
        where: { id: { in: clientIds } },
        select: {
            id: true,
            isDeleted: true,
            isDeactivated: true,
            email: true,
            checkIns: {
                where: { weekNumber },
                select: { id: true },
                take: 1,
            },
            plans: {
                where: { isActive: true },
                take: 1,
                select: {
                    startedAt: true,
                    plan: {
                        select: {
                            weeks: {
                                where: { weekNumber },
                                select: {
                                    workouts: {
                                        where: activeWorkoutWhere(),
                                        orderBy: { dayNumber: "asc" },
                                        select: { id: true, name: true, dayNumber: true, dayOfWeek: true },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            workoutLogs: {
                where: {
                    status: "COMPLETED",
                    loggedAt: { gte: dayStart, lte: dayEnd },
                },
                select: { workoutId: true },
            },
        },
    });

    const result: Record<string, CoachClientFilterFlags> = {};

    await Promise.all(clients.map(async (client) => {
        if (isInactiveAccount(client)) {
            result[client.id] = { checkInDue: false, missedWorkout: false };
            return;
        }

        let checkInDue = false;
        if (client.checkIns.length === 0) {
            const schedule = await getUserCheckInSchedule(client.id);
            const dueState = getCheckInDueState(schedule, today);
            checkInDue = dueState.isDueToday || dueState.isOverdue;
        }

        let missedWorkout = false;
        const userPlan = client.plans[0] ?? null;
        const plannedWorkout = getPlannedWorkoutForDate(
            userPlan
                ? { startedAt: userPlan.startedAt, plan: userPlan.plan }
                : null,
            new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0))
        );
        if (plannedWorkout) {
            missedWorkout = !client.workoutLogs.some((log) => log.workoutId === plannedWorkout.id);
        }

        result[client.id] = { checkInDue, missedWorkout };
    }));

    return result;
}
