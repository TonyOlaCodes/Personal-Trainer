import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

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

export type CoachNotificationPref =
    | "notifyOnWorkout"
    | "notifyOnCheckIn"
    | "notifyOnMetricUpdate"
    | "notifyOnMissedCheckIn"
    | "notifyOnMissedWorkout";
export type ClientNotificationPref =
    | "notifyOnCoachMessage"
    | "notifyOnPlanUpdate"
    | "notifyOnCheckInReview"
    | "notifyOnWorkoutFeedback";

let notificationsReady = false;
let notificationColumnsReady = false;

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
    ];

    for (const statement of columns) {
        await prisma.$executeRawUnsafe(statement);
    }

    notificationColumnsReady = true;
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

export async function notifyCoachOfClientWorkout(input: {
    coachId: string;
    clientName: string;
    workoutName: string;
    workoutLogId: string;
}) {
    if (!(await userWantsNotification(input.coachId, "notifyOnWorkout"))) return;

    await createNotification({
        userId: input.coachId,
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
    if (!(await userWantsNotification(input.coachId, "notifyOnCheckIn"))) return;

    await createNotification({
        userId: input.coachId,
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
    if (!(await userWantsNotification(input.coachId, "notifyOnMetricUpdate"))) return;

    await createNotification({
        userId: input.coachId,
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
    if (!(await userWantsNotification(input.coachId, "notifyOnMissedCheckIn"))) return;

    await createNotification({
        userId: input.coachId,
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
    if (!(await userWantsNotification(input.coachId, "notifyOnMissedWorkout"))) return;

    await createNotification({
        userId: input.coachId,
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
