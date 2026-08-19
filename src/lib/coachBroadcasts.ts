import { prisma } from "@/lib/prisma";
import { ensureMessageActionColumns } from "@/lib/coachChat";
import { markMessagesSeen } from "@/lib/messageReadReceipts";
import { withResolvedAvatar } from "@/lib/uploadUrls";

export type PendingCoachBroadcast = {
    id: string;
    content: string;
    createdAt: string;
    coach: {
        id: string;
        name: string;
        avatarUrl: string | null;
    };
};

/** Unacknowledged coach broadcasts for this client (newest first). */
export async function getPendingCoachBroadcastsForClient(
    clientId: string
): Promise<PendingCoachBroadcast[]> {
    await ensureMessageActionColumns();

    const rows = await prisma.message.findMany({
        where: {
            receiverId: clientId,
            isGeneral: false,
            actionType: "BROADCAST",
            status: { not: "SEEN" },
        },
        select: {
            id: true,
            content: true,
            createdAt: true,
            sender: {
                select: {
                    id: true,
                    name: true,
                    avatarUrl: true,
                    isDeleted: true,
                    deletedName: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
    });

    return rows
        .filter((row) => (row.content ?? "").trim().length > 0)
        .map((row) => {
            const coach = withResolvedAvatar({
                id: row.sender.id,
                name: row.sender.isDeleted
                    ? (row.sender.deletedName ?? "Your coach")
                    : (row.sender.name ?? "Your coach"),
                avatarUrl: row.sender.isDeleted ? null : row.sender.avatarUrl,
            });
            return {
                id: row.id,
                content: row.content!.trim(),
                createdAt: row.createdAt.toISOString(),
                coach: {
                    id: coach.id,
                    name: coach.name,
                    avatarUrl: coach.avatarUrl,
                },
            };
        });
}

/**
 * Mark a single broadcast message as seen for this recipient only.
 * Also clears matching unread COACH_BROADCAST notifications from that coach.
 */
export async function acknowledgeCoachBroadcast(clientId: string, messageId: string) {
    await ensureMessageActionColumns();

    const message = await prisma.message.findFirst({
        where: {
            id: messageId,
            receiverId: clientId,
            isGeneral: false,
            actionType: "BROADCAST",
        },
        select: { id: true, senderId: true, status: true },
    });

    if (!message) {
        throw new Error("Broadcast not found");
    }

    if (message.status !== "SEEN") {
        await markMessagesSeen([message.id]);
    }

    // Notifications are coalesced per coach — only clear when none remain unread.
    const remainingFromCoach = await prisma.message.count({
        where: {
            receiverId: clientId,
            senderId: message.senderId,
            isGeneral: false,
            actionType: "BROADCAST",
            status: { not: "SEEN" },
        },
    });

    if (remainingFromCoach === 0) {
        await prisma.$executeRaw`
            UPDATE "notifications"
            SET "read" = true
            WHERE "userId" = ${clientId}
              AND "type" = 'COACH_BROADCAST'
              AND "entityId" = ${message.senderId}
              AND "read" = false
        `;
    }

    return { ok: true as const };
}
