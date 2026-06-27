import { APP_TIMEZONE } from "@/lib/appTimezone";
import { getLocalTimeParts } from "@/lib/coachNotificationSchedule";
import { formatDate, getWeekNumber, toDateKey } from "@/lib/utils";

export type MessageDateGroup = "today" | "yesterday" | "this_week" | "last_week" | "older";

const GROUP_LABELS: Record<MessageDateGroup, string> = {
    today: "Today",
    yesterday: "Yesterday",
    this_week: "This Week",
    last_week: "Last Week",
    older: "Older",
};

function getYesterdayDateKey(now = new Date()): string {
    const { dateKey } = getLocalTimeParts(now, APP_TIMEZONE);
    const [y, m, d] = dateKey.split("-").map(Number);
    const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    anchor.setUTCDate(anchor.getUTCDate() - 1);
    return getLocalTimeParts(anchor, APP_TIMEZONE).dateKey;
}

function weekStamp(date: Date): string {
    const { year } = getLocalTimeParts(date, APP_TIMEZONE);
    return `${year}-W${getWeekNumber(date)}`;
}

/** Group label for in-thread date separators. */
export function getMessageDateGroup(date: Date | string, now = new Date()): MessageDateGroup {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "older";

    const msgKey = toDateKey(d);
    if (msgKey === toDateKey(now)) return "today";
    if (msgKey === getYesterdayDateKey(now)) return "yesterday";

    const msgWeek = weekStamp(d);
    const thisWeek = weekStamp(now);
    if (msgWeek === thisWeek) return "this_week";

    const lastWeekAnchor = new Date(now);
    lastWeekAnchor.setDate(lastWeekAnchor.getDate() - 7);
    if (msgWeek === weekStamp(lastWeekAnchor)) return "last_week";

    return "older";
}

export function getMessageDateGroupLabel(date: Date | string, now = new Date()): string {
    return GROUP_LABELS[getMessageDateGroup(date, now)];
}

export function shouldShowMessageDateGroup(
    current: Date | string,
    previous: Date | string | null | undefined,
    now = new Date()
): boolean {
    if (!previous) return true;
    return getMessageDateGroup(current, now) !== getMessageDateGroup(previous, now);
}

/** Readable last-activity time for conversation list rows. */
export function formatConversationActivityTime(date: Date | string | null | undefined): string {
    if (!date) return "";
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "";

    const diffMs = Date.now() - d.getTime();
    if (diffMs < 0) return "Just now";

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (toDateKey(d) === getYesterdayDateKey()) return "Yesterday";

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    if (days < 14) return "Last week";
    return formatDate(d, { day: "numeric", month: "short" });
}
