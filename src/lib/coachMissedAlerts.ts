import { prisma } from "@/lib/prisma";
import { APP_TIMEZONE } from "@/lib/appTimezone";
import { getCheckInDueState, getUserCheckInSchedule } from "@/lib/checkInSchedule";
import {
    DEFAULT_MISSED_NOTIFY_TIME,
    getLocalTimeParts,
    shiftDateKey,
    shouldDeliverMissedAlertNow,
} from "@/lib/coachNotificationSchedule";
import {
    flushPendingCoachNotifications,
    createNotification,
    hasNotificationSince,
    userWantsNotification,
} from "@/lib/notifications";
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
    const weekNumber = getWeekNumber(new Date(`${dateKey}T12:00:00.000Z`));

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
        if (!(await userWantsNotification(client.id, "notifyOnMissedCheckIn"))) continue;

        const schedule = await getUserCheckInSchedule(client.id);
        const [sy, sm, sd] = dateKey.split("-").map(Number);
        const scanDate = new Date(Date.UTC(sy, sm - 1, sd, 12, 0, 0, 0));
        const dueState = getCheckInDueState(schedule, scanDate);
        if (!dueState.isConfigured) continue;
        if (!dueState.isDueToday && !dueState.isOverdue) continue;

        const dedupeEntityId = `${client.id}:${weekNumber}`;
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
            message: "You haven't completed your check-in this week — tap to submit it now.",
            entityType: "CHECK_IN",
            entityId: dedupeEntityId,
            route: "/checkins",
        });
        sent++;
    }

    return sent;
}

/** Daily cron: deliver queued coach alerts and client missed check-in reminders. */
export async function processScheduledCoachAlerts(referenceDate = new Date()) {
    let clientMissedCheckIns = 0;

    const appLocal = getLocalTimeParts(referenceDate, APP_TIMEZONE);
    const appScanDateKey = shiftDateKey(appLocal.dateKey, -1);
    if (shouldDeliverMissedAlertNow(referenceDate, APP_TIMEZONE, DEFAULT_MISSED_NOTIFY_TIME)) {
        clientMissedCheckIns += await processMissedCheckInsForClients(appScanDateKey, APP_TIMEZONE);
    }

    const pendingSent = await flushPendingCoachNotifications(referenceDate);

    return {
        missedCheckIns: 0,
        missedWorkouts: 0,
        clientMissedCheckIns,
        pendingSent,
        processedAt: referenceDate.toISOString(),
    };
}

/** @deprecated Use processScheduledCoachAlerts — kept for manual scripts. */
export async function processCoachMissedAlerts(referenceDate = new Date()) {
    return processScheduledCoachAlerts(referenceDate);
}
