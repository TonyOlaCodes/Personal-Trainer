/**
 * Authorization for uploaded media.
 *
 * Private files (check-ins, DMs, set videos) are only readable by the owner,
 * their assigned coach, or SUPER_ADMIN. Community-chat media is readable by any
 * authenticated user. Profile avatars/banners stay readable to signed-in users
 * who can already see the profile.
 *
 * Clients never receive raw public Blob URLs for private files — they get
 * `/api/uploads/<filename>` and this module decides whether to stream the bytes.
 */

import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAccessClient, canAccessTeamChat, parseTeamCoachId } from "@/lib/apiAuth";
import { canViewProgressPhotos } from "@/lib/profilePrivacy";
import { extractUploadFilename } from "@/lib/uploadUrls";

type MediaViewer = { id: string; role: Role | string; coachId?: string | null };

export const MEDIA_PURPOSES = [
    "checkin",
    "chat-dm",
    "chat-general",
    "avatar",
    "banner",
    "workout",
    "other",
] as const;

export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];
export type MediaVisibility = "private" | "community" | "public";

export interface MediaAsset {
    filename: string;
    ownerUserId: string;
    purpose: MediaPurpose;
    visibility: MediaVisibility;
    blobUrl: string | null;
    contentType: string | null;
}

const PURPOSE_VISIBILITY: Record<MediaPurpose, MediaVisibility> = {
    checkin: "private",
    "chat-dm": "private",
    "chat-general": "community",
    avatar: "public",
    banner: "public",
    workout: "private",
    other: "private",
};

export function visibilityForPurpose(purpose: MediaPurpose): MediaVisibility {
    return PURPOSE_VISIBILITY[purpose];
}

export function parseMediaPurpose(raw: string | null | undefined): MediaPurpose {
    if (raw && (MEDIA_PURPOSES as readonly string[]).includes(raw)) {
        return raw as MediaPurpose;
    }
    return "other";
}

let mediaTableReady = false;

export async function ensureMediaAssetsTable() {
    if (mediaTableReady) return;
    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "media_assets" (
            "id" TEXT PRIMARY KEY,
            "filename" TEXT NOT NULL UNIQUE,
            "ownerUserId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "purpose" TEXT NOT NULL,
            "visibility" TEXT NOT NULL,
            "blobUrl" TEXT,
            "contentType" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `;
    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "media_assets_ownerUserId_idx"
        ON "media_assets"("ownerUserId")
    `;
    mediaTableReady = true;
}

export async function registerMediaAsset(input: {
    filename: string;
    ownerUserId: string;
    purpose: MediaPurpose;
    blobUrl?: string | null;
    contentType?: string | null;
}): Promise<void> {
    await ensureMediaAssetsTable();
    const { randomUUID } = await import("crypto");
    await prisma.$executeRaw`
        INSERT INTO "media_assets" (
            "id", "filename", "ownerUserId", "purpose", "visibility", "blobUrl", "contentType"
        )
        VALUES (
            ${randomUUID()},
            ${input.filename},
            ${input.ownerUserId},
            ${input.purpose},
            ${visibilityForPurpose(input.purpose)},
            ${input.blobUrl ?? null},
            ${input.contentType ?? null}
        )
        ON CONFLICT ("filename") DO UPDATE SET
            "ownerUserId" = EXCLUDED."ownerUserId",
            "purpose" = EXCLUDED."purpose",
            "visibility" = EXCLUDED."visibility",
            "blobUrl" = COALESCE(EXCLUDED."blobUrl", "media_assets"."blobUrl"),
            "contentType" = COALESCE(EXCLUDED."contentType", "media_assets"."contentType")
    `;
}

export async function getMediaAsset(filename: string): Promise<MediaAsset | null> {
    await ensureMediaAssetsTable();
    const rows = await prisma.$queryRaw<MediaAsset[]>`
        SELECT "filename", "ownerUserId", "purpose", "visibility", "blobUrl", "contentType"
        FROM "media_assets"
        WHERE "filename" = ${filename}
        LIMIT 1
    `;
    return rows[0] ?? null;
}

export function isAssignedCoachRelationship(
    actor: MediaViewer,
    subject: { id: string; coachId: string | null }
): boolean {
    if (actor.role === "SUPER_ADMIN") return true;
    if (actor.role === "COACH" && subject.coachId === actor.id) return true;
    return false;
}

/**
 * Assigned coach/client and SUPER_ADMIN always see check-in / progress media.
 * Everyone else is denied when the athlete has progressPhotos disabled.
 */
export async function canViewerSeeProgressPhotos(
    viewer: MediaViewer,
    subject: { id: string; coachId: string | null }
): Promise<boolean> {
    return canViewProgressPhotos(
        { id: viewer.id, role: viewer.role as Role },
        subject
    );
}

export async function canViewMedia(
    viewer: MediaViewer,
    asset: Pick<MediaAsset, "filename" | "ownerUserId" | "purpose" | "visibility">
): Promise<boolean> {
    if (viewer.id === asset.ownerUserId) return true;
    if (viewer.role === "SUPER_ADMIN") return true;

    if (asset.visibility === "public" || asset.purpose === "avatar" || asset.purpose === "banner") {
        return true;
    }

    if (asset.visibility === "community" || asset.purpose === "chat-general") {
        return true;
    }

    if (asset.purpose === "chat-dm") {
        const message = await prisma.message.findFirst({
            where: { mediaUrl: { contains: asset.filename }, isGeneral: false },
            select: { senderId: true, receiverId: true },
        });
        if (!message) return false;
        if (message.senderId === viewer.id || message.receiverId === viewer.id) return true;
        const teamCoachId = parseTeamCoachId(message.receiverId);
        if (teamCoachId) {
            return canAccessTeamChat(
                { id: viewer.id, role: viewer.role as Role, coachId: viewer.coachId ?? null },
                teamCoachId
            );
        }
        return false;
    }

    const owner = await prisma.user.findUnique({
        where: { id: asset.ownerUserId },
        select: { id: true, coachId: true },
    });
    if (!owner) return false;

    if (await canAccessClient({ id: viewer.id, role: viewer.role as Role }, owner.id)) return true;

    if (asset.purpose === "checkin") {
        const ownCheckIn = await prisma.checkIn.findFirst({
            where: {
                userId: viewer.id,
                OR: [
                    { frontImageUrl: { contains: asset.filename } },
                    { sideImageUrl: { contains: asset.filename } },
                    { videoUrl: { contains: asset.filename } },
                    { coachVideoUrl: { contains: asset.filename } },
                ],
            },
            select: { id: true },
        });
        return !!ownCheckIn;
    }

    return false;
}

/** Infer a legacy file's purpose from how it is referenced in the database. */
export async function inferLegacyMediaAsset(filename: string): Promise<MediaAsset | null> {
    const likeExact = `%${filename}%`;

    const checkIn = await prisma.checkIn.findFirst({
        where: {
            OR: [
                { frontImageUrl: { contains: filename } },
                { sideImageUrl: { contains: filename } },
                { videoUrl: { contains: filename } },
                { coachVideoUrl: { contains: filename } },
            ],
        },
        select: { userId: true, coachVideoUrl: true },
    });
    if (checkIn) {
        let ownerUserId = checkIn.userId;
        if (checkIn.coachVideoUrl?.includes(filename)) {
            const athlete = await prisma.user.findUnique({
                where: { id: checkIn.userId },
                select: { coachId: true },
            });
            if (athlete?.coachId) ownerUserId = athlete.coachId;
        }
        return {
            filename,
            ownerUserId,
            purpose: "checkin",
            visibility: "private",
            blobUrl: null,
            contentType: null,
        };
    }

    const dm = await prisma.message.findFirst({
        where: { mediaUrl: { contains: filename }, isGeneral: false },
        select: { senderId: true },
    });
    if (dm) {
        return {
            filename,
            ownerUserId: dm.senderId,
            purpose: "chat-dm",
            visibility: "private",
            blobUrl: null,
            contentType: null,
        };
    }

    const general = await prisma.message.findFirst({
        where: { mediaUrl: { contains: filename }, isGeneral: true },
        select: { senderId: true },
    });
    if (general) {
        return {
            filename,
            ownerUserId: general.senderId,
            purpose: "chat-general",
            visibility: "community",
            blobUrl: null,
            contentType: null,
        };
    }

    const logSet = await prisma.logSet.findFirst({
        where: { videoUrl: { contains: filename } },
        select: { workoutLog: { select: { userId: true } } },
    });
    if (logSet?.workoutLog) {
        return {
            filename,
            ownerUserId: logSet.workoutLog.userId,
            purpose: "workout",
            visibility: "private",
            blobUrl: null,
            contentType: null,
        };
    }

    const avatarOwner = await prisma.user.findFirst({
        where: { avatarUrl: { contains: filename } },
        select: { id: true },
    });
    if (avatarOwner) {
        return {
            filename,
            ownerUserId: avatarOwner.id,
            purpose: "avatar",
            visibility: "public",
            blobUrl: null,
            contentType: null,
        };
    }

    const bannerRows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "users" WHERE "bannerUrl" LIKE ${likeExact} LIMIT 1
    `;
    if (bannerRows[0]) {
        return {
            filename,
            ownerUserId: bannerRows[0].id,
            purpose: "banner",
            visibility: "public",
            blobUrl: null,
            contentType: null,
        };
    }

    return null;
}

export async function lookupStoredMediaUrl(filename: string): Promise<string | null> {
    const asset = await getMediaAsset(filename);
    if (asset?.blobUrl) return asset.blobUrl;

    const checkIn = await prisma.checkIn.findFirst({
        where: {
            OR: [
                { frontImageUrl: { contains: filename } },
                { sideImageUrl: { contains: filename } },
                { videoUrl: { contains: filename } },
                { coachVideoUrl: { contains: filename } },
            ],
        },
        select: { frontImageUrl: true, sideImageUrl: true, videoUrl: true, coachVideoUrl: true },
    });
    const checkInUrl = [
        checkIn?.frontImageUrl,
        checkIn?.sideImageUrl,
        checkIn?.videoUrl,
        checkIn?.coachVideoUrl,
    ].find((url) => url?.includes(filename));
    if (checkInUrl) return checkInUrl;

    const message = await prisma.message.findFirst({
        where: { mediaUrl: { contains: filename } },
        select: { mediaUrl: true },
    });
    if (message?.mediaUrl) return message.mediaUrl;

    const logSet = await prisma.logSet.findFirst({
        where: { videoUrl: { contains: filename } },
        select: { videoUrl: true },
    });
    if (logSet?.videoUrl) return logSet.videoUrl;

    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { avatarUrl: { contains: filename } },
            ],
        },
        select: { avatarUrl: true },
    });
    if (user?.avatarUrl) return user.avatarUrl;

    const bannerRows = await prisma.$queryRaw<Array<{ bannerUrl: string | null }>>`
        SELECT "bannerUrl" FROM "users" WHERE "bannerUrl" LIKE ${`%${filename}%`} LIMIT 1
    `;
    return bannerRows[0]?.bannerUrl ?? null;
}

export async function resolveMediaForViewer(
    filename: string,
    viewer: MediaViewer
): Promise<MediaAsset | null> {
    const registered = await getMediaAsset(filename);
    const asset = registered ?? await inferLegacyMediaAsset(filename);
    if (!asset) return null;
    if (!(await canViewMedia(viewer, asset))) return null;
    return asset;
}

/** Stored URL that clients should request — never a raw public Blob URL for private files. */
export function authorizedMediaUrl(storedUrl: string | null | undefined): string {
    if (!storedUrl) return "";
    const filename = extractUploadFilename(storedUrl);
    if (filename) return `/api/uploads/${filename}`;
    return storedUrl;
}
