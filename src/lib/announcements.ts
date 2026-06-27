import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { NOTIFICATION_TYPES } from "@/lib/notificationTypes";

export const ANNOUNCEMENT_AUDIENCES = [
    "EVERYONE",
    "FREE",
    "PREMIUM",
    "COACH",
    "ADMIN",
    "SELECTED",
] as const;

export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export interface AnnouncementRecord {
    id: string;
    title: string;
    body: string;
    targetAudience: AnnouncementAudience;
    targetUserIds: string[];
    scheduledAt: Date | null;
    expiresAt: Date | null;
    dashboardBannerDays: number;
    createdById: string;
    notificationsSentAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface AnnouncementWithAdmin extends AnnouncementRecord {
    adminName: string;
}

let announcementsReady = false;

export async function ensureAnnouncementsTable() {
    if (announcementsReady) return;

    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "announcements" (
            "id" TEXT PRIMARY KEY,
            "title" TEXT NOT NULL,
            "body" TEXT NOT NULL,
            "targetAudience" TEXT NOT NULL,
            "targetUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
            "scheduledAt" TIMESTAMP(3),
            "expiresAt" TIMESTAMP(3),
            "dashboardBannerDays" INTEGER NOT NULL DEFAULT 7,
            "createdById" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "notificationsSentAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `;

    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "announcement_dismissals" (
            "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "announcementId" TEXT NOT NULL REFERENCES "announcements"("id") ON DELETE CASCADE,
            "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY ("userId", "announcementId")
        )
    `;

    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "announcements_scheduledAt_idx" ON "announcements"("scheduledAt")
    `;
    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "announcements_expiresAt_idx" ON "announcements"("expiresAt")
    `;

    announcementsReady = true;
}

function mapRow(row: Record<string, unknown>): AnnouncementRecord {
    return {
        id: String(row.id),
        title: String(row.title),
        body: String(row.body),
        targetAudience: String(row.targetAudience) as AnnouncementAudience,
        targetUserIds: Array.isArray(row.targetUserIds) ? row.targetUserIds.map(String) : [],
        scheduledAt: row.scheduledAt ? new Date(String(row.scheduledAt)) : null,
        expiresAt: row.expiresAt ? new Date(String(row.expiresAt)) : null,
        dashboardBannerDays: Number(row.dashboardBannerDays ?? 7),
        createdById: String(row.createdById),
        notificationsSentAt: row.notificationsSentAt ? new Date(String(row.notificationsSentAt)) : null,
        createdAt: new Date(String(row.createdAt)),
        updatedAt: new Date(String(row.updatedAt)),
    };
}

export function isAnnouncementLive(announcement: Pick<AnnouncementRecord, "scheduledAt" | "expiresAt">, now = new Date()) {
    if (announcement.scheduledAt && now < announcement.scheduledAt) return false;
    if (announcement.expiresAt && now >= announcement.expiresAt) return false;
    return true;
}

export function userMatchesAudience(
    user: { id: string; role: string },
    announcement: Pick<AnnouncementRecord, "targetAudience" | "targetUserIds">
) {
    switch (announcement.targetAudience) {
        case "EVERYONE":
            return true;
        case "FREE":
            return user.role === "FREE";
        case "PREMIUM":
            return user.role === "PREMIUM";
        case "COACH":
            return user.role === "COACH";
        case "ADMIN":
            return user.role === "SUPER_ADMIN";
        case "SELECTED":
            return announcement.targetUserIds.includes(user.id);
        default:
            return false;
    }
}

async function getTargetUserIds(announcement: Pick<AnnouncementRecord, "targetAudience" | "targetUserIds">) {
    const baseWhere = {
        isDeleted: false,
        isDeactivated: false,
    };

    switch (announcement.targetAudience) {
        case "EVERYONE":
            return (await prisma.user.findMany({ where: baseWhere, select: { id: true } })).map((u) => u.id);
        case "FREE":
        case "PREMIUM":
        case "COACH":
        case "ADMIN": {
            const role = announcement.targetAudience === "ADMIN" ? "SUPER_ADMIN" : announcement.targetAudience;
            return (await prisma.user.findMany({
                where: { ...baseWhere, role },
                select: { id: true },
            })).map((u) => u.id);
        }
        case "SELECTED":
            return announcement.targetUserIds;
        default:
            return [];
    }
}

export async function listAnnouncementsForAdmin() {
    await ensureAnnouncementsTable();

    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT
            a.*,
            u."name" AS "adminName",
            u."email" AS "adminEmail"
        FROM "announcements" a
        JOIN "users" u ON u."id" = a."createdById"
        ORDER BY a."createdAt" DESC
    `;

    return rows.map((row) => ({
        ...mapRow(row),
        adminName: String(row.adminName ?? row.adminEmail ?? "Admin"),
    }));
}

export async function getAnnouncementById(id: string) {
    await ensureAnnouncementsTable();

    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT
            a.*,
            u."name" AS "adminName",
            u."email" AS "adminEmail"
        FROM "announcements" a
        JOIN "users" u ON u."id" = a."createdById"
        WHERE a."id" = ${id}
        LIMIT 1
    `;

    if (!rows[0]) return null;

    return {
        ...mapRow(rows[0]),
        adminName: String(rows[0].adminName ?? rows[0].adminEmail ?? "Admin"),
    };
}

export async function createAnnouncement(input: {
    title: string;
    body: string;
    targetAudience: AnnouncementAudience;
    targetUserIds?: string[];
    scheduledAt?: Date | null;
    expiresAt?: Date | null;
    dashboardBannerDays?: number;
    createdById: string;
}) {
    await ensureAnnouncementsTable();

    const id = randomUUID();
    const now = new Date();
    const targetUserIds = input.targetAudience === "SELECTED" ? (input.targetUserIds ?? []) : [];

    await prisma.$executeRaw`
        INSERT INTO "announcements" (
            "id", "title", "body", "targetAudience", "targetUserIds",
            "scheduledAt", "expiresAt", "dashboardBannerDays", "createdById",
            "createdAt", "updatedAt"
        ) VALUES (
            ${id},
            ${input.title.trim()},
            ${input.body.trim()},
            ${input.targetAudience},
            ${targetUserIds},
            ${input.scheduledAt ?? null},
            ${input.expiresAt ?? null},
            ${input.dashboardBannerDays ?? 7},
            ${input.createdById},
            ${now},
            ${now}
        )
    `;

    const created = await getAnnouncementById(id);
    if (created && isAnnouncementLive(created)) {
        await ensureAnnouncementNotificationsSent(created);
    }

    return created;
}

export async function updateAnnouncement(
    id: string,
    input: Partial<{
        title: string;
        body: string;
        targetAudience: AnnouncementAudience;
        targetUserIds: string[];
        scheduledAt: Date | null;
        expiresAt: Date | null;
        dashboardBannerDays: number;
    }>
) {
    await ensureAnnouncementsTable();

    const existing = await getAnnouncementById(id);
    if (!existing) return null;

    const title = input.title?.trim() ?? existing.title;
    const body = input.body?.trim() ?? existing.body;
    const targetAudience = input.targetAudience ?? existing.targetAudience;
    const targetUserIds = targetAudience === "SELECTED"
        ? (input.targetUserIds ?? existing.targetUserIds)
        : [];
    const scheduledAt = input.scheduledAt !== undefined ? input.scheduledAt : existing.scheduledAt;
    const expiresAt = input.expiresAt !== undefined ? input.expiresAt : existing.expiresAt;
    const dashboardBannerDays = input.dashboardBannerDays ?? existing.dashboardBannerDays;
    const now = new Date();

    await prisma.$executeRaw`
        UPDATE "announcements"
        SET
            "title" = ${title},
            "body" = ${body},
            "targetAudience" = ${targetAudience},
            "targetUserIds" = ${targetUserIds},
            "scheduledAt" = ${scheduledAt},
            "expiresAt" = ${expiresAt},
            "dashboardBannerDays" = ${dashboardBannerDays},
            "updatedAt" = ${now}
        WHERE "id" = ${id}
    `;

    const updated = await getAnnouncementById(id);
    if (updated && isAnnouncementLive(updated) && !updated.notificationsSentAt) {
        await ensureAnnouncementNotificationsSent(updated);
    }

    return updated;
}

export async function deleteAnnouncement(id: string) {
    await ensureAnnouncementsTable();

    await prisma.$executeRaw`
        DELETE FROM "announcement_dismissals" WHERE "announcementId" = ${id}
    `;
    await prisma.$executeRaw`
        DELETE FROM "notifications"
        WHERE "entityType" = 'ANNOUNCEMENT' AND "entityId" = ${id}
    `;
    await prisma.$executeRaw`
        DELETE FROM "announcements" WHERE "id" = ${id}
    `;
}

export async function dismissAnnouncement(userId: string, announcementId: string) {
    await ensureAnnouncementsTable();

    await prisma.$executeRaw`
        INSERT INTO "announcement_dismissals" ("userId", "announcementId", "dismissedAt")
        VALUES (${userId}, ${announcementId}, ${new Date()})
        ON CONFLICT ("userId", "announcementId") DO NOTHING
    `;
}

async function getDismissedAt(userId: string, announcementId: string) {
    const rows = await prisma.$queryRaw<Array<{ dismissedAt: Date }>>`
        SELECT "dismissedAt"
        FROM "announcement_dismissals"
        WHERE "userId" = ${userId} AND "announcementId" = ${announcementId}
        LIMIT 1
    `;
    return rows[0]?.dismissedAt ?? null;
}

export async function ensureAnnouncementNotificationsSent(announcement: AnnouncementWithAdmin | AnnouncementRecord) {
    if (announcement.notificationsSentAt) return;
    if (!isAnnouncementLive(announcement)) return;

    const full = "adminName" in announcement
        ? announcement
        : await getAnnouncementById(announcement.id);
    if (!full) return;

    const userIds = await getTargetUserIds(full);
    const adminName = full.adminName || "Admin";
    const preview = full.body.length > 100 ? `${full.body.slice(0, 97)}...` : full.body;

    for (const userId of userIds) {
        await createNotification({
            userId,
            type: NOTIFICATION_TYPES.GLOBAL_ANNOUNCEMENT,
            message: `Message from ${adminName}: ${preview}`,
            entityType: "ANNOUNCEMENT",
            entityId: full.id,
            route: `/dashboard?announcement=${full.id}`,
        });
    }

    await prisma.$executeRaw`
        UPDATE "announcements"
        SET "notificationsSentAt" = ${new Date()}
        WHERE "id" = ${full.id} AND "notificationsSentAt" IS NULL
    `;
}

export async function processDueAnnouncementNotifications() {
    await ensureAnnouncementsTable();

    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT a.*, u."name" AS "adminName", u."email" AS "adminEmail"
        FROM "announcements" a
        JOIN "users" u ON u."id" = a."createdById"
        WHERE a."notificationsSentAt" IS NULL
          AND (a."scheduledAt" IS NULL OR a."scheduledAt" <= NOW())
          AND (a."expiresAt" IS NULL OR a."expiresAt" > NOW())
    `;

    for (const row of rows) {
        const announcement = {
            ...mapRow(row),
            adminName: String(row.adminName ?? row.adminEmail ?? "Admin"),
        };
        await ensureAnnouncementNotificationsSent(announcement);
    }
}

export async function getActiveAnnouncementsForUser(user: { id: string; role: string }) {
    await ensureAnnouncementsTable();
    await processDueAnnouncementNotifications();

    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT
            a.*,
            u."name" AS "adminName",
            u."email" AS "adminEmail",
            d."dismissedAt" AS "dismissedAt"
        FROM "announcements" a
        JOIN "users" u ON u."id" = a."createdById"
        LEFT JOIN "announcement_dismissals" d
            ON d."announcementId" = a."id" AND d."userId" = ${user.id}
        WHERE (a."scheduledAt" IS NULL OR a."scheduledAt" <= NOW())
          AND (a."expiresAt" IS NULL OR a."expiresAt" > NOW())
        ORDER BY a."createdAt" DESC
    `;

    const now = new Date();
    const matched: Array<AnnouncementWithAdmin & { dismissedAt: Date | null }> = [];

    for (const row of rows) {
        const announcement = {
            ...mapRow(row),
            adminName: String(row.adminName ?? row.adminEmail ?? "Admin"),
            dismissedAt: row.dismissedAt ? new Date(String(row.dismissedAt)) : null,
        };

        if (!userMatchesAudience(user, announcement)) continue;
        if (!isAnnouncementLive(announcement, now)) continue;
        matched.push(announcement);
    }

    const popup = matched.find((a) => !a.dismissedAt) ?? null;

    const dashboardBanners = matched.filter((a) => {
        if (!a.dismissedAt) return false;
        const bannerUntil = new Date(a.dismissedAt);
        bannerUntil.setDate(bannerUntil.getDate() + a.dashboardBannerDays);
        return now < bannerUntil;
    });

    return { popup, dashboardBanners };
}

export function serializeAnnouncement(announcement: AnnouncementWithAdmin & { dismissedAt?: Date | null }) {
    return {
        id: announcement.id,
        title: announcement.title,
        body: announcement.body,
        targetAudience: announcement.targetAudience,
        targetUserIds: announcement.targetUserIds,
        scheduledAt: announcement.scheduledAt?.toISOString() ?? null,
        expiresAt: announcement.expiresAt?.toISOString() ?? null,
        dashboardBannerDays: announcement.dashboardBannerDays,
        createdById: announcement.createdById,
        adminName: announcement.adminName,
        notificationsSentAt: announcement.notificationsSentAt?.toISOString() ?? null,
        createdAt: announcement.createdAt.toISOString(),
        updatedAt: announcement.updatedAt.toISOString(),
        dismissedAt: announcement.dismissedAt?.toISOString() ?? null,
    };
}

export const AUDIENCE_LABELS: Record<AnnouncementAudience, string> = {
    EVERYONE: "Everyone",
    FREE: "Free users",
    PREMIUM: "Premium users",
    COACH: "Coaches",
    ADMIN: "Admins",
    SELECTED: "Selected users",
};
