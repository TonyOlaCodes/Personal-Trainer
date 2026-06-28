import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import {
    DEFAULT_MISSED_NOTIFY_TIME,
    type CoachNotificationPref,
    isValidTimezone,
    normalizeNotifyTime,
    type CoachNotificationSchedule,
} from "@/lib/coachNotificationSchedule";
import { APP_TIMEZONE } from "@/lib/appTimezone";
import { NOTIFICATION_TYPES, QUICK_REPLY_TEMPLATES } from "@/lib/notificationTypes";

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
    | "notifyOnWorkoutFeedback"
    | "notifyOnMissedCheckIn";

export type CoachClientMessagePref = "notifyOnClientMessage";

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
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notifyOnClientMessage" BOOLEAN NOT NULL DEFAULT true`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notificationTimezone" TEXT NOT NULL DEFAULT '${APP_TIMEZONE}'`,
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

    const timezone =
        user?.notificationTimezone && isValidTimezone(user.notificationTimezone)
            ? user.notificationTimezone
            : APP_TIMEZONE;

    return {
        timezone,
        notifyOnWorkoutTime: normalizeNotifyTime(user?.notifyOnWorkoutTime),
        notifyOnCheckInTime: normalizeNotifyTime(user?.notifyOnCheckInTime),
        notifyOnMetricUpdateTime: normalizeNotifyTime(user?.notifyOnMetricUpdateTime),
        notifyOnMissedCheckInTime: normalizeNotifyTime(user?.notifyOnMissedCheckInTime) ?? DEFAULT_MISSED_NOTIFY_TIME,
        notifyOnMissedWorkoutTime: normalizeNotifyTime(user?.notifyOnMissedWorkoutTime) ?? DEFAULT_MISSED_NOTIFY_TIME,
    };
}

export async function getCoachNotifyOnClientMessage(userId: string): Promise<boolean> {
    await ensureNotificationPreferenceColumns();
    const rows = await prisma.$queryRaw<Array<{ value: boolean }>>`
        SELECT COALESCE("notifyOnClientMessage", true) as value
        FROM "users"
        WHERE id = ${userId}
        LIMIT 1
    `;
    return rows[0]?.value ?? true;
}

export async function setCoachNotifyOnClientMessage(userId: string, enabled: boolean): Promise<void> {
    await ensureNotificationPreferenceColumns();
    await prisma.$executeRaw`
        UPDATE "users"
        SET "notifyOnClientMessage" = ${enabled}
        WHERE id = ${userId}
    `;
}

export async function userWantsNotification(
    userId: string,
    pref: CoachNotificationPref | ClientNotificationPref | CoachClientMessagePref
): Promise<boolean> {
    await ensureNotificationPreferenceColumns();

    if (pref === "notifyOnClientMessage") {
        return getCoachNotifyOnClientMessage(userId);
    }

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

/** Coach check-in request — one unread alert per coach; skips separate chat notification. */
export async function notifyClientOfCheckInRequest(input: {
    clientUserId: string;
    coachId: string;
    message?: string;
}) {
    if (!(await userWantsNotification(input.clientUserId, "notifyOnCoachMessage"))) return;

    await ensureNotificationsTable();

    const message = input.message ?? "Your coach requested a check-in";
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "notifications"
        WHERE "userId" = ${input.clientUserId}
          AND "type" = 'MISSED_CHECKIN'
          AND "entityType" = 'CHECKIN'
          AND "entityId" = ${input.coachId}
          AND "read" = false
        ORDER BY "createdAt" DESC
        LIMIT 1
    `;

    if (existing[0]) {
        await prisma.$executeRaw`
            UPDATE "notifications"
            SET "message" = ${message},
                "route" = '/checkins',
                "createdAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${existing[0].id}
        `;
        return;
    }

    await createNotification({
        userId: input.clientUserId,
        type: "MISSED_CHECKIN",
        message,
        entityType: "CHECKIN",
        entityId: input.coachId,
        route: "/checkins",
    });
}

/** Coach missed-workout nudge — one unread alert per coach; skips separate chat notification. */
export async function notifyClientOfMissedWorkout(input: {
    clientUserId: string;
    coachId: string;
    message?: string;
    workoutId?: string | null;
}) {
    if (!(await userWantsNotification(input.clientUserId, "notifyOnCoachMessage"))) return;

    await ensureNotificationsTable();

    const message =
        input.message
        ?? QUICK_REPLY_TEMPLATES[NOTIFICATION_TYPES.CLIENT_MISSED_WORKOUT];
    const route = `/chat?with=${input.coachId}`;

    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "notifications"
        WHERE "userId" = ${input.clientUserId}
          AND "type" = 'MISSED_WORKOUT'
          AND "entityId" = ${input.coachId}
          AND "read" = false
        ORDER BY "createdAt" DESC
        LIMIT 1
    `;

    if (existing[0]) {
        await prisma.$executeRaw`
            UPDATE "notifications"
            SET "message" = ${message},
                "route" = ${route},
                "createdAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${existing[0].id}
        `;
        return;
    }

    await createNotification({
        userId: input.clientUserId,
        type: NOTIFICATION_TYPES.MISSED_WORKOUT,
        message,
        entityType: "WORKOUT",
        entityId: input.workoutId ?? input.coachId,
        route,
    });
}

/** Coach assigned a plan — one unread alert per plan; never a separate chat DM alert. */
export async function notifyClientOfPlanAssigned(input: {
    clientUserId: string;
    coachId: string;
    coachName: string;
    planId: string;
    planName?: string | null;
}) {
    if (!(await userWantsNotification(input.clientUserId, "notifyOnPlanUpdate"))) return;

    await ensureNotificationsTable();

    const coachLabel = input.coachName.trim() || "Your coach";
    const route = `/plans?highlight=${input.planId}`;

    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "notifications"
        WHERE "userId" = ${input.clientUserId}
          AND "type" = ${NOTIFICATION_TYPES.PLAN_ASSIGNED}
          AND "entityType" = 'PLAN'
          AND "entityId" = ${input.planId}
          AND "read" = false
        ORDER BY "createdAt" DESC
        LIMIT 1
    `;

    if (existing[0]) {
        await prisma.$executeRaw`
            UPDATE "notifications"
            SET "message" = ${coachLabel},
                "route" = ${route},
                "createdAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${existing[0].id}
        `;
        return;
    }

    await createNotification({
        userId: input.clientUserId,
        type: NOTIFICATION_TYPES.PLAN_ASSIGNED,
        message: coachLabel,
        entityType: "PLAN",
        entityId: input.planId,
        route,
    });
}

/** One unread coach-message alert per coach; updates timestamp if more messages arrive. */
export async function notifyClientOfCoachMessage(input: {
    clientUserId: string;
    coachId: string;
    coachName: string;
    route: string;
}) {
    if (!(await userWantsNotification(input.clientUserId, "notifyOnCoachMessage"))) return;

    await ensureNotificationsTable();

    const message = input.coachName.trim() || "Your coach";
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "notifications"
        WHERE "userId" = ${input.clientUserId}
          AND "type" = 'NEW_CHAT_MESSAGE'
          AND "entityId" = ${input.coachId}
          AND "read" = false
        ORDER BY "createdAt" DESC
        LIMIT 1
    `;

    if (existing[0]) {
        await prisma.$executeRaw`
            UPDATE "notifications"
            SET "message" = ${message},
                "route" = ${input.route},
                "createdAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${existing[0].id}
        `;
        return;
    }

    await createNotification({
        userId: input.clientUserId,
        type: "NEW_CHAT_MESSAGE",
        message,
        entityType: "CHAT_MESSAGE",
        entityId: input.coachId,
        route: input.route,
    });
}

/** Coach broadcast — separate from regular DMs so clients see it as higher priority. */
export async function notifyClientOfCoachBroadcast(input: {
    clientUserId: string;
    coachId: string;
    coachName: string;
    senderRole?: string;
    route: string;
}) {
    if (!(await userWantsNotification(input.clientUserId, "notifyOnCoachMessage"))) return;

    await ensureNotificationsTable();

    const message = input.senderRole === "SUPER_ADMIN"
        ? "Admin"
        : (input.coachName.trim() || "Your coach");
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "notifications"
        WHERE "userId" = ${input.clientUserId}
          AND "type" = 'COACH_BROADCAST'
          AND "entityId" = ${input.coachId}
          AND "read" = false
        ORDER BY "createdAt" DESC
        LIMIT 1
    `;

    if (existing[0]) {
        await prisma.$executeRaw`
            UPDATE "notifications"
            SET "message" = ${message},
                "route" = ${input.route},
                "createdAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${existing[0].id}
        `;
        return;
    }

    await createNotification({
        userId: input.clientUserId,
        type: "COACH_BROADCAST",
        message,
        entityType: "CHAT_MESSAGE",
        entityId: input.coachId,
        route: input.route,
    });
}

/** One unread client-message alert per client; updates timestamp if more messages arrive. */
export async function notifyCoachOfClientMessage(input: {
    coachId: string;
    clientUserId: string;
    clientName: string;
    route: string;
}) {
    if (!(await userWantsNotification(input.coachId, "notifyOnClientMessage"))) return;

    await ensureNotificationsTable();

    const message = input.clientName.trim() || "Your client";
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "notifications"
        WHERE "userId" = ${input.coachId}
          AND "type" = 'NEW_CLIENT_CHAT_MESSAGE'
          AND "entityId" = ${input.clientUserId}
          AND "read" = false
        ORDER BY "createdAt" DESC
        LIMIT 1
    `;

    if (existing[0]) {
        await prisma.$executeRaw`
            UPDATE "notifications"
            SET "message" = ${message},
                "route" = ${input.route},
                "createdAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${existing[0].id}
        `;
        return;
    }

    await createNotification({
        userId: input.coachId,
        type: "NEW_CLIENT_CHAT_MESSAGE",
        message,
        entityType: "CHAT_MESSAGE",
        entityId: input.clientUserId,
        route: input.route,
    });
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
    await createNotification({ userId: coachId, ...payload });
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

export async function deleteNotification(userId: string, notificationId: string) {
    await ensureNotificationsTable();

    await prisma.$executeRaw`
        DELETE FROM "notifications"
        WHERE "id" = ${notificationId} AND "userId" = ${userId}
    `;
}

// Re-export coach pref type for callers
export type { CoachNotificationPref } from "@/lib/coachNotificationSchedule";
