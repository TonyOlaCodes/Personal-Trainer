import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MAX_NICKNAME_LENGTH = 40;

let tableReady = false;

export async function ensureUserNicknamesTable() {
    if (tableReady) return;

    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "user_nicknames" (
            "viewerId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "targetUserId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "nickname" TEXT NOT NULL,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "user_nicknames_pkey" PRIMARY KEY ("viewerId", "targetUserId")
        )
    `;
    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "user_nicknames_viewerId_idx"
        ON "user_nicknames" ("viewerId")
    `;

    tableReady = true;
}

export function normalizeNicknameInput(value: string | null | undefined): string | null {
    if (value == null) return null;
    const trimmed = value.trim().replace(/\s+/g, " ");
    if (!trimmed) return null;
    return trimmed.slice(0, MAX_NICKNAME_LENGTH);
}

/** Display name for the viewer: private nickname, else chosen profile name. */
export function pickDisplayName(
    chosenName: string | null | undefined,
    email: string | null | undefined,
    nickname: string | null | undefined,
    fallback = "Athlete"
): string {
    const nick = normalizeNicknameInput(nickname);
    if (nick) return nick;
    return chosenName?.trim() || email?.trim() || fallback;
}

export async function getNickname(viewerId: string, targetUserId: string): Promise<string | null> {
    if (viewerId === targetUserId) return null;
    await ensureUserNicknamesTable();

    const rows = await prisma.$queryRaw<Array<{ nickname: string }>>`
        SELECT "nickname"
        FROM "user_nicknames"
        WHERE "viewerId" = ${viewerId}
          AND "targetUserId" = ${targetUserId}
        LIMIT 1
    `;

    return rows[0]?.nickname ? normalizeNicknameInput(rows[0].nickname) : null;
}

export async function loadNicknameMap(
    viewerId: string,
    targetUserIds: string[]
): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(targetUserIds.filter((id) => id && id !== viewerId))];
    const map = new Map<string, string>();
    if (uniqueIds.length === 0) return map;

    await ensureUserNicknamesTable();

    const rows = await prisma.$queryRaw<Array<{ targetUserId: string; nickname: string }>>`
        SELECT "targetUserId", "nickname"
        FROM "user_nicknames"
        WHERE "viewerId" = ${viewerId}
          AND "targetUserId" IN (${Prisma.join(uniqueIds.map((id) => Prisma.sql`${id}`))})
    `;

    for (const row of rows) {
        const nick = normalizeNicknameInput(row.nickname);
        if (nick) map.set(row.targetUserId, nick);
    }

    return map;
}

export async function setNickname(
    viewerId: string,
    targetUserId: string,
    nickname: string | null
): Promise<string | null> {
    if (viewerId === targetUserId) {
        throw new Error("Cannot set a nickname for yourself");
    }

    await ensureUserNicknamesTable();

    const normalized = normalizeNicknameInput(nickname);
    if (!normalized) {
        await prisma.$executeRaw`
            DELETE FROM "user_nicknames"
            WHERE "viewerId" = ${viewerId}
              AND "targetUserId" = ${targetUserId}
        `;
        return null;
    }

    await prisma.$executeRaw`
        INSERT INTO "user_nicknames" ("viewerId", "targetUserId", "nickname", "updatedAt")
        VALUES (${viewerId}, ${targetUserId}, ${normalized}, CURRENT_TIMESTAMP)
        ON CONFLICT ("viewerId", "targetUserId")
        DO UPDATE SET
            "nickname" = EXCLUDED."nickname",
            "updatedAt" = CURRENT_TIMESTAMP
    `;

    return normalized;
}

export async function applyViewerNicknames<T extends { id: string; name: string }>(
    viewerId: string,
    items: T[],
    chosenNames?: Map<string, string | null>
): Promise<T[]> {
    if (items.length === 0 || !viewerId) return items;

    const nicknameMap = await loadNicknameMap(viewerId, items.map((item) => item.id));
    if (nicknameMap.size === 0) return items;

    return items.map((item) => {
        const nick = nicknameMap.get(item.id);
        if (!nick) return item;
        const chosen = chosenNames?.get(item.id) ?? item.name;
        return {
            ...item,
            name: pickDisplayName(chosen, null, nick, item.name),
        };
    });
}
