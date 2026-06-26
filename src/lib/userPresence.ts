import { prisma } from "@/lib/prisma";
import { formatRelative } from "@/lib/utils";

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
const TOUCH_INTERVAL_MS = 2 * 60 * 1000;
export const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type PresenceLevel = "online" | "recent" | "inactive";

export interface PresenceIndicator {
    level: PresenceLevel;
    dotClassName: string;
    label: string;
}

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

export function getPresenceIndicator(
    lastActiveAt: string | Date | null | undefined
): PresenceIndicator {
    if (!lastActiveAt) {
        return { level: "inactive", dotClassName: "bg-danger", label: "Last online unknown" };
    }

    const lastActive = new Date(lastActiveAt);
    if (Number.isNaN(lastActive.getTime())) {
        return { level: "inactive", dotClassName: "bg-danger", label: "Last online unknown" };
    }

    const diffMs = Date.now() - lastActive.getTime();
    if (diffMs < ONLINE_THRESHOLD_MS) {
        return {
            level: "online",
            dotClassName: "bg-success shadow-[0_0_6px] shadow-success/60",
            label: "Online now",
        };
    }
    if (diffMs < ONE_WEEK_MS) {
        return {
            level: "recent",
            dotClassName: "bg-warning",
            label: `Last online ${formatRelative(lastActive)}`,
        };
    }
    return {
        level: "inactive",
        dotClassName: "bg-danger",
        label: `Last online ${formatRelative(lastActive)}`,
    };
}

export function formatLastOnline(lastActiveAt: string | Date | null | undefined): string {
    return getPresenceIndicator(lastActiveAt).label;
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
