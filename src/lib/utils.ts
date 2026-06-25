import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** Format a Date to a short readable string */
export function formatDate(date: Date | string, opts?: Intl.DateTimeFormatOptions) {
    return new Intl.DateTimeFormat("en-GB", {
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

/** Local calendar date as YYYY-MM-DD */
export function toDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
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

/** Local start/end of day for a calendar date */
export function getLocalDayBounds(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return { start, end };
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

/** Get current ISO week number */
export function getWeekNumber(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Get current day of week name */
export function getDayName(date = new Date()) {
    return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
}

/** Milliseconds until the next local midnight */
export function getMsUntilNextMidnight(from = new Date()) {
    const next = new Date(from);
    next.setHours(24, 0, 0, 0);
    return next.getTime() - from.getTime();
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
