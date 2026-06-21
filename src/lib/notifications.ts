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

let notificationsReady = false;

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
    const coach = await prisma.user.findUnique({
        where: { id: input.coachId },
        select: { notifyOnWorkout: true },
    });
    if (!coach?.notifyOnWorkout) return;

    await createNotification({
        userId: input.coachId,
        type: "CLIENT_WORKOUT",
        message: `${input.clientName} completed ${input.workoutName}`,
        entityType: "WORKOUT_LOG",
        entityId: input.workoutLogId,
        route: `/plans/log/view/${input.workoutLogId}`,
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
