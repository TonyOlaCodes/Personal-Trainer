import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import {
    COACH_NOTIFY_PREF_TO_TIME_FIELD,
    DEFAULT_MISSED_NOTIFY_TIME,
    type CoachNotificationPref,
    deliveryModeForPref,
    isValidTimezone,
    nextDeliveryUtc,
    normalizeNotifyTime,
    type CoachNotificationSchedule,
} from "@/lib/coachNotificationSchedule";

export interface NotificationItem {
    id: string;
    type: string;
    message: string;
    createdAt: Date;
    read: boolean;
    userId: string;
    entityType: string;
    entityId: string | null;
    route: string;
}

export type ClientNotificationPref =
    | "notifyOnCoachMessage"
    | "notifyOnPlanUpdate"
    | "notifyOnCheckInReview"
    | "notifyOnWorkoutFeedback";

let notificationsReady = false;
let notificationColumnsReady = false;
let pendingCoachNotificationsReady = false;

export async function ensureNotificationPreferenceColumns() {
    if (notificationColumnsReady) return;

    const columns = [
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notifyOnWorkout" BOOLEAN NOT NULL DEFAULT true`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notifyOnCheckIn" BOOLEAN NOT NULL DEFAULT true`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notifyOnMetricUpdate" BOOLEAN NOT NULL DEFAULT true`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notifyOnCoachMessage" BOOLEAN NOT NULL DEFAULT true`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notifyOnPlanUpdate" BOOLEAN NOT NULL DEFAULT true`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notifyOnCheckInReview" BOOLEAN NOT NULL DEFAULT true`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notifyOnWorkoutFeedback" BOOLEAN NOT NULL DEFAULT true`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notifyOnMissedCheckIn" BOOLEAN NOT NULL DEFAULT true`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notifyOnMissedWorkout" BOOLEAN NOT NULL DEFAULT true`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notificationTimezone" TEXT NOT NULL DEFAULT 'UTC'`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notifyOnWorkoutTime" TEXT`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notifyOnCheckInTime" TEXT`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notifyOnMetricUpdateTime" TEXT`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notifyOnMissedCheckInTime" TEXT DEFAULT '${DEFAULT_MISSED_NOTIFY_TIME}'`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notifyOnMissedWorkoutTime" TEXT DEFAULT '${DEFAULT_MISSED_NOTIFY_TIME}'`,
    ];

    for (const statement of columns) {
        await prisma.$executeRawUnsafe(statement);
    }

    notificationColumnsReady = true;
}

export async function ensurePendingCoachNotificationsTable() {
    if (pendingCoachNotificationsReady) return;

    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "pending_coach_notifications" (
            "id" TEXT PRIMARY KEY,
            "coachId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "prefKey" TEXT NOT NULL,
            "type" TEXT NOT NULL,
            "message" TEXT NOT NULL,
            "entityType" TEXT NOT NULL,
            "entityId" TEXT,
            "route" TEXT NOT NULL,
            "deliverAfter" TIMESTAMP(3) NOT NULL,
            "sentAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `;
    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "pending_coach_notifications_coach_deliver_idx"
        ON "pending_coach_notifications"("coachId", "deliverAfter")
        WHERE "sentAt" IS NULL
    `;

    pendingCoachNotificationsReady = true;
}

export async function ensureNotificationsTable() {
    if (notificationsReady) return;

    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "notifications" (
            "id" TEXT PRIMARY KEY,
            "type" TEXT NOT NULL,
            "message" TEXT NOT NULL,
            "read" BOOLEAN NOT NULL DEFAULT false,
            "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "entityType" TEXT NOT NULL,
            "entityId" TEXT,
            "route" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `;
    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "notifications_userId_read_idx"
        ON "notifications"("userId", "read")
    `;
    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "notifications_entityType_entityId_idx"
        ON "notifications"("entityType", "entityId")
    `;

    notificationsReady = true;
}

export async function getCoachNotificationSchedule(coachId: string): Promise<CoachNotificationSchedule> {
    await ensureNotificationPreferenceColumns();

    const user = await prisma.user.findUnique({
        where: { id: coachId },
        select: {
            notificationTimezone: true,
            notifyOnWorkoutTime: true,
            notifyOnCheckInTime: true,
            notifyOnMetricUpdateTime: true,
            notifyOnMissedCheckInTime: true,
            notifyOnMissedWorkoutTime: true,
        },
    });

    const tz = user?.notificationTimezone && isValidTimezone(user.notificationTimezone)
        ? user.notificationTimezone
        : "UTC";

    return {
        timezone: tz,
        notifyOnWorkoutTime: normalizeNotifyTime(user?.notifyOnWorkoutTime),
        notifyOnCheckInTime: normalizeNotifyTime(user?.notifyOnCheckInTime),
        notifyOnMetricUpdateTime: normalizeNotifyTime(user?.notifyOnMetricUpdateTime),
        notifyOnMissedCheckInTime: normalizeNotifyTime(user?.notifyOnMissedCheckInTime) ?? DEFAULT_MISSED_NOTIFY_TIME,
        notifyOnMissedWorkoutTime: normalizeNotifyTime(user?.notifyOnMissedWorkoutTime) ?? DEFAULT_MISSED_NOTIFY_TIME,
    };
}

export async function userWantsNotification(
    userId: string,
    pref: CoachNotificationPref | ClientNotificationPref
): Promise<boolean> {
    await ensureNotificationPreferenceColumns();

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            notifyOnWorkout: true,
            notifyOnCheckIn: true,
            notifyOnMetricUpdate: true,
            notifyOnMissedCheckIn: true,
            notifyOnMissedWorkout: true,
            notifyOnCoachMessage: true,
            notifyOnPlanUpdate: true,
            notifyOnCheckInReview: true,
            notifyOnWorkoutFeedback: true,
        },
    });

    if (!user) return false;
    return (user as Record<string, boolean | undefined>)[pref] ?? true;
}

export async function hasNotificationSince(input: {
    userId: string;
    type: string;
    entityId: string;
    since: Date;
}): Promise<boolean> {
    await ensureNotificationsTable();

    const rows = await prisma.$queryRaw<Array<{ exists: number }>>`
        SELECT 1 as exists
        FROM "notifications"
        WHERE "userId" = ${input.userId}
          AND "type" = ${input.type}
          AND "entityId" = ${input.entityId}
          AND "createdAt" >= ${input.since}
        LIMIT 1
    `;

    return rows.length > 0;
}

export async function createNotification(input: {
    userId: string;
    type: string;
    message: string;
    entityType: string;
    entityId?: string | null;
    route: string;
}) {
    await ensureNotificationsTable();

    await prisma.$executeRaw`
        INSERT INTO "notifications" ("id", "userId", "type", "message", "entityType", "entityId", "route")
        VALUES (${randomUUID()}, ${input.userId}, ${input.type}, ${input.message}, ${input.entityType}, ${input.entityId ?? null}, ${input.route})
    `;
}

async function enqueuePendingCoachNotification(input: {
    coachId: string;
    prefKey: CoachNotificationPref;
    type: string;
    message: string;
    entityType: string;
    entityId?: string | null;
    route: string;
    deliverAfter: Date;
}) {
    await ensurePendingCoachNotificationsTable();

    await prisma.$executeRaw`
        INSERT INTO "pending_coach_notifications"
            ("id", "coachId", "prefKey", "type", "message", "entityType", "entityId", "route", "deliverAfter")
        VALUES
            (${randomUUID()}, ${input.coachId}, ${input.prefKey}, ${input.type}, ${input.message},
             ${input.entityType}, ${input.entityId ?? null}, ${input.route}, ${input.deliverAfter})
    `;
}

export async function deliverCoachNotification(
    coachId: string,
    pref: CoachNotificationPref,
    payload: {
        type: string;
        message: string;
        entityType: string;
        entityId?: string | null;
        route: string;
    }
) {
    if (!(await userWantsNotification(coachId, pref))) return;

    const schedule = await getCoachNotificationSchedule(coachId);
    if (deliveryModeForPref(schedule, pref) === "immediate") {
        await createNotification({ userId: coachId, ...payload });
        return;
    }

    const timeField = COACH_NOTIFY_PREF_TO_TIME_FIELD[pref] as keyof CoachNotificationSchedule;
    const notifyTime = schedule[timeField];
    if (typeof notifyTime !== "string") return;

    const deliverAfter = nextDeliveryUtc(schedule.timezone, notifyTime);
    await enqueuePendingCoachNotification({
        coachId,
        prefKey: pref,
        deliverAfter,
        ...payload,
    });
}

export async function flushPendingCoachNotifications(referenceDate = new Date()) {
    await ensurePendingCoachNotificationsTable();
    await ensureNotificationsTable();

    const pending = await prisma.$queryRaw<Array<{
        id: string;
        coachId: string;
        type: string;
        message: string;
        entityType: string;
        entityId: string | null;
        route: string;
    }>>`
        SELECT "id", "coachId", "type", "message", "entityType", "entityId", "route"
        FROM "pending_coach_notifications"
        WHERE "sentAt" IS NULL
          AND "deliverAfter" <= ${referenceDate}
        ORDER BY "deliverAfter" ASC
        LIMIT 200
    `;

    let sent = 0;
    for (const row of pending) {
        await createNotification({
            userId: row.coachId,
            type: row.type,
            message: row.message,
            entityType: row.entityType,
            entityId: row.entityId,
            route: row.route,
        });
        await prisma.$executeRaw`
            UPDATE "pending_coach_notifications"
            SET "sentAt" = ${referenceDate}
            WHERE "id" = ${row.id}
        `;
        sent++;
    }

    return sent;
}

export async function notifyCoachOfClientWorkout(input: {
    coachId: string;
    clientName: string;
    workoutName: string;
    workoutLogId: string;
}) {
    await deliverCoachNotification(input.coachId, "notifyOnWorkout", {
        type: "CLIENT_WORKOUT",
        message: `${input.clientName} completed ${input.workoutName}`,
        entityType: "WORKOUT_LOG",
        entityId: input.workoutLogId,
        route: `/plans/log/view/${input.workoutLogId}`,
    });
}

export async function notifyCoachOfClientCheckIn(input: {
    coachId: string;
    clientName: string;
    checkInId: string;
}) {
    await deliverCoachNotification(input.coachId, "notifyOnCheckIn", {
        type: "CLIENT_CHECKIN",
        message: `${input.clientName} submitted a check-in`,
        entityType: "CHECK_IN",
        entityId: input.checkInId,
        route: `/checkins?highlight=${input.checkInId}`,
    });
}

export async function notifyCoachOfClientBodyweight(input: {
    coachId: string;
    clientId: string;
    clientName: string;
    weightKg: number;
}) {
    await deliverCoachNotification(input.coachId, "notifyOnMetricUpdate", {
        type: "CLIENT_BODYWEIGHT",
        message: `${input.clientName} logged ${input.weightKg.toFixed(1)} kg`,
        entityType: "BODYWEIGHT",
        entityId: null,
        route: `/coach/client/${input.clientId}`,
    });
}

export async function notifyCoachOfMissedCheckIn(input: {
    coachId: string;
    clientId: string;
    clientName: string;
    weekNumber: number;
}) {
    await deliverCoachNotification(input.coachId, "notifyOnMissedCheckIn", {
        type: "CLIENT_MISSED_CHECKIN",
        message: `${input.clientName} has not completed their check-in`,
        entityType: "USER",
        entityId: `${input.clientId}:${input.weekNumber}`,
        route: `/coach/client/${input.clientId}`,
    });
}

export async function notifyCoachOfMissedWorkout(input: {
    coachId: string;
    clientId: string;
    clientName: string;
    workoutName: string;
    dateKey: string;
    workoutId: string;
}) {
    await deliverCoachNotification(input.coachId, "notifyOnMissedWorkout", {
        type: "CLIENT_MISSED_WORKOUT",
        message: `${input.clientName} missed ${input.workoutName}`,
        entityType: "USER",
        entityId: `${input.clientId}:${input.dateKey}:${input.workoutId}`,
        route: `/coach/client/${input.clientId}`,
    });
}

export async function getNotifications(userId: string, limit = 20) {
    await ensureNotificationsTable();

    return prisma.$queryRaw<NotificationItem[]>`
        SELECT "id", "type", "message", "createdAt", "read", "userId", "entityType", "entityId", "route"
        FROM "notifications"
        WHERE "userId" = ${userId}
        ORDER BY "createdAt" DESC
        LIMIT ${limit}
    `;
}

export async function markNotificationRead(userId: string, notificationId: string) {
    await ensureNotificationsTable();

    await prisma.$executeRaw`
        UPDATE "notifications"
        SET "read" = true
        WHERE "id" = ${notificationId} AND "userId" = ${userId}
    `;
}

export async function markAllNotificationsRead(userId: string) {
    await ensureNotificationsTable();

    await prisma.$executeRaw`
        UPDATE "notifications"
        SET "read" = true
        WHERE "userId" = ${userId}
    `;
}

// Re-export coach pref type for callers
export type { CoachNotificationPref } from "@/lib/coachNotificationSchedule";
