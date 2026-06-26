import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { APP_TIMEZONE } from "@/lib/appTimezone";
import { getLocalTimeParts, localDayBoundsUtc } from "@/lib/coachNotificationSchedule";

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** Format a Date in the app timezone (Ireland). */
export function formatDate(date: Date | string, opts?: Intl.DateTimeFormatOptions) {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: APP_TIMEZONE,
        day: "numeric",
        month: "short",
        year: "numeric",
        ...opts,
    }).format(new Date(date));
}

/** Format relative time (e.g. "3 days ago") */
export function formatRelative(date: Date | string) {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (seconds < 60) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatDate(d);
}

/** Calendar date as YYYY-MM-DD in the app timezone (Ireland). */
export function toDateKey(date: Date): string {
    return getLocalTimeParts(date, APP_TIMEZONE).dateKey;
}

/** Parse YYYY-MM-DD (or ISO) to a stable local noon Date for workout logging */
export function parseLogDate(input: string | Date): Date {
    if (input instanceof Date) {
        const d = new Date(input);
        d.setHours(12, 0, 0, 0);
        return d;
    }
    const match = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        const [, y, m, day] = match;
        return new Date(Number(y), Number(m) - 1, Number(day), 12, 0, 0, 0);
    }
    const d = new Date(input);
    d.setHours(12, 0, 0, 0);
    return d;
}

/** Whether two values fall on the same local calendar day */
export function isSameCalendarDay(a: string | Date, b: string | Date): boolean {
    const da = a instanceof Date ? a : parseLogDate(a);
    const db = b instanceof Date ? b : parseLogDate(b);
    return toDateKey(da) === toDateKey(db);
}

/** Start/end of a calendar day in the app timezone, as UTC instants. */
export function getLocalDayBounds(date: Date) {
    return localDayBoundsUtc(toDateKey(date), APP_TIMEZONE);
}

/** ISO timestamp to store for a scheduled workout day */
export function toLoggedAtIso(date?: string | Date | null): string {
    if (!date) return new Date().toISOString();
    return parseLogDate(date).toISOString();
}

/** Get initials from a name */
export function getInitials(name?: string | null) {
    if (!name) return "?";
    return name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0]?.toUpperCase())
        .join("");
}

/** Convert kg to lbs */
export function kgToLbs(kg: number) {
    return (kg * 2.20462).toFixed(1);
}

/** ISO week number for a date in the app timezone. */
export function getWeekNumber(date = new Date()) {
    const { dateKey } = getLocalTimeParts(date, APP_TIMEZONE);
    const [y, m, d] = dateKey.split("-").map(Number);
    const temp = new Date(Date.UTC(y, m - 1, d));
    const dayNum = temp.getUTCDay() || 7;
    temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
    return Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Day of week name in the app timezone. */
export function getDayName(date = new Date()) {
    return new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: APP_TIMEZONE }).format(date);
}

/** Milliseconds until the next midnight in the app timezone. */
export function getMsUntilNextMidnight(from = new Date()) {
    const { dateKey } = getLocalTimeParts(from, APP_TIMEZONE);
    const { end } = localDayBoundsUtc(dateKey, APP_TIMEZONE);
    return end.getTime() - from.getTime();
}

/** Pluralise helper */
export function plural(count: number, word: string) {
    return count === 1 ? `${count} ${word}` : `${count} ${word}s`;
}

/** Generate a random code */
export function generateCode(length = 8) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/** Generate a readable coach access code prefix */
export function getAccessCodePrefix(name?: string | null, email?: string | null) {
    const fallback = email?.split("@")[0] ?? "COACH";
    const firstName = (name ?? fallback).trim().split(/\s+/)[0] ?? "COACH";
    return firstName.replace(/[^a-z0-9]/gi, "").toUpperCase() || "COACH";
}

/** Generate a simple unique ID */
export function generateId(length = 12) {
    return Math.random().toString(36).substr(2, length);
}

/** Role display labels */
export const roleLabels: Record<string, string> = {
    FREE: "Free",
    PREMIUM: "Premium",
    COACH: "Coach",
    SUPER_ADMIN: "Admin",
};

/** Role badge variants */
export const roleBadgeClass: Record<string, string> = {
    FREE: "badge-muted",
    PREMIUM: "badge-brand",
    COACH: "badge-success",
    SUPER_ADMIN: "badge-warning",
};

export { calculateOneRM, deriveOneRMFromBestSet } from "@/lib/oneRepMax";
