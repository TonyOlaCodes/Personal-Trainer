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

/**
 * Calculate estimated One Rep Max (1RM) using the most accurate sports science formulas.
 * - If reps = 1, it is exactly the lifted weight.
 * - If reps <= 10, we use the highly accurate Brzycki formula.
 * - If reps > 10, we fall back to the robust Epley formula to avoid exponential overestimation.
 */
export function calculateOneRM(weight: number, reps: number): number {
    if (weight <= 0 || reps <= 0) return 0;
    if (reps === 1) return Math.round(weight);
    
    let oneRM = 0;
    if (reps <= 10) {
        oneRM = weight / (1.0278 - 0.0278 * reps);
    } else {
        oneRM = weight * (1 + reps / 30);
    }
    
    return Math.round(oneRM);
}
