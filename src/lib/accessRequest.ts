import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { NOTIFICATION_TYPES } from "@/lib/notificationTypes";
import { ensureMessageActionColumns } from "@/lib/coachChat";

export const DEFAULT_ACCESS_REQUEST_MESSAGE =
    "Hi, I'm requesting full access to the app. I'd like to upgrade from my free account and unlock all training features. Please let me know the next steps. Thank you!";

let accessRequestColumnsReady = false;

export async function ensureAccessRequestColumns() {
    if (accessRequestColumnsReady) return;

    await prisma.$executeRaw`
        ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "accessLiaisonId" TEXT,
        ADD COLUMN IF NOT EXISTS "accessRequestSentAt" TIMESTAMP(3)
    `;

    accessRequestColumnsReady = true;
}

export async function getAccessRequestStatus(userId: string) {
    await ensureAccessRequestColumns();

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            role: true,
            accessLiaisonId: true,
            accessRequestSentAt: true,
        },
    });

    if (!user || user.role !== "FREE") {
        return {
            eligible: false,
            liaison: null,
            requestSentAt: null as string | null,
            defaultMessage: DEFAULT_ACCESS_REQUEST_MESSAGE,
        };
    }

    const liaison = user.accessLiaisonId
        ? await prisma.user.findUnique({
            where: { id: user.accessLiaisonId },
            select: { id: true, name: true, avatarUrl: true },
        })
        : null;

    return {
        eligible: true,
        liaison: liaison
            ? {
                id: liaison.id,
                name: liaison.name ?? "Admin",
                avatarUrl: liaison.avatarUrl,
            }
            : null,
        requestSentAt: user.accessRequestSentAt?.toISOString() ?? null,
        defaultMessage: DEFAULT_ACCESS_REQUEST_MESSAGE,
    };
}

export async function sendAccessRequest(userId: string, content: string) {
    await ensureAccessRequestColumns();

    const trimmed = content.trim();
    if (!trimmed) throw new Error("Message is required");
    if (trimmed.length > 2000) throw new Error("Message is too long");

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, name: true, email: true, accessLiaisonId: true },
    });

    if (!user || user.role !== "FREE") {
        throw new Error("Only free accounts can request full access");
    }

    if (user.accessLiaisonId) {
        return { alreadyAssigned: true as const, liaisonId: user.accessLiaisonId };
    }

    const admins = await prisma.user.findMany({
        where: { role: "SUPER_ADMIN", isDeleted: false, isDeactivated: false },
        select: { id: true },
    });

    if (admins.length === 0) {
        throw new Error("No administrators are available right now. Please try again later.");
    }

    await ensureMessageActionColumns();

    const senderLabel = user.name?.trim() || user.email || "A free user";

    await prisma.$transaction(async (tx) => {
        for (const admin of admins) {
            await tx.message.create({
                data: {
                    senderId: user.id,
                    receiverId: admin.id,
                    content: trimmed,
                    isGeneral: false,
                    type: "TEXT",
                    status: "SENT",
                    actionType: "ACCESS_REQUEST",
                },
            });
        }

        await tx.user.update({
            where: { id: user.id },
            data: { accessRequestSentAt: new Date() },
        });
    });

    await Promise.all(
        admins.map((admin) =>
            createNotification({
                userId: admin.id,
                type: NOTIFICATION_TYPES.ACCESS_REQUEST,
                message: `${senderLabel} is requesting full access`,
                entityType: "user",
                entityId: user.id,
                route: `/chat?with=${user.id}`,
            })
        )
    );

    return { sent: true as const, adminCount: admins.length };
}

/** First super admin to reply becomes the free user's access liaison. */
export async function tryAssignAccessLiaison(freeUserId: string, adminId: string) {
    await ensureAccessRequestColumns();

    const freeUser = await prisma.user.findUnique({
        where: { id: freeUserId },
        select: { role: true, accessLiaisonId: true },
    });

    if (freeUser?.role !== "FREE" || freeUser.accessLiaisonId) return null;

    const updated = await prisma.user.updateMany({
        where: { id: freeUserId, accessLiaisonId: null, role: "FREE" },
        data: { accessLiaisonId: adminId },
    });

    if (updated.count === 0) return null;

    await createNotification({
        userId: freeUserId,
        type: NOTIFICATION_TYPES.ACCESS_REQUEST,
        message: "An admin is now handling your access request",
        entityType: "user",
        entityId: adminId,
        route: `/chat?with=${adminId}`,
    });

    return adminId;
}

export async function getFreeUserAccessLiaisonId(userId: string): Promise<string | null> {
    await ensureAccessRequestColumns();
    const row = await prisma.user.findUnique({
        where: { id: userId },
        select: { accessLiaisonId: true },
    });
    return row?.accessLiaisonId ?? null;
}
