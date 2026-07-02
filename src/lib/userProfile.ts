import { prisma } from "@/lib/prisma";
import { getUserPinnedExercises } from "@/lib/pinnedExercises";
import {
    ensureProfileExtendedColumns,
    getUserSocialLinks,
    hasSocialLinks,
    type SocialLinks,
} from "@/lib/profilePrivacy";
import { canPublishPlansToProfile, isCoachRole } from "@/lib/roles";
import { getPresenceIndicator } from "@/lib/userPresence";
import { withResolvedAvatar } from "@/lib/uploadUrls";
import { getAchievementSummary, type AchievementDisplayItem } from "@/lib/achievements";
import { getWorkoutStreak } from "@/lib/workoutAdherenceStreak";
import { resolveLogSetExerciseName } from "@/lib/logSetExerciseName";
import { isInactiveAccount } from "@/lib/userDeactivation";
import { getNickname, loadNicknameMap, pickDisplayName } from "@/lib/userNicknames";

export { getWorkoutStreak };

let profileColumnsReady = false;

export async function ensureUserProfileColumns() {
    if (profileColumnsReady) return;
    await ensureProfileExtendedColumns();
    profileColumnsReady = true;
}

export const TRAINING_GOAL_LABELS: Record<string, string> = {
    GAIN_MUSCLE: "Build muscle",
    LOSE_WEIGHT: "Lose weight",
    RECOMPOSITION: "Body recomposition",
    STRENGTH: "Gain strength",
};

export interface PublicAchievementSummary {
    totalUnlocked: number;
    totalAchievements: number;
    preview: AchievementDisplayItem[];
}

type ProfileViewer = { id: string; role: string } | null;
export type ProfileViewMode = "full" | "limited" | "none";

export async function getProfileViewMode(
    viewer: ProfileViewer,
    targetUserId: string
): Promise<ProfileViewMode> {
    if (!viewer) return "none";

    await ensureUserProfileColumns();

    const target = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { isPrivateProfile: true, coachId: true, isDeleted: true },
    });

    if (!target || target.isDeleted) return "none";
    if (viewer.id === targetUserId) return "full";
    if (viewer.role === "SUPER_ADMIN") return "full";
    if (target.coachId === viewer.id && isCoachRole(viewer.role as never)) return "full";
    if (target.isPrivateProfile) return "limited";

    return "full";
}

export async function canViewUserProfile(viewer: ProfileViewer, targetUserId: string): Promise<boolean> {
    const mode = await getProfileViewMode(viewer, targetUserId);
    return mode !== "none";
}

export async function canViewFullProfile(viewer: ProfileViewer, targetUserId: string): Promise<boolean> {
    const mode = await getProfileViewMode(viewer, targetUserId);
    return mode === "full";
}

export async function canViewWorkoutLog(
    viewer: Pick<{ id: string; role: string; coachId: string | null }, "id" | "role" | "coachId">,
    log: { userId: string; status: string; user?: { coachId: string | null } | null }
): Promise<boolean> {
    if (viewer.id === log.userId) return true;
    if (viewer.role === "SUPER_ADMIN") return true;
    if (viewer.role === "COACH" && log.user?.coachId === viewer.id) return true;

    if (log.status !== "COMPLETED") return false;

    return canViewFullProfile(viewer, log.userId);
}

export async function canEditWorkoutLog(
    viewer: Pick<{ id: string; role: string }, "id" | "role">,
    log: {
        userId: string;
        user?: { coachId: string | null; isDeleted?: boolean; isDeactivated?: boolean; email?: string } | null;
    }
): Promise<boolean> {
    if (viewer.id === log.userId) return true;
    if (viewer.role === "SUPER_ADMIN") return true;
    if (viewer.role === "COACH" && log.user?.coachId === viewer.id) {
        return log.user ? !isInactiveAccount(log.user) : false;
    }
    return false;
}

/** Public profile plans visible to users with full profile access. */
export async function canViewUserPlanFromProfile(
    viewer: ProfileViewer,
    planId: string
): Promise<boolean> {
    if (!viewer) return false;

    const plan = await prisma.plan.findUnique({
        where: { id: planId },
        select: { creatorId: true, isPublic: true, type: true },
    });

    if (!plan || plan.type !== "USER_CREATED" || !plan.isPublic) return false;
    if (viewer.id === plan.creatorId) return true;
    if (!(await canViewFullProfile(viewer, plan.creatorId))) return false;

    const owner = await prisma.user.findUnique({
        where: { id: plan.creatorId },
        select: { role: true },
    });
    if (!owner || !(await canPublishPlansToProfile(plan.creatorId, owner.role))) return false;

    return true;
}

export async function canCopyUserPlan(
    viewer: ProfileViewer,
    planId: string,
    ownerUserId: string
): Promise<boolean> {
    if (!viewer) return false;
    if (!(await canViewFullProfile(viewer, ownerUserId))) return false;
    if (viewer.id === ownerUserId) return false;
    if (viewer.role === "SUPER_ADMIN") return true;

    if (isCoachRole(viewer.role as never)) {
        const target = await prisma.user.findUnique({
            where: { id: ownerUserId },
            select: { coachId: true },
        });
        if (target?.coachId === viewer.id) return true;
    }

    const plan = await prisma.plan.findUnique({
        where: { id: planId },
        select: { creatorId: true, isPublic: true, type: true },
    });

    if (!plan || plan.creatorId !== ownerUserId) return false;
    if (plan.type !== "USER_CREATED") return false;

    const owner = await prisma.user.findUnique({
        where: { id: ownerUserId },
        select: { role: true },
    });
    if (!owner || !(await canPublishPlansToProfile(ownerUserId, owner.role))) return false;

    return plan.isPublic;
}

export interface PublicProfilePersonalRecord {
    exerciseName: string;
    weightKg: number;
    reps: number;
    loggedAt: string;
}

export interface PublicProfileActivityItem {
    id: string;
    workoutLogId: string;
    workoutName: string;
    loggedAt: string;
}

export interface PublicProfileCoach {
    id: string;
    name: string;
    avatarUrl?: string | null;
    label: string;
}

export interface PublicProfileCoachedBy {
    id: string;
    name: string;
    avatarUrl?: string | null;
}

export interface PublicProfileCoachClient {
    id: string;
    name: string;
    avatarUrl?: string | null;
}

export interface PublicProfilePlan {
    id: string;
    name: string;
    description?: string | null;
    tags: string[];
    weekCount: number;
    createdAt: string;
    creatorName: string;
}

export interface BuiltPublicProfile {
    id: string;
    name: string;
    /** Their chosen profile name — unchanged by your private nickname. */
    chosenName: string;
    username: string;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    role: string;
    experienceLevel?: string | null;
    isPrivateProfile: boolean;
    joinDate: string;
    trainingGoal: string | null;
    bio: string | null;
    streak: number | null;
    totalWorkouts: number | null;
    onlineStatus: { level: string; label: string } | null;
    mutualCoach: PublicProfileCoach | null;
    coachedBy: PublicProfileCoachedBy | null;
    personalRecords: PublicProfilePersonalRecord[];
    achievementSummary: PublicAchievementSummary;
    plans: PublicProfilePlan[];
    activityFeed: PublicProfileActivityItem[];
    socialLinks: SocialLinks | null;
    coachClients: PublicProfileCoachClient[];
}

function formatJoinDate(createdAt: Date): string {
    return createdAt.toLocaleDateString("en-IE", { month: "long", year: "numeric" });
}

/** Public handle derived from display name — never exposes email. */
export function formatPublicUsername(name: string, userId: string, customUsername?: string | null): string {
    const custom = customUsername?.trim().toLowerCase();
    if (custom) return custom.replace(/[^a-z0-9_]/g, "").slice(0, 24) || `athlete${userId.slice(-6).toLowerCase()}`;
    const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 24);
    if (slug.length >= 2) return slug;
    return `athlete${userId.slice(-6).toLowerCase()}`;
}

const PUBLIC_ACTIVITY_LIMIT = 3;

async function buildPublicActivityFeed(userId: string): Promise<PublicProfileActivityItem[]> {
    const logs = await prisma.workoutLog.findMany({
        where: { userId, status: "COMPLETED" },
        include: { workout: { select: { name: true } } },
        orderBy: { loggedAt: "desc" },
        take: PUBLIC_ACTIVITY_LIMIT,
    });

    return logs.map((log) => ({
        id: log.id,
        workoutLogId: log.id,
        workoutName: log.workout?.name?.trim() || "Workout",
        loggedAt: log.loggedAt.toISOString(),
    }));
}

async function getPersonalRecordsForProfile(userId: string, pinned: string[]): Promise<PublicProfilePersonalRecord[]> {
    if (pinned.length === 0) return [];

    const sets = await prisma.logSet.findMany({
        where: {
            isWarmup: false,
            weightKg: { gt: 0 },
            workoutLog: { userId, status: "COMPLETED" },
        },
        include: {
            exercise: { select: { name: true } },
            workoutLog: { select: { loggedAt: true } },
        },
        orderBy: [{ weightKg: "desc" }, { workoutLog: { loggedAt: "desc" } }],
    });

    const bestByExercise = new Map<string, (typeof sets)[number]>();
    for (const set of sets) {
        const name = resolveLogSetExerciseName(set);
        if (!name || name === "Unknown") continue;
        const key = name.toLowerCase();
        if (!bestByExercise.has(key)) bestByExercise.set(key, set);
    }

    const records: PublicProfilePersonalRecord[] = [];
    for (const pin of pinned) {
        const set = bestByExercise.get(pin.toLowerCase());
        if (!set || set.weightKg == null) continue;
        records.push({
            exerciseName: resolveLogSetExerciseName(set),
            weightKg: Math.round(set.weightKg * 100) / 100,
            reps: set.reps ?? 0,
            loggedAt: set.workoutLog.loggedAt.toISOString(),
        });
    }

    return records;
}

async function getCoachedBy(
    coachId: string | null,
    viewerId: string
): Promise<PublicProfileCoachedBy | null> {
    if (!coachId) return null;

    const coach = await prisma.user.findUnique({
        where: { id: coachId },
        select: { id: true, name: true, email: true, avatarUrl: true, isDeleted: true },
    });
    if (!coach || coach.isDeleted) return null;

    const nickname = viewerId !== coach.id ? await getNickname(viewerId, coach.id) : null;

    return withResolvedAvatar({
        id: coach.id,
        name: pickDisplayName(coach.name, coach.email, nickname, "Coach"),
        avatarUrl: coach.avatarUrl,
    });
}

async function getMutualCoach(viewerId: string, targetCoachId: string | null): Promise<PublicProfileCoach | null> {
    if (!targetCoachId || viewerId === targetCoachId) return null;

    const viewer = await prisma.user.findUnique({
        where: { id: viewerId },
        select: { coachId: true },
    });
    if (!viewer?.coachId || viewer.coachId !== targetCoachId) return null;

    const coach = await prisma.user.findUnique({
        where: { id: targetCoachId },
        select: { id: true, name: true, email: true, avatarUrl: true, isDeleted: true },
    });
    if (!coach || coach.isDeleted) return null;

    const nickname = await getNickname(viewerId, coach.id);

    return {
        ...withResolvedAvatar({
            id: coach.id,
            name: pickDisplayName(coach.name, coach.email, nickname, "Coach"),
            avatarUrl: coach.avatarUrl,
        }),
        label: "Mutual coach",
    };
}

async function getPublicCoachClients(
    coachId: string,
    viewerId: string
): Promise<PublicProfileCoachClient[]> {
    const clients = await prisma.user.findMany({
        where: {
            coachId,
            isDeleted: false,
            isDeactivated: false,
            NOT: { email: { endsWith: "@deleted.local" } },
        },
        select: { id: true, name: true, email: true, avatarUrl: true },
        orderBy: { name: "asc" },
    });

    const nicknameMap = await loadNicknameMap(viewerId, clients.map((client) => client.id));

    return clients.map((client) =>
        withResolvedAvatar({
            id: client.id,
            name: pickDisplayName(
                client.name,
                client.email,
                nicknameMap.get(client.id),
                "Client"
            ),
            avatarUrl: client.avatarUrl,
        })
    );
}

export async function buildPublicProfileData(
    targetUserId: string,
    viewerId: string,
    viewMode: ProfileViewMode = "full"
): Promise<BuiltPublicProfile | null> {
    await ensureUserProfileColumns();

    const [target, socialLinks, bannerRows, pinned] = await Promise.all([
        prisma.user.findUnique({
            where: { id: targetUserId },
            select: {
                id: true,
                name: true,
                username: true,
                avatarUrl: true,
                role: true,
                bio: true,
                goal: true,
                experienceLevel: true,
                isPrivateProfile: true,
                isDeleted: true,
                coachId: true,
                createdAt: true,
                lastActiveAt: true,
            },
        }),
        getUserSocialLinks(targetUserId),
        prisma.$queryRaw<Array<{ bannerUrl: string | null }>>`
            SELECT "bannerUrl" FROM "users" WHERE "id" = ${targetUserId} LIMIT 1
        `,
        getUserPinnedExercises(targetUserId),
    ]);

    if (!target || target.isDeleted) return null;

    const chosenName = target.name?.trim() || "Athlete";
    const nickname = viewerId !== targetUserId
        ? await getNickname(viewerId, targetUserId)
        : null;
    const displayName = pickDisplayName(chosenName, null, nickname, chosenName);
    const bannerUrl = bannerRows[0]?.bannerUrl ?? null;
    const trainingGoal = target.goal ? (TRAINING_GOAL_LABELS[target.goal] ?? target.goal) : null;
    const presence = target.lastActiveAt ? getPresenceIndicator(target.lastActiveAt) : null;

    const base = withResolvedAvatar({
        id: target.id,
        name: displayName,
        chosenName,
        avatarUrl: target.avatarUrl,
        role: target.role,
        experienceLevel: target.experienceLevel ?? null,
        isPrivateProfile: target.isPrivateProfile ?? false,
        bannerUrl,
    });

    const coachedBy = await getCoachedBy(target.coachId, viewerId);
    const isCoachProfile = isCoachRole(target.role);

    if (viewMode === "limited") {
        return {
            ...base,
            username: formatPublicUsername(chosenName, target.id, target.username),
            joinDate: formatJoinDate(target.createdAt),
            trainingGoal: null,
            bio: null,
            streak: null,
            totalWorkouts: null,
            onlineStatus: presence
                ? { level: presence.level, label: presence.label }
                : null,
            mutualCoach: null,
            coachedBy,
            personalRecords: [],
            achievementSummary: {
                totalUnlocked: 0,
                totalAchievements: 0,
                preview: [],
            },
            plans: [],
            activityFeed: [],
            socialLinks: null,
            coachClients: [],
        };
    }

    let streak: number | null = null;
    let totalWorkouts: number | null = null;
    let achievementSummary: PublicAchievementSummary = {
        totalUnlocked: 0,
        totalAchievements: 0,
        preview: [],
    };
    let personalRecords: PublicProfilePersonalRecord[] = [];
    let plans: PublicProfilePlan[] = [];
    let activityFeed: PublicProfileActivityItem[] = [];
    let mutualCoach: PublicProfileCoach | null = null;
    let coachClients: PublicProfileCoachClient[] = [];

    const [
        streakValue,
        total,
        achievementSummaryValue,
        personalRecordsValue,
        rawPlans,
        activityFeedValue,
        mutualCoachValue,
        coachClientsValue,
    ] = await Promise.all([
        getWorkoutStreak(targetUserId),
        prisma.workoutLog.count({ where: { userId: targetUserId, status: "COMPLETED" } }),
        getAchievementSummary(targetUserId),
        getPersonalRecordsForProfile(targetUserId, pinned),
        getPublicPlansForUser(targetUserId),
        buildPublicActivityFeed(targetUserId),
        getMutualCoach(viewerId, target.coachId),
        isCoachProfile ? getPublicCoachClients(targetUserId, viewerId) : Promise.resolve([]),
    ]);

    streak = streakValue;
    totalWorkouts = total;
    achievementSummary = {
        totalUnlocked: achievementSummaryValue.totalUnlocked,
        totalAchievements: achievementSummaryValue.totalAchievements,
        preview: achievementSummaryValue.preview,
    };
    personalRecords = personalRecordsValue;
    plans = rawPlans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        tags: plan.tags,
        weekCount: plan._count.weeks,
        createdAt: plan.createdAt.toISOString(),
        creatorName: plan.originalCreator?.name ?? plan.creator?.name ?? "Unknown",
    }));
    activityFeed = activityFeedValue;
    mutualCoach = mutualCoachValue;
    coachClients = coachClientsValue;

    return {
        ...base,
        username: formatPublicUsername(chosenName, target.id, target.username),
        joinDate: formatJoinDate(target.createdAt),
        trainingGoal,
        bio: target.bio?.trim() ? target.bio.trim() : null,
        streak,
        totalWorkouts,
        onlineStatus: presence
            ? { level: presence.level, label: presence.label }
            : null,
        mutualCoach,
        coachedBy,
        personalRecords,
        achievementSummary,
        plans,
        activityFeed,
        socialLinks: hasSocialLinks(socialLinks) ? socialLinks : null,
        coachClients,
    };
}

export async function getPublicPlansForUser(ownerUserId: string) {
    const owner = await prisma.user.findUnique({
        where: { id: ownerUserId },
        select: { role: true },
    });
    if (!owner || !(await canPublishPlansToProfile(ownerUserId, owner.role))) {
        return [];
    }

    return prisma.plan.findMany({
        where: {
            creatorId: ownerUserId,
            type: "USER_CREATED",
            isPublic: true,
        },
        select: {
            id: true,
            name: true,
            description: true,
            tags: true,
            isPublic: true,
            createdAt: true,
            originalCreator: { select: { name: true } },
            creator: { select: { name: true } },
            _count: { select: { weeks: true } },
        },
        orderBy: { createdAt: "desc" },
    });
}
