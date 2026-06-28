import { prisma } from "@/lib/prisma";

/** Unique user ids the viewer has exchanged direct messages with. */
export async function getDirectMessagePeerIds(userId: string): Promise<string[]> {
    const rows = await prisma.message.findMany({
        where: {
            isGeneral: false,
            OR: [{ senderId: userId }, { receiverId: userId }],
        },
        select: { senderId: true, receiverId: true },
        orderBy: { createdAt: "desc" },
        take: 500,
    });

    const peerIds = new Set<string>();
    for (const row of rows) {
        const peerId = row.senderId === userId ? row.receiverId : row.senderId;
        if (peerId && !peerId.startsWith("team_")) {
            peerIds.add(peerId);
        }
    }
    return [...peerIds];
}

export async function getDirectMessageActivity(userId: string, peerIds: string[]) {
    if (peerIds.length === 0) return {} as Record<string, string>;

    const messages = await prisma.message.findMany({
        where: {
            isGeneral: false,
            OR: [
                { senderId: userId, receiverId: { in: peerIds } },
                { senderId: { in: peerIds }, receiverId: userId },
            ],
        },
        select: { senderId: true, receiverId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
    });

    const activity: Record<string, string> = {};
    for (const message of messages) {
        const peerId = message.senderId === userId ? message.receiverId : message.senderId;
        if (!peerId || activity[peerId]) continue;
        activity[peerId] = message.createdAt.toISOString();
    }

    return activity;
}

export function sortConversationsByActivity<T extends { userId: string; name: string; isDeleted?: boolean; lastMessageAt?: string | null }>(
    conversations: T[]
) {
    return [...conversations].sort((a, b) => {
        if (a.isDeleted && !b.isDeleted) return 1;
        if (!a.isDeleted && b.isDeleted) return -1;

        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        if (bTime !== aTime) return bTime - aTime;

        return a.name.localeCompare(b.name);
    });
}
