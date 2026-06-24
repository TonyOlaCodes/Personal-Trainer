import { prisma } from "@/lib/prisma";
import { getCheckInDueState, getUserCheckInSchedule } from "@/lib/checkInSchedule";
import {
    hasNotificationSince,
    notifyCoachOfMissedCheckIn,
    notifyCoachOfMissedWorkout,
} from "@/lib/notifications";
import { getPlannedWorkoutForDate, activeWorkoutWhere } from "@/lib/planSchedule";
import { getWeekNumber, getLocalDayBounds, toDateKey } from "@/lib/utils";
import { isInactiveAccount } from "@/lib/userDeactivation";

function startOfIsoWeek(date: Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
}

/** End-of-day scan for missed check-ins and scheduled workouts across all coached clients. */
export async function processCoachMissedAlerts(referenceDate = new Date()) {
    const today = new Date(referenceDate);
    today.setHours(0, 0, 0, 0);
    const dateKey = toDateKey(today);
    const weekNumber = getWeekNumber(today);
    const { start: dayStart, end: dayEnd } = getLocalDayBounds(today);
    const weekStart = startOfIsoWeek(today);

    const clients = await prisma.user.findMany({
        where: {
            coachId: { not: null },
            role: { in: ["PREMIUM", "FREE"] },
        },
        select: {
            id: true,
            name: true,
            email: true,
            coachId: true,
            isDeleted: true,
            isDeactivated: true,
            plans: {
                where: { isActive: true },
                take: 1,
                select: {
                    startedAt: true,
                    plan: {
                        select: {
                            weeks: {
                                orderBy: { weekNumber: "asc" },
                                select: {
                                    weekNumber: true,
                                    workouts: {
                                        where: activeWorkoutWhere(),
                                        orderBy: { dayNumber: "asc" },
                                        select: {
                                            id: true,
                                            name: true,
                                            dayNumber: true,
                                            dayOfWeek: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            checkIns: {
                where: { weekNumber },
                select: { id: true },
                take: 1,
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

    let missedCheckIns = 0;
    let missedWorkouts = 0;

    for (const client of clients) {
        if (!client.coachId || isInactiveAccount(client)) continue;

        const coach = await prisma.user.findUnique({
            where: { id: client.coachId },
            select: { id: true, role: true, isDeleted: true, isDeactivated: true },
        });
        if (!coach || isInactiveAccount(coach)) continue;
        if (!["COACH", "SUPER_ADMIN"].includes(coach.role)) continue;

        const clientName = client.name ?? client.email ?? "Client";
        const activeUserPlan = client.plans[0] ?? null;
        const hasCheckInThisWeek = client.checkIns.length > 0;

        const schedule = await getUserCheckInSchedule(client.id);
        const dueState = getCheckInDueState(schedule, today);

        if ((dueState.isDueToday || dueState.isOverdue) && !hasCheckInThisWeek) {
            const dedupeEntityId = `${client.id}:${weekNumber}`;
            const alreadySent = await hasNotificationSince({
                userId: coach.id,
                type: "CLIENT_MISSED_CHECKIN",
                entityId: dedupeEntityId,
                since: weekStart,
            });

            if (!alreadySent) {
                await notifyCoachOfMissedCheckIn({
                    coachId: coach.id,
                    clientId: client.id,
                    clientName,
                    weekNumber,
                });
                missedCheckIns++;
            }
        }

        const plannedWorkout = getPlannedWorkoutForDate(activeUserPlan, today);
        if (plannedWorkout) {
            const completed = client.workoutLogs.some((log) => log.workoutId === plannedWorkout.id);
            if (!completed) {
                const dedupeEntityId = `${client.id}:${dateKey}:${plannedWorkout.id}`;
                const alreadySent = await hasNotificationSince({
                    userId: coach.id,
                    type: "CLIENT_MISSED_WORKOUT",
                    entityId: dedupeEntityId,
                    since: dayStart,
                });

                if (!alreadySent) {
                    await notifyCoachOfMissedWorkout({
                        coachId: coach.id,
                        clientId: client.id,
                        clientName,
                        workoutName: plannedWorkout.name,
                        dateKey,
                        workoutId: plannedWorkout.id,
                    });
                    missedWorkouts++;
                }
            }
        }
    }

    return { missedCheckIns, missedWorkouts, dateKey };
}
