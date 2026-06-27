import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/** Read/delivery updates must not touch updatedAt — the UI uses it for "(edited)". */
function idList(ids: string[]) {
    return Prisma.join(ids.map((id) => Prisma.sql`${id}`));
}

export async function markMessagesDelivered(ids: string[]) {
    if (ids.length === 0) return;
    await prisma.$executeRaw`
        UPDATE "messages"
        SET status = 'DELIVERED'::"MessageStatus"
        WHERE id IN (${idList(ids)})
    `;
}

export async function markMessagesSeen(ids: string[]) {
    if (ids.length === 0) return;
    await prisma.$executeRaw`
        UPDATE "messages"
        SET status = 'SEEN'::"MessageStatus", "isRead" = true
        WHERE id IN (${idList(ids)})
    `;
}

export async function markIncomingDeliveredForPeers(receiverId: string, senderIds: string[]) {
    if (senderIds.length === 0) return;
    await prisma.$executeRaw`
        UPDATE "messages"
        SET status = 'DELIVERED'::"MessageStatus"
        WHERE "receiverId" = ${receiverId}
          AND "senderId" IN (${idList(senderIds)})
          AND "isGeneral" = false
          AND status = 'SENT'::"MessageStatus"
    `;
}
