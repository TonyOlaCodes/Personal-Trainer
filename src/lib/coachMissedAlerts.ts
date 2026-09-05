import { prisma } from "@/lib/prisma";
import { APP_TIMEZONE } from "@/lib/appTimezone";
import { getCheckInDueState, getUserCheckInSchedule } from "@/lib/checkInSchedule";
import {
    DEFAULT_MISSED_NOTIFY_TIME,
    getLocalTimeParts,
    nextDeliveryUtc,
    shiftDateKey,
    shouldDeliverMissedAlertNow,
} from "@/lib/coachNotificationSchedule";
import {
    flushPendingCoachNotifications,
    createNotification,
    hasNotificationSince,
    queueCoachNotification,
    userWantsNotification,
} from "@/lib/notifications";
import { loadCoachAttentionInbox } from "@/lib/coachAttentionInbox";
import { getIsoWeekYear } from "@/lib/checkInLabels";
import {
    COACH_MISSED_CHECKIN_TYPE,
    COACH_MISSED_WORKOUT_TYPE,
    coachMissedCheckInEntityId,
    coachMissedWorkoutEntityId,
    shouldQueueCoachMissedNotification,
} from "@/lib/scheduledCoachNotifications";
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

async function processMissedCheckInsForClients(dateKey: string, timezone: string) {
    const weekStartKey = startOfIsoWeek(dateKey, timezone);
    const [wy, wm, wd] = weekStartKey.split("-").map(Number);
    const weekStart = new Date(Date.UTC(wy, wm - 1, wd, 0, 0, 0, 0));
    const [sy, sm, sd] = dateKey.split("-").map(Number);
    const scanDate = new Date(Date.UTC(sy, sm - 1, sd, 12, 0, 0, 0));
    const lookback = new Date(scanDate);
    lookback.setUTCDate(lookback.getUTCDate() - 90);

    const clients = await prisma.user.findMany({
        where: {
            role: { in: ["PREMIUM", "FREE"] },
        },
        select: {
            id: true,
            email: true,
            isDeleted: true,
            isDeactivated: true,
            checkIns: {
                where: { createdAt: { gte: lookback } },
                select: { id: true, weekNumber: true },
            },
        },
    });

    let sent = 0;
    for (const client of clients) {
        if (isInactiveAccount(client)) continue;
        if (!(await userWantsNotification(client.id, "notifyOnMissedCheckIn"))) continue;

        const schedule = await getUserCheckInSchedule(client.id);
        const dueState = getCheckInDueState(schedule, scanDate);
        if (!dueState.isConfigured) continue;
        if (!dueState.isDueToday && !dueState.isOverdue) continue;

        const periodWeek = dueState.outstandingWeekNumber ?? getWeekNumber(scanDate);
        if (client.checkIns.some((c) => c.weekNumber === periodWeek)) continue;

        const dedupeEntityId = `${client.id}:${periodWeek}`;
        const alreadySent = await hasNotificationSince({
            userId: client.id,
            type: "MISSED_CHECKIN",
            entityId: dedupeEntityId,
            since: weekStart,
        });

        if (alreadySent) continue;

        await createNotification({
            userId: client.id,
            type: "MISSED_CHECKIN",
            message: dueState.isOverdue
                ? "Your check-in is overdue — tap to submit it now."
                : "You haven't completed your check-in this week — tap to submit it now.",
            entityType: "CHECK_IN",
            entityId: dedupeEntityId,
            route: "/checkins",
        });
        sent++;
    }

    return sent;
}

async function queueOpenCoachInboxAlerts(referenceDate: Date) {
    const coaches = await prisma.user.findMany({
        where: {
            role: "COACH",
            isDeleted: false,
            isDeactivated: false,
        },
        select: {
            id: true,
            notificationTimezone: true,
            notifyOnMissedCheckInTime: true,
            notifyOnMissedWorkoutTime: true,
        },
    });

    let missedCheckIns = 0;
    let missedWorkouts = 0;

    for (const coach of coaches) {
        const items = await loadCoachAttentionInbox(coach.id);
        const timezone = coach.notificationTimezone || APP_TIMEZONE;
        const checkInTime = coach.notifyOnMissedCheckInTime || DEFAULT_MISSED_NOTIFY_TIME;
        const workoutTime = coach.notifyOnMissedWorkoutTime || DEFAULT_MISSED_NOTIFY_TIME;
        const checkInDeliverAfter = shouldDeliverMissedAlertNow(referenceDate, timezone, checkInTime)
            ? referenceDate
            : nextDeliveryUtc(timezone, checkInTime, referenceDate);
        const workoutDeliverAfter = shouldDeliverMissedAlertNow(referenceDate, timezone, workoutTime)
            ? referenceDate
            : nextDeliveryUtc(timezone, workoutTime, referenceDate);

        for (const item of items) {
            const resolved = item.status !== "open";
            if (item.category === "check_in_overdue" || item.category === "check_in_missed") {
                const weekNumber = item.weekNumber ?? getWeekNumber(referenceDate);
                const isoWeekYear = item.isoWeekYear ?? getIsoWeekYear(referenceDate);
                const entityId = coachMissedCheckInEntityId(item.clientId, weekNumber, isoWeekYear);
                if (!shouldQueueCoachMissedNotification({
                    conditionActive: item.status === "open",
                    alreadyQueuedOrSent: false,
                    dismissedOrResolved: resolved,
                    clientInactive: false,
                    clientPaused: false,
                })) {
                    continue;
                }
                const result = await queueCoachNotification({
                    coachId: coach.id,
                    prefKey: "notifyOnMissedCheckIn",
                    type: COACH_MISSED_CHECKIN_TYPE,
                    message: `${item.clientName} has not submitted their check-in.`,
                    entityType: "CHECK_IN",
                    entityId,
                    route: item.href || `/coach/client/${item.clientId}`,
                    deliverAfter: checkInDeliverAfter,
                });
                if (result === "queued") missedCheckIns += 1;
            }

            if (item.category === "missed_workout") {
                if (!item.dateKey || !item.workoutId) continue;
                const entityId = coachMissedWorkoutEntityId(item.clientId, item.dateKey, item.workoutId);
                if (!shouldQueueCoachMissedNotification({
                    conditionActive: item.status === "open",
                    alreadyQueuedOrSent: false,
                    dismissedOrResolved: resolved,
                    clientInactive: false,
                    clientPaused: false,
                })) {
                    continue;
                }
                const result = await queueCoachNotification({
                    coachId: coach.id,
                    prefKey: "notifyOnMissedWorkout",
                    type: COACH_MISSED_WORKOUT_TYPE,
                    message: `${item.clientName} missed ${item.workoutName ?? "a scheduled workout"}.`,
                    entityType: "WORKOUT",
                    entityId,
                    route: item.calendarHref ?? `/coach/calendar?clientId=${item.clientId}&date=${item.dateKey}`,
                    deliverAfter: workoutDeliverAfter,
                });
                if (result === "queued") missedWorkouts += 1;
            }
        }
    }

    return { missedCheckIns, missedWorkouts };
}

/** Daily cron: queue + deliver coach missed alerts and client missed check-in reminders. */
export async function processScheduledCoachAlerts(referenceDate = new Date()) {
    let clientMissedCheckIns = 0;

    const appLocal = getLocalTimeParts(referenceDate, APP_TIMEZONE);
    const appScanDateKey = shiftDateKey(appLocal.dateKey, -1);
    if (shouldDeliverMissedAlertNow(referenceDate, APP_TIMEZONE, DEFAULT_MISSED_NOTIFY_TIME)) {
        clientMissedCheckIns += await processMissedCheckInsForClients(appScanDateKey, APP_TIMEZONE);
    }

    const queued = await queueOpenCoachInboxAlerts(referenceDate);
    const pendingSent = await flushPendingCoachNotifications(referenceDate);

    return {
        missedCheckIns: queued.missedCheckIns,
        missedWorkouts: queued.missedWorkouts,
        clientMissedCheckIns,
        pendingSent,
        processedAt: referenceDate.toISOString(),
    };
}

/** @deprecated Use processScheduledCoachAlerts — kept for manual scripts. */
export async function processCoachMissedAlerts(referenceDate = new Date()) {
    return processScheduledCoachAlerts(referenceDate);
}
