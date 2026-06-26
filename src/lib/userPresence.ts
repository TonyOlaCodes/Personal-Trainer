import { prisma } from "@/lib/prisma";
import { formatRelative } from "@/lib/utils";

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
const TOUCH_INTERVAL_MS = 2 * 60 * 1000;

/** Update lastActiveAt at most once every two minutes. */
export async function touchUserLastActive(userId: string): Promise<void> {
    const cutoff = new Date(Date.now() - TOUCH_INTERVAL_MS);
    await prisma.user.updateMany({
        where: {
            id: userId,
            OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: cutoff } }],
        },
        data: { lastActiveAt: new Date() },
    });
}

export function formatLastOnline(lastActiveAt: string | Date | null | undefined): string {
    if (!lastActiveAt) return "Last online unknown";
    const lastActive = new Date(lastActiveAt);
    if (Number.isNaN(lastActive.getTime())) return "Last online unknown";

    const diffMs = Date.now() - lastActive.getTime();
    if (diffMs < ONLINE_THRESHOLD_MS) return "Online now";
    return `Last online ${formatRelative(lastActive)}`;
}

export async function getLastActiveMap(userIds: string[]): Promise<Record<string, string | null>> {
    if (userIds.length === 0) return {};

    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, lastActiveAt: true },
    });

    return Object.fromEntries(
        users.map((user) => [user.id, user.lastActiveAt?.toISOString() ?? null])
    );
}
