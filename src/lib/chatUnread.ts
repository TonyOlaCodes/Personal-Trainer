import { prisma } from "@/lib/prisma";

/** Count incoming direct messages not yet seen, grouped by sender peer id. */
export async function getUnreadCountsByPeer(userId: string, peerIds: string[]) {
    if (peerIds.length === 0) return {} as Record<string, number>;

    const rows = await prisma.message.groupBy({
        by: ["senderId"],
        where: {
            receiverId: userId,
            senderId: { in: peerIds },
            isGeneral: false,
            status: { not: "SEEN" },
        },
        _count: { id: true },
    });

    const counts: Record<string, number> = {};
    for (const row of rows) {
        counts[row.senderId] = row._count.id;
    }
    return counts;
}

export async function getTotalUnreadDirectCount(userId: string, peerIds: string[]) {
    const counts = await getUnreadCountsByPeer(userId, peerIds);
    return Object.values(counts).reduce((sum, n) => sum + n, 0);
}
