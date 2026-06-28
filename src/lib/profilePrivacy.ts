import { prisma } from "@/lib/prisma";

export const PROFILE_PRIVACY_KEYS = [
    "bio",
    "bodyweight",
    "prs",
    "workoutStats",
    "achievements",
    "progressPhotos",
    "publicPlans",
    "activityFeed",
    "onlineStatus",
    "allowMessages",
    "socialLinks",
] as const;

export type ProfilePrivacyKey = (typeof PROFILE_PRIVACY_KEYS)[number];
export type ProfilePrivacy = Record<ProfilePrivacyKey, boolean>;

export interface SocialLinks {
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    website?: string;
}

export const DEFAULT_PROFILE_PRIVACY: ProfilePrivacy = {
    bio: true,
    bodyweight: true,
    prs: true,
    workoutStats: true,
    achievements: true,
    progressPhotos: true,
    publicPlans: true,
    activityFeed: true,
    onlineStatus: true,
    allowMessages: true,
    socialLinks: true,
};

export const PROFILE_PRIVACY_LABELS: Record<ProfilePrivacyKey, { label: string; description: string }> = {
    bio: { label: "Bio", description: "About me text on your profile" },
    bodyweight: { label: "Bodyweight", description: "Current bodyweight" },
    prs: { label: "Personal records", description: "Best lifts and PR highlights" },
    workoutStats: { label: "Workout statistics", description: "Streak and total sessions" },
    achievements: { label: "Achievements", description: "Milestone badges and highlights" },
    progressPhotos: { label: "Progress photos", description: "Check-in progress images" },
    publicPlans: { label: "Public plans", description: "Workout plans others can copy" },
    activityFeed: { label: "Activity feed", description: "Recent workouts, PRs, check-ins, and milestones" },
    onlineStatus: { label: "Online status", description: "When you were last active" },
    allowMessages: { label: "Allow messages", description: "Let eligible users message you" },
    socialLinks: { label: "Social links", description: "Instagram, website, and other links" },
};

let profileExtendedReady = false;

export async function ensureProfileExtendedColumns() {
    if (profileExtendedReady) return;

    await prisma.$executeRaw`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" TEXT
    `;
    await prisma.$executeRaw`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isPrivateProfile" BOOLEAN NOT NULL DEFAULT false
    `;
    await prisma.$executeRaw`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bannerUrl" TEXT
    `;
    await prisma.$executeRaw`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "socialLinks" JSONB
    `;
    await prisma.$executeRaw`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profilePrivacy" JSONB
    `;

    profileExtendedReady = true;
}

export function parseProfilePrivacy(raw: unknown): ProfilePrivacy {
    const base = { ...DEFAULT_PROFILE_PRIVACY };
    if (!raw || typeof raw !== "object") return base;

    for (const key of PROFILE_PRIVACY_KEYS) {
        const value = (raw as Record<string, unknown>)[key];
        if (typeof value === "boolean") {
            base[key] = value;
        }
    }
    return base;
}

export function parseSocialLinks(raw: unknown): SocialLinks {
    if (!raw || typeof raw !== "object") return {};
    const input = raw as Record<string, unknown>;
    const links: SocialLinks = {};
    for (const key of ["instagram", "tiktok", "youtube", "website"] as const) {
        const value = input[key];
        if (typeof value === "string" && value.trim()) {
            links[key] = value.trim();
        }
    }
    return links;
}

export function hasSocialLinks(links: SocialLinks): boolean {
    return Boolean(links.instagram || links.tiktok || links.youtube || links.website);
}

export async function getUserProfilePrivacy(userId: string): Promise<ProfilePrivacy> {
    await ensureProfileExtendedColumns();
    const rows = await prisma.$queryRaw<Array<{ profilePrivacy: unknown }>>`
        SELECT "profilePrivacy" FROM "users" WHERE "id" = ${userId} LIMIT 1
    `;
    return parseProfilePrivacy(rows[0]?.profilePrivacy);
}

export async function updateUserProfilePrivacy(userId: string, privacy: Partial<ProfilePrivacy>) {
    await ensureProfileExtendedColumns();
    const current = await getUserProfilePrivacy(userId);
    const merged = { ...current, ...privacy };
    await prisma.$executeRaw`
        UPDATE "users"
        SET "profilePrivacy" = ${JSON.stringify(merged)}::jsonb,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${userId}
    `;
    return merged;
}

export async function getUserSocialLinks(userId: string): Promise<SocialLinks> {
    await ensureProfileExtendedColumns();
    const rows = await prisma.$queryRaw<Array<{ socialLinks: unknown }>>`
        SELECT "socialLinks" FROM "users" WHERE "id" = ${userId} LIMIT 1
    `;
    return parseSocialLinks(rows[0]?.socialLinks);
}

export async function updateUserSocialLinks(userId: string, links: SocialLinks) {
    await ensureProfileExtendedColumns();
    const normalized = parseSocialLinks(links);
    await prisma.$executeRaw`
        UPDATE "users"
        SET "socialLinks" = ${JSON.stringify(normalized)}::jsonb,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${userId}
    `;
    return normalized;
}
