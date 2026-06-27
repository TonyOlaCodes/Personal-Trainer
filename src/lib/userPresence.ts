import { prisma } from "@/lib/prisma";
import { APP_TIMEZONE } from "@/lib/appTimezone";
import { getLocalTimeParts } from "@/lib/coachNotificationSchedule";
import { toDateKey } from "@/lib/utils";

/** Show "Online now" when last activity is within this window. */
export const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
/** Throttle DB writes for lastActiveAt (heartbeat runs at this interval). */
export const PRESENCE_HEARTBEAT_MS = 60 * 1000;
const TOUCH_INTERVAL_MS = PRESENCE_HEARTBEAT_MS;
export const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type PresenceLevel = "online" | "recent" | "inactive";

export interface PresenceIndicator {
    level: PresenceLevel;
    dotClassName: string;
    /** Exact last-active text; dot colour conveys online / recent / inactive. */
    label: string;
}

function getYesterdayDateKey(now = new Date()): string {
    const { dateKey } = getLocalTimeParts(now, APP_TIMEZONE);
    const [y, m, d] = dateKey.split("-").map(Number);
    const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    anchor.setUTCDate(anchor.getUTCDate() - 1);
    return getLocalTimeParts(anchor, APP_TIMEZONE).dateKey;
}

/** Readable last-online label for lists and headers. */
export function formatLastActiveText(lastActiveAt: string | Date | null | undefined): string {
    if (!lastActiveAt) return "Inactive";

    const lastActive = new Date(lastActiveAt);
    if (Number.isNaN(lastActive.getTime())) return "Inactive";

    const diffMs = Date.now() - lastActive.getTime();
    if (diffMs < ONLINE_THRESHOLD_MS) return "Online now";

    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (diffMs < ONE_WEEK_MS) {
        if (toDateKey(lastActive) === getYesterdayDateKey()) return "Active yesterday";
        if (minutes < 60) return `Active ${minutes}m ago`;
        if (hours < 24) return `Active ${hours}h ago`;
        return `Active ${days}d ago`;
    }

    return `Inactive ${days}d`;
}

/** Update lastActiveAt at most once per heartbeat interval. */
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
        return { level: "inactive", dotClassName: "bg-danger", label: "Inactive" };
    }

    const lastActive = new Date(lastActiveAt);
    if (Number.isNaN(lastActive.getTime())) {
        return { level: "inactive", dotClassName: "bg-danger", label: "Inactive" };
    }

    const diffMs = Date.now() - lastActive.getTime();
    const textLabel = formatLastActiveText(lastActive);

    if (diffMs < ONLINE_THRESHOLD_MS) {
        return {
            level: "online",
            dotClassName: "bg-success shadow-[0_0_6px] shadow-success/60",
            label: textLabel,
        };
    }
    if (diffMs < ONE_WEEK_MS) {
        return {
            level: "recent",
            dotClassName: "bg-warning",
            label: textLabel,
        };
    }
    return {
        level: "inactive",
        dotClassName: "bg-danger",
        label: textLabel,
    };
}

export function formatLastOnline(lastActiveAt: string | Date | null | undefined): string {
    return formatLastActiveText(lastActiveAt);
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
