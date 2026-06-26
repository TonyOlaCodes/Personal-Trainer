import { prisma } from "@/lib/prisma";
import { getCheckInDueState, getUserCheckInSchedule } from "@/lib/checkInSchedule";
import {
    getLocalTimeParts,
    localDayBoundsUtc,
    localTimeMatchesNotifySlot,
} from "@/lib/coachNotificationSchedule";
import {
    flushPendingCoachNotifications,
    createNotification,
    getCoachNotificationSchedule,
    hasNotificationSince,
    userWantsNotification,
} from "@/lib/notifications";
import { getPlannedWorkoutForDate, activeWorkoutWhere } from "@/lib/planSchedule";
import { getWeekNumber } from "@/lib/utils";
import { isInactiveAccount } from "@/lib/userDeactivation";

function startOfIsoWeek(dateKey: string, timezone: string) {
    const [y, m, d] = dateKey.split("-").map(Number);
    const ref = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
    const day = ref.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    ref.setUTCDate(ref.getUTCDate() + diff);
    return getLocalTimeParts(ref, timezone).dateKey;
}

async function processMissedCheckInsForCoach(
    coachId: string,
    dateKey: string,
    timezone: string
) {
    if (!(await userWantsNotification(coachId, "notifyOnMissedCheckIn"))) {
        return 0;
    }

    const weekStartKey = startOfIsoWeek(dateKey, timezone);
    const [wy, wm, wd] = weekStartKey.split("-").map(Number);
    const weekStart = new Date(Date.UTC(wy, wm - 1, wd, 0, 0, 0, 0));
    const weekNumber = getWeekNumber(new Date(`${dateKey}T12:00:00.000Z`));

    const clients = await prisma.user.findMany({
        where: {
            coachId,
            role: { in: ["PREMIUM", "FREE"] },
        },
        select: {
            id: true,
            name: true,
            email: true,
            isDeleted: true,
            isDeactivated: true,
            checkIns: {
                where: { weekNumber },
                select: { id: true },
                take: 1,
            },
        },
    });

    let sent = 0;
    for (const client of clients) {
        if (isInactiveAccount(client)) continue;
        if (client.checkIns.length > 0) continue;

        const schedule = await getUserCheckInSchedule(client.id);
        const dueState = getCheckInDueState(schedule, new Date());

        if (!dueState.isDueToday && !dueState.isOverdue) continue;

        const dedupeEntityId = `${client.id}:${ weekNumber}`;
        const alreadySent = await hasNotificationSince({
            userId: coachId,
            type: "CLIENT_MISSED_CHECKIN",
            entityId: dedupeEntityId,
            since: weekStart,
        });

        if (alreadySent) continue;

        await createNotification({
            userId: coachId,
            type: "CLIENT_MISSED_CHECKIN",
            message: `${client.name ?? client.email ?? "Client"} has not completed their check-in`,
            entityType: "USER",
            entityId: dedupeEntityId,
            route: `/coach/client/${client.id}`,
        });
        sent++;
    }

    return sent;
}

async function processMissedWorkoutsForCoach(
    coachId: string,
    dateKey: string,
    timezone: string
) {
    if (!(await userWantsNotification(coachId, "notifyOnMissedWorkout"))) {
        return 0;
    }

    const { start: dayStart, end: dayEnd } = localDayBoundsUtc(dateKey, timezone);

    const clients = await prisma.user.findMany({
        where: {
            coachId,
            role: { in: ["PREMIUM", "FREE"] },
        },
        select: {
            id: true,
            name: true,
            email: true,
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
            workoutLogs: {
                where: {
                    status: "COMPLETED",
                    loggedAt: { gte: dayStart, lte: dayEnd },
                },
                select: { workoutId: true },
            },
        },
    });

    let sent = 0;
    for (const client of clients) {
        if (isInactiveAccount(client)) continue;

        const activeUserPlan = client.plans[0] ?? null;
        const [y, m, d] = dateKey.split("-").map(Number);
        const plannedWorkout = getPlannedWorkoutForDate(activeUserPlan, new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0)));
        if (!plannedWorkout) continue;

        const completed = client.workoutLogs.some((log) => log.workoutId === plannedWorkout.id);
        if (completed) continue;

        const dedupeEntityId = `${client.id}:${dateKey}:${plannedWorkout.id}`;
        const alreadySent = await hasNotificationSince({
            userId: coachId,
            type: "CLIENT_MISSED_WORKOUT",
            entityId: dedupeEntityId,
            since: dayStart,
        });

        if (alreadySent) continue;

        await createNotification({
            userId: coachId,
            type: "CLIENT_MISSED_WORKOUT",
            message: `${client.name ?? client.email ?? "Client"} missed ${plannedWorkout.name}`,
            entityType: "USER",
            entityId: dedupeEntityId,
            route: `/coach/client/${client.id}`,
        });
        sent++;
    }

    return sent;
}

/** Hourly/15-min cron: deliver queued alerts and run missed scans at each coach's chosen times. */
export async function processScheduledCoachAlerts(referenceDate = new Date()) {
    const coaches = await prisma.user.findMany({
        where: { role: { in: ["COACH", "SUPER_ADMIN"] } },
        select: {
            id: true,
            email: true,
            isDeleted: true,
            isDeactivated: true,
        },
    });

    let missedCheckIns = 0;
    let missedWorkouts = 0;

    for (const coach of coaches) {
        if (isInactiveAccount(coach)) continue;

        const schedule = await getCoachNotificationSchedule(coach.id);
        const local = getLocalTimeParts(referenceDate, schedule.timezone);

        if (
            schedule.notifyOnMissedCheckInTime
            && localTimeMatchesNotifySlot(referenceDate, schedule.timezone, schedule.notifyOnMissedCheckInTime)
        ) {
            missedCheckIns += await processMissedCheckInsForCoach(coach.id, local.dateKey, schedule.timezone);
        }

        if (
            schedule.notifyOnMissedWorkoutTime
            && localTimeMatchesNotifySlot(referenceDate, schedule.timezone, schedule.notifyOnMissedWorkoutTime)
        ) {
            missedWorkouts += await processMissedWorkoutsForCoach(coach.id, local.dateKey, schedule.timezone);
        }
    }

    const pendingSent = await flushPendingCoachNotifications(referenceDate);

    return {
        missedCheckIns,
        missedWorkouts,
        pendingSent,
        processedAt: referenceDate.toISOString(),
    };
}

/** @deprecated Use processScheduledCoachAlerts — kept for manual scripts. */
export async function processCoachMissedAlerts(referenceDate = new Date()) {
    return processScheduledCoachAlerts(referenceDate);
}
