import { prisma } from "@/lib/prisma";
import { getUserPinnedExercises } from "@/lib/pinnedExercises";
import {
    ensureProfileExtendedColumns,
    getUserProfilePrivacy,
    getUserSocialLinks,
    hasSocialLinks,
    type SocialLinks,
} from "@/lib/profilePrivacy";
import { canPublishPlansToProfile, isCoachRole } from "@/lib/roles";
import { getPresenceIndicator } from "@/lib/userPresence";
import { withResolvedAvatar } from "@/lib/uploadUrls";
import { getAchievementSummary, type AchievementDisplayItem } from "@/lib/achievements";
import { getWorkoutStreak } from "@/lib/workoutAdherenceStreak";
import { isInactiveAccount } from "@/lib/userDeactivation";
import { getNickname, loadNicknameMap, pickDisplayName } from "@/lib/userNicknames";
import { loadCompletedRecordSets, loadAllTimeExerciseRecords } from "@/lib/exerciseRecordHistory";
import { canonicalExerciseName } from "@/lib/exerciseCanonical";
import { exerciseIdentityKey } from "@/lib/exerciseIdentity";

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
    /** Session where this best weight was logged, when known. */
    workoutLogId?: string | null;
    isPr: boolean;
}

export interface PublicProfileActivityItem {
    id: string;
    workoutLogId: string;
    workoutName: string;
    loggedAt: string;
    exerciseCount: number;
    setCount: number;
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
    goal: string | null;
    trainingLocation: string | null;
    trainingDaysPerWeek: number | null;
    bio: string | null;
    streak: number | null;
    totalWorkouts: number | null;
    /** Completed sets marked as PRs — same source as achievements. */
    totalPrs: number | null;
    onlineStatus: { level: string; label: string } | null;
    mutualCoach: PublicProfileCoach | null;
    coachedBy: PublicProfileCoachedBy | null;
    personalRecords: PublicProfilePersonalRecord[];
    achievementSummary: PublicAchievementSummary;
    plans: PublicProfilePlan[];
    activityFeed: PublicProfileActivityItem[];
    /** Total completed workouts available for activity (may exceed feed length). */
    activityTotal: number;
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

const PUBLIC_ACTIVITY_LIMIT = 10;

async function buildPublicActivityFeed(userId: string): Promise<{
    items: PublicProfileActivityItem[];
    total: number;
}> {
    const [logs, total] = await Promise.all([
        prisma.workoutLog.findMany({
            where: { userId, status: "COMPLETED" },
            include: {
                workout: { select: { name: true } },
                sets: {
                    where: { isWarmup: false },
                    select: { exerciseId: true, isCompleted: true },
                },
            },
            orderBy: { loggedAt: "desc" },
            take: PUBLIC_ACTIVITY_LIMIT,
        }),
        prisma.workoutLog.count({ where: { userId, status: "COMPLETED" } }),
    ]);

    const items = logs.map((log) => {
        const exerciseIds = new Set(log.sets.map((set) => set.exerciseId));
        const setCount = log.sets.filter((set) => set.isCompleted).length || log.sets.length;
        return {
            id: log.id,
            workoutLogId: log.id,
            workoutName: log.workout?.name?.trim() || "Workout",
            loggedAt: log.loggedAt.toISOString(),
            exerciseCount: exerciseIds.size,
            setCount,
        };
    });

    return { items, total };
}

async function getPersonalRecordsForProfile(
    userId: string,
    pinned: string[]
): Promise<PublicProfilePersonalRecord[]> {
    if (pinned.length === 0) return [];

    const [rows, boards] = await Promise.all([
        loadCompletedRecordSets(userId),
        loadAllTimeExerciseRecords(userId, { exerciseNames: pinned }),
    ]);
    const records: PublicProfilePersonalRecord[] = [];

    for (const pin of pinned) {
        const displayName = canonicalExerciseName(pin) || pin.trim();
        const key = exerciseIdentityKey(displayName);
        if (!key) continue;

        const exRecords = boards[key];
        if (!exRecords || exRecords.bestWeightKg == null || exRecords.bestWeightKg <= 0) continue;

        const targetWeight = exRecords.bestWeightKg;
        const targetReps = exRecords.bestWeightReps ?? 0;
        let workoutLogId: string | null = null;
        let loggedAt = new Date(0).toISOString();

        for (let i = rows.length - 1; i >= 0; i--) {
            const set = rows[i];
            if (exerciseIdentityKey(set.exerciseName) !== key) continue;
            if (set.weightKg == null) continue;
            if (Math.abs(set.weightKg - targetWeight) > 0.001) continue;
            if (targetReps > 0 && (set.reps ?? 0) !== targetReps) continue;
            workoutLogId = set.logId;
            loggedAt = set.loggedAt;
            break;
        }

        records.push({
            exerciseName: displayName,
            weightKg: Math.round(targetWeight * 100) / 100,
            reps: targetReps,
            loggedAt,
            workoutLogId,
            isPr: true,
        });
    }

    return records;
}

async function countPersonalRecordSets(userId: string): Promise<number> {
    return prisma.logSet.count({
        where: { isPR: true, workoutLog: { userId, status: "COMPLETED" } },
    });
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
                trainingLocation: true,
                trainingDaysPerWeek: true,
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
            goal: null,
            trainingLocation: null,
            trainingDaysPerWeek: null,
            bio: null,
            streak: null,
            totalWorkouts: null,
            totalPrs: null,
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
            activityTotal: 0,
            socialLinks: null,
            coachClients: [],
        };
    }

    let streak: number | null = null;
    let totalWorkouts: number | null = null;
    let totalPrs: number | null = null;
    let achievementSummary: PublicAchievementSummary = {
        totalUnlocked: 0,
        totalAchievements: 0,
        preview: [],
    };
    let personalRecords: PublicProfilePersonalRecord[] = [];
    let plans: PublicProfilePlan[] = [];
    let activityFeed: PublicProfileActivityItem[] = [];
    let activityTotal = 0;
    let mutualCoach: PublicProfileCoach | null = null;
    let coachClients: PublicProfileCoachClient[] = [];
    let bio: string | null = target.bio?.trim() ? target.bio.trim() : null;
    let onlineStatus = presence
        ? { level: presence.level, label: presence.label }
        : null;
    let resolvedSocialLinks = hasSocialLinks(socialLinks) ? socialLinks : null;

    const [
        streakValue,
        total,
        prTotal,
        achievementSummaryValue,
        personalRecordsValue,
        rawPlans,
        activityFeedResult,
        mutualCoachValue,
        coachClientsValue,
        privacy,
    ] = await Promise.all([
        getWorkoutStreak(targetUserId),
        prisma.workoutLog.count({ where: { userId: targetUserId, status: "COMPLETED" } }),
        countPersonalRecordSets(targetUserId),
        getAchievementSummary(targetUserId),
        getPersonalRecordsForProfile(targetUserId, pinned),
        getPublicPlansForUser(targetUserId),
        buildPublicActivityFeed(targetUserId),
        getMutualCoach(viewerId, target.coachId),
        isCoachProfile ? getPublicCoachClients(targetUserId, viewerId) : Promise.resolve([]),
        getUserProfilePrivacy(targetUserId),
    ]);

    streak = streakValue;
    totalWorkouts = total;
    totalPrs = prTotal;
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
    activityFeed = activityFeedResult.items;
    activityTotal = activityFeedResult.total;
    mutualCoach = mutualCoachValue;
    coachClients = coachClientsValue;

    const isOwner = viewerId === targetUserId;
    if (!isOwner) {
        if (!privacy.bio) bio = null;
        if (!privacy.workoutStats) {
            streak = null;
            totalWorkouts = null;
            totalPrs = null;
        }
        if (!privacy.prs) personalRecords = [];
        if (!privacy.activityFeed) {
            activityFeed = [];
            activityTotal = 0;
        }
        if (!privacy.achievements) {
            achievementSummary = {
                totalUnlocked: 0,
                totalAchievements: 0,
                preview: [],
            };
        }
        if (!privacy.publicPlans) plans = [];
        if (!privacy.onlineStatus) onlineStatus = null;
        if (!privacy.socialLinks) resolvedSocialLinks = null;
    }

    return {
        ...base,
        username: formatPublicUsername(chosenName, target.id, target.username),
        joinDate: formatJoinDate(target.createdAt),
        trainingGoal,
        goal: target.goal ?? null,
        trainingLocation: target.trainingLocation ?? null,
        trainingDaysPerWeek: target.trainingDaysPerWeek ?? null,
        bio,
        streak,
        totalWorkouts,
        totalPrs,
        onlineStatus,
        mutualCoach,
        coachedBy,
        personalRecords,
        achievementSummary,
        plans,
        activityFeed,
        activityTotal,
        socialLinks: resolvedSocialLinks,
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
