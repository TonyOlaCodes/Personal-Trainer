import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { NOTIFICATION_TYPES } from "@/lib/notificationTypes";
import { ensureOnboardingProfileColumns } from "@/lib/onboardingProfile";
import { isCoachRole } from "@/lib/roles";

export type CoachCodeRequestStatus = "PENDING" | "DISPATCHED" | "CLAIMED" | "RESOLVED" | "DISMISSED";
export type CoachCodeRequestDispatchStatus = "PENDING" | "MESSAGED" | "IGNORED" | "CLAIMED";

let coachCodeRequestTablesReady = false;

export async function ensureCoachCodeRequestTables() {
    if (coachCodeRequestTablesReady) return;

    await ensureOnboardingProfileColumns();

    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "coach_code_requests" (
            "id" TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
            "status" TEXT NOT NULL DEFAULT 'PENDING',
            "claimedById" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `;

    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "coach_code_request_dispatches" (
            "id" TEXT PRIMARY KEY,
            "requestId" TEXT NOT NULL REFERENCES "coach_code_requests"("id") ON DELETE CASCADE,
            "coachId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "status" TEXT NOT NULL DEFAULT 'PENDING',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE("requestId", "coachId")
        )
    `;

    coachCodeRequestTablesReady = true;
}

function createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export async function getCoachCodeRequestStatus(userId: string) {
    await ensureCoachCodeRequestTables();

    const rows = await prisma.$queryRaw<
        Array<{ id: string; status: CoachCodeRequestStatus; createdAt: Date; claimedById: string | null }>
    >`
        SELECT id, status, "createdAt", "claimedById"
        FROM "coach_code_requests"
        WHERE "userId" = ${userId}
        LIMIT 1
    `;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { coachCodeRequestSentAt: true, role: true },
    });

    return {
        eligible: user?.role === "FREE",
        request: rows[0]
            ? {
                id: rows[0].id,
                status: rows[0].status,
                createdAt: rows[0].createdAt.toISOString(),
                claimedById: rows[0].claimedById,
            }
            : null,
        requestSentAt: user?.coachCodeRequestSentAt?.toISOString() ?? null,
    };
}

export async function createCoachCodeRequest(userId: string) {
    await ensureCoachCodeRequestTables();

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, name: true, email: true, coachCodeRequestSentAt: true },
    });

    if (!user || user.role !== "FREE") {
        throw new Error("Only free accounts can request a coach access code");
    }

    const existing = await prisma.$queryRaw<Array<{ id: string; status: CoachCodeRequestStatus }>>`
        SELECT id, status
        FROM "coach_code_requests"
        WHERE "userId" = ${userId}
        LIMIT 1
    `;

    if (existing[0] && !["DISMISSED", "RESOLVED"].includes(existing[0].status)) {
        return { alreadySent: true as const, requestId: existing[0].id };
    }

    const requestId = createId("ccr");
    const now = new Date();
    const senderLabel = user.name?.trim() || user.email || "A new user";

    const admins = await prisma.user.findMany({
        where: { role: "SUPER_ADMIN", isDeleted: false, isDeactivated: false },
        select: { id: true },
    });

    if (admins.length === 0) {
        throw new Error("No administrators are available right now. Please try again later.");
    }

    await prisma.$transaction(async (tx) => {
        if (existing[0]) {
            await tx.$executeRaw`
                UPDATE "coach_code_requests"
                SET "status" = 'PENDING',
                    "claimedById" = NULL,
                    "updatedAt" = ${now}
                WHERE id = ${existing[0].id}
            `;
            await tx.$executeRaw`
                DELETE FROM "coach_code_request_dispatches"
                WHERE "requestId" = ${existing[0].id}
            `;
        } else {
            await tx.$executeRaw`
                INSERT INTO "coach_code_requests" ("id", "userId", "status", "createdAt", "updatedAt")
                VALUES (${requestId}, ${userId}, 'PENDING', ${now}, ${now})
            `;
        }

        await tx.$executeRaw`
            UPDATE "users"
            SET "coachCodeRequestSentAt" = ${now}
            WHERE id = ${userId}
        `;
    });

    const activeRequestId = existing[0]?.id ?? requestId;

    await Promise.all(
        admins.map((admin) =>
            createNotification({
                userId: admin.id,
                type: NOTIFICATION_TYPES.ACCESS_REQUEST,
                message: `${senderLabel} requested a coach access code`,
                entityType: "coach_code_request",
                entityId: activeRequestId,
                route: "/admin?tab=code-requests",
            })
        )
    );

    return { sent: true as const, requestId: activeRequestId };
}

export async function listPendingCoachCodeRequestsForAdmin() {
    await ensureCoachCodeRequestTables();

    const rows = await prisma.$queryRaw<
        Array<{
            id: string;
            status: CoachCodeRequestStatus;
            createdAt: Date;
            userId: string;
            userName: string | null;
            userEmail: string;
            userAvatarUrl: string | null;
        }>
    >`
        SELECT
            r.id,
            r.status,
            r."createdAt",
            u.id as "userId",
            u.name as "userName",
            u.email as "userEmail",
            u."avatarUrl" as "userAvatarUrl"
        FROM "coach_code_requests" r
        JOIN "users" u ON u.id = r."userId"
        WHERE r.status IN ('PENDING', 'DISPATCHED', 'CLAIMED')
          AND u."isDeleted" = false
          AND u."isDeactivated" = false
        ORDER BY r."createdAt" DESC
    `;

    return rows.map((row) => ({
        id: row.id,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        user: {
            id: row.userId,
            name: row.userName,
            email: row.userEmail,
            avatarUrl: row.userAvatarUrl,
        },
    }));
}

export async function adminHandleCoachCodeRequestSelf(adminId: string, requestId: string) {
    await ensureCoachCodeRequestTables();

    const rows = await prisma.$queryRaw<Array<{ id: string; userId: string; status: CoachCodeRequestStatus }>>`
        SELECT id, "userId", status
        FROM "coach_code_requests"
        WHERE id = ${requestId}
        LIMIT 1
    `;
    const request = rows[0];
    if (!request || !["PENDING", "DISPATCHED"].includes(request.status)) {
        throw new Error("Request is no longer available");
    }

    const now = new Date();
    await prisma.$executeRaw`
        UPDATE "coach_code_requests"
        SET "status" = 'CLAIMED',
            "claimedById" = ${adminId},
            "updatedAt" = ${now}
        WHERE id = ${requestId}
    `;

    await createNotification({
        userId: request.userId,
        type: NOTIFICATION_TYPES.ACCESS_REQUEST,
        message: "An admin is reviewing your coach access code request",
        entityType: "user",
        entityId: adminId,
        route: `/chat?with=${adminId}`,
    });

    return { ok: true as const, chatRoute: `/chat?with=${request.userId}` };
}

export async function adminDispatchCoachCodeRequest(adminId: string, requestId: string, coachIds: string[]) {
    await ensureCoachCodeRequestTables();

    if (coachIds.length === 0) {
        throw new Error("Select at least one coach");
    }

    const rows = await prisma.$queryRaw<Array<{ id: string; userId: string; status: CoachCodeRequestStatus }>>`
        SELECT id, "userId", status
        FROM "coach_code_requests"
        WHERE id = ${requestId}
        LIMIT 1
    `;
    const request = rows[0];
    if (!request || request.status !== "PENDING") {
        throw new Error("Request is no longer available for dispatch");
    }

    const coaches = await prisma.user.findMany({
        where: {
            id: { in: coachIds },
            role: { in: ["COACH", "SUPER_ADMIN"] },
            isDeleted: false,
            isDeactivated: false,
        },
        select: { id: true, name: true },
    });

    if (coaches.length === 0) {
        throw new Error("No valid coaches selected");
    }

    const user = await prisma.user.findUnique({
        where: { id: request.userId },
        select: { name: true, email: true },
    });
    const senderLabel = user?.name?.trim() || user?.email || "A new user";
    const now = new Date();

    await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
            UPDATE "coach_code_requests"
            SET "status" = 'DISPATCHED', "updatedAt" = ${now}
            WHERE id = ${requestId}
        `;

        for (const coach of coaches) {
            const dispatchId = createId("ccd");
            await tx.$executeRaw`
                INSERT INTO "coach_code_request_dispatches" ("id", "requestId", "coachId", "status", "createdAt")
                VALUES (${dispatchId}, ${requestId}, ${coach.id}, 'PENDING', ${now})
                ON CONFLICT ("requestId", "coachId") DO NOTHING
            `;
        }
    });

    await Promise.all(
        coaches.map((coach) =>
            createNotification({
                userId: coach.id,
                type: NOTIFICATION_TYPES.ACCESS_REQUEST,
                message: `${senderLabel} requested a coach access code`,
                entityType: "coach_code_request",
                entityId: requestId,
                route: "/coach?panel=code-requests",
            })
        )
    );

    return { ok: true as const, coachCount: coaches.length };
}

export async function listCoachCodeRequestsForCoach(coachId: string) {
    await ensureCoachCodeRequestTables();

    const rows = await prisma.$queryRaw<
        Array<{
            dispatchId: string;
            dispatchStatus: CoachCodeRequestDispatchStatus;
            requestId: string;
            requestStatus: CoachCodeRequestStatus;
            createdAt: Date;
            userId: string;
            userName: string | null;
            userEmail: string;
            userAvatarUrl: string | null;
        }>
    >`
        SELECT
            d.id as "dispatchId",
            d.status as "dispatchStatus",
            r.id as "requestId",
            r.status as "requestStatus",
            r."createdAt",
            u.id as "userId",
            u.name as "userName",
            u.email as "userEmail",
            u."avatarUrl" as "userAvatarUrl"
        FROM "coach_code_request_dispatches" d
        JOIN "coach_code_requests" r ON r.id = d."requestId"
        JOIN "users" u ON u.id = r."userId"
        WHERE d."coachId" = ${coachId}
          AND d.status = 'PENDING'
          AND r.status = 'DISPATCHED'
          AND u."isDeleted" = false
          AND u."isDeactivated" = false
        ORDER BY r."createdAt" DESC
    `;

    return rows.map((row) => ({
        dispatchId: row.dispatchId,
        dispatchStatus: row.dispatchStatus,
        requestId: row.requestId,
        requestStatus: row.requestStatus,
        createdAt: row.createdAt.toISOString(),
        user: {
            id: row.userId,
            name: row.userName,
            email: row.userEmail,
            avatarUrl: row.userAvatarUrl,
        },
    }));
}

export async function coachIgnoreCoachCodeRequest(coachId: string, dispatchId: string) {
    await ensureCoachCodeRequestTables();

    await prisma.$executeRaw`
        UPDATE "coach_code_request_dispatches"
        SET "status" = 'IGNORED'
        WHERE id = ${dispatchId}
          AND "coachId" = ${coachId}
          AND status = 'PENDING'
    `;

    return { ok: true as const };
}

export async function tryClaimCoachCodeRequestOnEngagement(coachId: string, freeUserId: string) {
    await ensureCoachCodeRequestTables();

    const coach = await prisma.user.findUnique({
        where: { id: coachId },
        select: { role: true },
    });
    if (!coach || !isCoachRole(coach.role as never)) return null;

    const rows = await prisma.$queryRaw<
        Array<{ requestId: string; dispatchId: string; status: CoachCodeRequestStatus }>
    >`
        SELECT r.id as "requestId", d.id as "dispatchId", r.status
        FROM "coach_code_requests" r
        JOIN "coach_code_request_dispatches" d ON d."requestId" = r.id
        WHERE r."userId" = ${freeUserId}
          AND d."coachId" = ${coachId}
          AND r.status = 'DISPATCHED'
          AND d.status IN ('PENDING', 'MESSAGED')
        LIMIT 1
    `;

    const match = rows[0];
    if (!match) return null;

    const now = new Date();
    const claimResult = await prisma.$executeRaw`
        UPDATE "coach_code_requests"
        SET "status" = 'CLAIMED',
            "claimedById" = ${coachId},
            "updatedAt" = ${now}
        WHERE id = ${match.requestId}
          AND status = 'DISPATCHED'
    `;

    if (!claimResult) return null;

    await prisma.$executeRaw`
        UPDATE "coach_code_request_dispatches"
        SET "status" = 'CLAIMED'
        WHERE "requestId" = ${match.requestId}
          AND "coachId" = ${coachId}
    `;

    await prisma.$executeRaw`
        UPDATE "coach_code_request_dispatches"
        SET "status" = 'IGNORED'
        WHERE "requestId" = ${match.requestId}
          AND "coachId" <> ${coachId}
          AND status IN ('PENDING', 'MESSAGED')
    `;

    await createNotification({
        userId: freeUserId,
        type: NOTIFICATION_TYPES.ACCESS_REQUEST,
        message: "A coach is reviewing your access code request",
        entityType: "user",
        entityId: coachId,
        route: `/chat?with=${coachId}`,
    });

    return coachId;
}

export async function markCoachCodeDispatchMessaged(coachId: string, freeUserId: string) {
    await ensureCoachCodeRequestTables();

    await prisma.$executeRaw`
        UPDATE "coach_code_request_dispatches" d
        SET "status" = 'MESSAGED'
        FROM "coach_code_requests" r
        WHERE d."requestId" = r.id
          AND r."userId" = ${freeUserId}
          AND d."coachId" = ${coachId}
          AND d.status = 'PENDING'
          AND r.status = 'DISPATCHED'
    `;
}
