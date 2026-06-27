import { prisma } from "@/lib/prisma";

const TYPING_TTL_MS = 5000;

let chatTypingTableReady = false;

export async function ensureChatTypingTable() {
    if (chatTypingTableReady) return;

    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "chat_typing" (
            "userId" TEXT NOT NULL,
            "peerId" TEXT NOT NULL,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY ("userId", "peerId")
        )
    `;

    chatTypingTableReady = true;
}

/** Record that userId is typing to peerId. */
export async function setChatTyping(userId: string, peerId: string, typing: boolean) {
    await ensureChatTypingTable();

    if (!typing) {
        await prisma.$executeRaw`
            DELETE FROM "chat_typing"
            WHERE "userId" = ${userId} AND "peerId" = ${peerId}
        `;
        return;
    }

    await prisma.$executeRaw`
        INSERT INTO "chat_typing" ("userId", "peerId", "updatedAt")
        VALUES (${userId}, ${peerId}, CURRENT_TIMESTAMP)
        ON CONFLICT ("userId", "peerId")
        DO UPDATE SET "updatedAt" = CURRENT_TIMESTAMP
    `;
}

/** True when peerId is currently typing to viewerId. */
export async function isPeerTyping(viewerId: string, peerId: string): Promise<boolean> {
    await ensureChatTypingTable();

    const cutoff = new Date(Date.now() - TYPING_TTL_MS);
    const rows = await prisma.$queryRaw<Array<{ userId: string }>>`
        SELECT "userId"
        FROM "chat_typing"
        WHERE "userId" = ${peerId}
          AND "peerId" = ${viewerId}
          AND "updatedAt" >= ${cutoff}
        LIMIT 1
    `;

    return rows.length > 0;
}

export { TYPING_TTL_MS };
