import { prisma } from "@/lib/prisma";
import { ensureBodyweightTable } from "@/lib/bodyweight";
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

export interface PublicAchievement {
    id: string;
    title: string;
    description: string;
}

export async function getWorkoutStreak(userId: string): Promise<number> {
    const logs = await prisma.workoutLog.findMany({
        where: { userId, status: "COMPLETED" },
        select: { loggedAt: true },
        orderBy: { loggedAt: "desc" },
        take: 400,
    });

    const allLogDates = [...new Set(logs.map((log) => new Date(log.loggedAt).toDateString()))]
        .map((d) => new Date(d).getTime())
        .sort((a, b) => b - a);

    if (allLogDates.length === 0) return 0;

    let streak = 0;
    const checkDay = new Date();
    checkDay.setHours(0, 0, 0, 0);

    for (const dayTime of allLogDates) {
        if (dayTime === checkDay.getTime()) {
            streak++;
            checkDay.setDate(checkDay.getDate() - 1);
        } else if (dayTime < checkDay.getTime()) {
            break;
        }
    }

    return streak;
}

export async function getPublicAchievements(userId: string): Promise<PublicAchievement[]> {
    const [completedCount, prCount, streak] = await Promise.all([
        prisma.workoutLog.count({ where: { userId, status: "COMPLETED" } }),
        prisma.logSet.count({
            where: { isPR: true, workoutLog: { userId, status: "COMPLETED" } },
        }),
        getWorkoutStreak(userId),
    ]);

    const achievements: PublicAchievement[] = [];

    if (completedCount >= 1) {
        achievements.push({ id: "first-workout", title: "First Session", description: "Logged a completed workout" });
    }
    if (completedCount >= 10) {
        achievements.push({ id: "ten-workouts", title: "10 Sessions", description: "Completed 10 workouts" });
    }
    if (completedCount >= 50) {
        achievements.push({ id: "fifty-workouts", title: "50 Sessions", description: "Completed 50 workouts" });
    }
    if (streak >= 7) {
        achievements.push({ id: "week-streak", title: "7-Day Streak", description: "Trained 7 days in a row" });
    }
    if (streak >= 30) {
        achievements.push({ id: "month-streak", title: "30-Day Streak", description: "Trained 30 days in a row" });
    }
    if (prCount >= 5) {
        achievements.push({ id: "pr-hunter", title: "PR Hunter", description: "Hit 5 personal records" });
    }

    const prSets = await prisma.logSet.findMany({
        where: { isPR: true, workoutLog: { userId, status: "COMPLETED" } },
        include: { exercise: { select: { name: true } } },
        orderBy: { workoutLog: { loggedAt: "desc" } },
        take: 50,
    });

    const big3Labels: Record<string, string> = {
        "bench press": "Bench Press PR",
        squat: "Squat PR",
        deadlift: "Deadlift PR",
    };

    const seenBig3 = new Set<string>();
    for (const set of prSets) {
        const exerciseName = set.exercise?.name?.trim();
        if (!exerciseName) continue;
        const key = exerciseName.toLowerCase();
        for (const [match, title] of Object.entries(big3Labels)) {
            if (key.includes(match) && !seenBig3.has(match)) {
                seenBig3.add(match);
                achievements.push({
                    id: `big3-${match.replace(/\s+/g, "-")}`,
                    title,
                    description: `Personal best on ${exerciseName}`,
                });
            }
        }
    }

    return achievements;
}

type ProfileViewer = { id: string; role: string } | null;

export async function canViewUserProfile(viewer: ProfileViewer, targetUserId: string): Promise<boolean> {
    if (!viewer) return false;
    if (viewer.id === targetUserId) return true;
    if (viewer.role === "SUPER_ADMIN") return true;

    await ensureUserProfileColumns();

    const target = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { isPrivateProfile: true, coachId: true, isDeleted: true },
    });

    if (!target || target.isDeleted) return false;
    if (target.coachId === viewer.id && isCoachRole(viewer.role as never)) return true;
    if (target.isPrivateProfile) return false;

    return true;
}

export async function canCopyUserPlan(
    viewer: ProfileViewer,
    planId: string,
    ownerUserId: string
): Promise<boolean> {
    if (!viewer) return false;
    if (!(await canViewUserProfile(viewer, ownerUserId))) return false;
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
    label: string;
    loggedAt: string;
}

export interface PublicProfileProgressPhoto {
    id: string;
    url: string;
    loggedAt: string;
}

export interface PublicProfileCoach {
    id: string;
    name: string;
    avatarUrl?: string | null;
    label: string;
}

export interface PublicProfilePlan {
    id: string;
    name: string;
    description?: string | null;
    tags: string[];
    weekCount: number;
    createdAt: string;
}

export interface BuiltPublicProfile {
    id: string;
    name: string;
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
    bodyweightKg: number | null;
    onlineStatus: { level: string; label: string } | null;
    mutualCoach: PublicProfileCoach | null;
    personalRecords: PublicProfilePersonalRecord[];
    favoriteExercises: string[];
    achievements: PublicAchievement[];
    plans: PublicProfilePlan[];
    activityFeed: PublicProfileActivityItem[];
    progressPhotos: PublicProfileProgressPhoto[];
    socialLinks: SocialLinks | null;
}

function formatJoinDate(createdAt: Date): string {
    return createdAt.toLocaleDateString("en-IE", { month: "long", year: "numeric" });
}

async function getLatestBodyweightKg(userId: string): Promise<number | null> {
    await ensureBodyweightTable();
    const rows = await prisma.$queryRaw<Array<{ weightKg: number }>>`
        SELECT "weightKg"
        FROM "bodyweight_logs"
        WHERE "userId" = ${userId}
        ORDER BY "loggedDate" DESC
        LIMIT 1
    `;
    if (rows[0]?.weightKg != null) return Math.round(rows[0].weightKg * 100) / 100;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { weightKg: true },
    });
    return user?.weightKg != null ? Math.round(user.weightKg * 100) / 100 : null;
}

async function getPersonalRecordsForProfile(userId: string, pinned: string[]): Promise<PublicProfilePersonalRecord[]> {
    const sets = await prisma.logSet.findMany({
        where: {
            isPR: true,
            isWarmup: false,
            weightKg: { gt: 0 },
            workoutLog: { userId, status: "COMPLETED" },
        },
        include: {
            exercise: { select: { name: true } },
            workoutLog: { select: { loggedAt: true } },
        },
        orderBy: { workoutLog: { loggedAt: "desc" } },
        take: 200,
    });

    const byExercise = new Map<string, (typeof sets)[number]>();
    for (const set of sets) {
        const name = set.exercise?.name?.trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (!byExercise.has(key)) byExercise.set(key, set);
    }

    const records: PublicProfilePersonalRecord[] = [];
    const used = new Set<string>();

    for (const pin of pinned) {
        const set = byExercise.get(pin.toLowerCase());
        if (!set || set.weightKg == null || set.reps == null) continue;
        const exerciseName = set.exercise!.name!.trim();
        used.add(exerciseName.toLowerCase());
        records.push({
            exerciseName,
            weightKg: Math.round(set.weightKg * 100) / 100,
            reps: set.reps,
            loggedAt: set.workoutLog.loggedAt.toISOString(),
        });
    }

    for (const set of sets) {
        if (records.length >= 6) break;
        const exerciseName = set.exercise?.name?.trim();
        if (!exerciseName || set.weightKg == null || set.reps == null) continue;
        const key = exerciseName.toLowerCase();
        if (used.has(key)) continue;
        used.add(key);
        records.push({
            exerciseName,
            weightKg: Math.round(set.weightKg * 100) / 100,
            reps: set.reps,
            loggedAt: set.workoutLog.loggedAt.toISOString(),
        });
    }

    return records;
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
        select: { id: true, name: true, avatarUrl: true, isDeleted: true },
    });
    if (!coach || coach.isDeleted) return null;

    return {
        ...withResolvedAvatar({
            id: coach.id,
            name: coach.name ?? "Coach",
            avatarUrl: coach.avatarUrl,
        }),
        label: "Mutual coach",
    };
}

async function getProgressPhotos(userId: string): Promise<PublicProfileProgressPhoto[]> {
    const checkIns = await prisma.checkIn.findMany({
        where: {
            userId,
            OR: [{ frontImageUrl: { not: null } }, { sideImageUrl: { not: null } }],
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, frontImageUrl: true, sideImageUrl: true, createdAt: true },
    });

    const photos: PublicProfileProgressPhoto[] = [];
    for (const checkIn of checkIns) {
        const url = checkIn.frontImageUrl ?? checkIn.sideImageUrl;
        if (!url) continue;
        photos.push({
            id: checkIn.id,
            url,
            loggedAt: checkIn.createdAt.toISOString(),
        });
    }
    return photos;
}

export async function buildPublicProfileData(
    targetUserId: string,
    viewerId: string
): Promise<BuiltPublicProfile | null> {
    await ensureUserProfileColumns();

    const [target, privacy, socialLinks, bannerRows, pinned] = await Promise.all([
        prisma.user.findUnique({
            where: { id: targetUserId },
            select: {
                id: true,
                name: true,
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
        getUserProfilePrivacy(targetUserId),
        getUserSocialLinks(targetUserId),
        prisma.$queryRaw<Array<{ bannerUrl: string | null }>>`
            SELECT "bannerUrl" FROM "users" WHERE "id" = ${targetUserId} LIMIT 1
        `,
        getUserPinnedExercises(targetUserId),
    ]);

    if (!target || target.isDeleted) return null;

    const bannerUrl = bannerRows[0]?.bannerUrl ?? null;
    const trainingGoal = target.goal ? (TRAINING_GOAL_LABELS[target.goal] ?? target.goal) : null;

    const sectionTasks: Promise<unknown>[] = [];
    let streak: number | null = null;
    let totalWorkouts: number | null = null;
    let bodyweightKg: number | null = null;
    let achievements: PublicAchievement[] = [];
    let personalRecords: PublicProfilePersonalRecord[] = [];
    let plans: PublicProfilePlan[] = [];
    let activityFeed: PublicProfileActivityItem[] = [];
    let progressPhotos: PublicProfileProgressPhoto[] = [];
    let mutualCoach: PublicProfileCoach | null = null;

    if (privacy.workoutStats) {
        sectionTasks.push(
            (async () => {
                const [streakValue, total] = await Promise.all([
                    getWorkoutStreak(targetUserId),
                    prisma.workoutLog.count({ where: { userId: targetUserId, status: "COMPLETED" } }),
                ]);
                streak = streakValue;
                totalWorkouts = total;
            })()
        );
    }

    if (privacy.bodyweight) {
        sectionTasks.push(
            (async () => {
                bodyweightKg = await getLatestBodyweightKg(targetUserId);
            })()
        );
    }

    if (privacy.achievements) {
        sectionTasks.push(
            (async () => {
                achievements = await getPublicAchievements(targetUserId);
            })()
        );
    }

    if (privacy.prs) {
        sectionTasks.push(
            (async () => {
                personalRecords = await getPersonalRecordsForProfile(targetUserId, pinned);
            })()
        );
    }

    if (privacy.publicPlans) {
        sectionTasks.push(
            (async () => {
                const rawPlans = await getPublicPlansForUser(targetUserId);
                plans = rawPlans.map((plan) => ({
                    id: plan.id,
                    name: plan.name,
                    description: plan.description,
                    tags: plan.tags,
                    weekCount: plan._count.weeks,
                    createdAt: plan.createdAt.toISOString(),
                }));
            })()
        );
    }

    if (privacy.activityFeed) {
        sectionTasks.push(
            (async () => {
                const logs = await prisma.workoutLog.findMany({
                    where: { userId: targetUserId, status: "COMPLETED" },
                    include: { workout: { select: { name: true } } },
                    orderBy: { loggedAt: "desc" },
                    take: 8,
                });
                activityFeed = logs.map((log) => ({
                    id: log.id,
                    label: log.workout?.name ?? "Workout completed",
                    loggedAt: log.loggedAt.toISOString(),
                }));
            })()
        );
    }

    if (privacy.progressPhotos) {
        sectionTasks.push(
            (async () => {
                progressPhotos = await getProgressPhotos(targetUserId);
            })()
        );
    }

    sectionTasks.push(
        (async () => {
            mutualCoach = await getMutualCoach(viewerId, target.coachId);
        })()
    );

    await Promise.all(sectionTasks);

    const presence = privacy.onlineStatus && target.lastActiveAt
        ? getPresenceIndicator(target.lastActiveAt)
        : null;

    const base = withResolvedAvatar({
        id: target.id,
        name: target.name ?? "Athlete",
        avatarUrl: target.avatarUrl,
        role: target.role,
        experienceLevel: target.experienceLevel ?? null,
        isPrivateProfile: target.isPrivateProfile ?? false,
        bannerUrl,
    });

    return {
        ...base,
        joinDate: formatJoinDate(target.createdAt),
        trainingGoal,
        bio: privacy.bio && target.bio?.trim() ? target.bio.trim() : null,
        streak,
        totalWorkouts,
        bodyweightKg,
        onlineStatus: presence
            ? { level: presence.level, label: presence.label }
            : null,
        mutualCoach,
        personalRecords,
        favoriteExercises: pinned,
        achievements,
        plans,
        activityFeed,
        progressPhotos,
        socialLinks: privacy.socialLinks && hasSocialLinks(socialLinks) ? socialLinks : null,
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
            _count: { select: { weeks: true } },
        },
        orderBy: { createdAt: "desc" },
    });
}
