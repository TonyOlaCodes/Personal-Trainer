import { prisma } from "@/lib/prisma";

let onboardingProfileColumnsReady = false;

export const GENDER_OPTIONS = [
    { id: "MALE", label: "Male" },
    { id: "FEMALE", label: "Female" },
    { id: "NON_BINARY", label: "Non-binary" },
    { id: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
] as const;

export type GenderOption = (typeof GENDER_OPTIONS)[number]["id"];

export const WORKOUT_DURATION_OPTIONS = [
    { value: 30, label: "30 min" },
    { value: 45, label: "45 min" },
    { value: 60, label: "60 min" },
    { value: 90, label: "90+ min" },
] as const;

export const ONBOARDING_GOAL_OPTIONS = [
    { id: "GAIN_MUSCLE", label: "Build Muscle", emoji: "💪", desc: "Gain size and strength" },
    { id: "LOSE_WEIGHT", label: "Lose Fat", emoji: "🔥", desc: "Reduce body fat" },
    { id: "RECOMPOSITION", label: "Body Recomposition", emoji: "⚡", desc: "Lose fat, gain muscle" },
    { id: "STRENGTH", label: "Get Stronger", emoji: "🏋️", desc: "Increase max lifts" },
] as const;

export const EXPERIENCE_SLIDER_LABELS = [
    { id: "BEGINNER", label: "Beginner", desc: "Less than 1 year of consistent training" },
    { id: "INTERMEDIATE", label: "Intermediate", desc: "1–3 years of consistent training" },
    { id: "ADVANCED", label: "Advanced", desc: "3+ years of consistent training" },
] as const;

export function experienceFromSlider(value: number): string {
    if (value <= 0) return "BEGINNER";
    if (value >= 2) return "ADVANCED";
    return "INTERMEDIATE";
}

export function sliderFromExperience(level: string): number {
    if (level === "BEGINNER") return 0;
    if (level === "ADVANCED") return 2;
    return 1;
}

export function normalizeUsername(raw?: string | null): string | null {
    const trimmed = raw?.trim().toLowerCase() ?? "";
    if (!trimmed) return null;
    const cleaned = trimmed.replace(/[^a-z0-9_]/g, "");
    if (cleaned.length < 3 || cleaned.length > 24) return null;
    return cleaned;
}

export async function ensureOnboardingProfileColumns() {
    if (onboardingProfileColumnsReady) return;

    await prisma.$executeRaw`
        ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "firstName" TEXT,
        ADD COLUMN IF NOT EXISTS "lastName" TEXT,
        ADD COLUMN IF NOT EXISTS "username" TEXT,
        ADD COLUMN IF NOT EXISTS "gender" TEXT,
        ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "coachCodeRequestSentAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "notifyOnCommunityChat" BOOLEAN NOT NULL DEFAULT false
    `;

    onboardingProfileColumnsReady = true;
}

export async function isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    await ensureOnboardingProfileColumns();
    const rows = excludeUserId
        ? await prisma.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "users"
            WHERE "username" = ${username}
              AND id <> ${excludeUserId}
            LIMIT 1
        `
        : await prisma.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "users"
            WHERE "username" = ${username}
            LIMIT 1
        `;
    return rows.length === 0;
}

export function parseDateOfBirth(raw?: string | null): Date | null {
    if (!raw?.trim()) return null;
    const match = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null;
    }
    const today = new Date();
    const minAgeDate = new Date(Date.UTC(today.getUTCFullYear() - 16, today.getUTCMonth(), today.getUTCDate()));
    if (date > minAgeDate) return null;
    if (year < 1900) return null;
    return date;
}

export function buildDisplayName(firstName?: string | null, lastName?: string | null): string | null {
    const first = firstName?.trim() ?? "";
    const last = lastName?.trim() ?? "";
    const combined = [first, last].filter(Boolean).join(" ").trim();
    return combined || null;
}

export const DEFAULT_ONBOARDING_HIDDEN_GOALS = ["calories", "steps", "sleep"];

export const DEFAULT_ONBOARDING_NOTIFICATION_PREFS = {
    notifyOnCoachMessage: true,
    notifyOnPlanUpdate: true,
    notifyOnCheckInReview: true,
    notifyOnWorkoutFeedback: true,
    notifyOnMissedCheckIn: true,
    notifyOnMissedWorkout: true,
    notifyOnCommunityChat: false,
} as const;
