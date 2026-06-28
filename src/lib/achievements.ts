import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { ensureBodyweightTable } from "@/lib/bodyweight";
import { ensureDailyMetricsTable } from "@/lib/dailyMetrics";
import { createNotification } from "@/lib/notifications";
import { NOTIFICATION_TYPES } from "@/lib/notificationTypes";
import {
    ACHIEVEMENT_DEFINITIONS,
    TOTAL_ACHIEVEMENTS,
    evaluateAchievement,
    getAchievementProgress,
    type AchievementDefinition,
    type AchievementStats,
} from "@/lib/achievementDefinitions";

export interface UserAchievementRow {
    achievementId: string;
    unlockedAt: Date;
}

export interface AchievementDisplayItem {
    id: string;
    title: string;
    description: string;
    rarity: AchievementDefinition["rarity"];
    icon: AchievementDefinition["icon"];
    unlocked: boolean;
    unlockedAt: string | null;
    progress: { current: number; target: number } | null;
}

export interface AchievementSummary {
    totalUnlocked: number;
    totalAchievements: number;
    preview: AchievementDisplayItem[];
    achievements: AchievementDisplayItem[];
}

let achievementsReady = false;

export async function ensureAchievementsTables() {
    if (achievementsReady) return;

    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "user_achievements" (
            "id" TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "achievementId" TEXT NOT NULL,
            "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE ("userId", "achievementId")
        )
    `;
    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "user_achievements_userId_idx"
        ON "user_achievements"("userId")
    `;
    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "profile_views" (
            "viewerId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "profileUserId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY ("viewerId", "profileUserId")
        )
    `;

    achievementsReady = true;
}

function computeMaxConsecutiveDays(dayTimes: number[]): number {
    if (dayTimes.length === 0) return 0;

    const unique = [...new Set(dayTimes)].sort((a, b) => b - a);
    let max = 1;
    let run = 1;

    for (let i = 1; i < unique.length; i++) {
        const diffDays = Math.round((unique[i - 1] - unique[i]) / 86400000);
        if (diffDays === 1) {
            run++;
            max = Math.max(max, run);
        } else {
            run = 1;
        }
    }

    return max;
}

async function countBodyweightLogs(userId: string): Promise<number> {
    await ensureBodyweightTable();
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM "bodyweight_logs" WHERE "userId" = ${userId}
    `;
    return Number(rows[0]?.count ?? 0);
}

async function countDailyMetricLogs(userId: string): Promise<number> {
    await ensureDailyMetricsTable();
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM "daily_metric_logs" WHERE "userId" = ${userId}
    `;
    return Number(rows[0]?.count ?? 0);
}

async function countProfileVisitsMade(userId: string): Promise<number> {
    await ensureAchievementsTables();
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM "profile_views" WHERE "viewerId" = ${userId}
    `;
    return Number(rows[0]?.count ?? 0);
}

export async function recordProfileView(viewerId: string, profileUserId: string) {
    if (viewerId === profileUserId) return;

    await ensureAchievementsTables();
    await prisma.$executeRaw`
        INSERT INTO "profile_views" ("viewerId", "profileUserId")
        VALUES (${viewerId}, ${profileUserId})
        ON CONFLICT ("viewerId", "profileUserId") DO NOTHING
    `;

    triggerAchievementSync(viewerId);
}

export async function getAchievementStats(userId: string): Promise<AchievementStats> {
    await ensureAchievementsTables();
    await ensureBodyweightTable();

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true, onboardingDone: true },
    });

    const accountAgeDays = user
        ? Math.floor((Date.now() - user.createdAt.getTime()) / 86400000)
        : 0;

    const [
        workoutLogsTotal,
        workoutsCompleted,
        checkIns,
        prCount,
        bodyweightLogs,
        completedSets,
        trainingAgg,
        hasEstimated1RM,
        messagesSent,
        plansCreated,
        publicPlans,
        plansCopied,
        plansCopiedFromUser,
        profileVisitsMade,
        dailyMetricsLogs,
        completedWorkoutDays,
        checkInDays,
        bodyweightDays,
    ] = await Promise.all([
        prisma.workoutLog.count({ where: { userId } }),
        prisma.workoutLog.count({ where: { userId, status: "COMPLETED" } }),
        prisma.checkIn.count({ where: { userId } }),
        prisma.logSet.count({
            where: { isPR: true, workoutLog: { userId, status: "COMPLETED" } },
        }),
        countBodyweightLogs(userId),
        prisma.logSet.count({
            where: {
                isWarmup: false,
                isCompleted: true,
                workoutLog: { userId, status: "COMPLETED" },
            },
        }),
        prisma.workoutLog.aggregate({
            where: { userId, status: "COMPLETED", duration: { not: null } },
            _sum: { duration: true },
        }),
        prisma.logSet.findFirst({
            where: {
                isWarmup: false,
                weightKg: { gt: 0 },
                reps: { gt: 0 },
                workoutLog: { userId, status: "COMPLETED" },
            },
            select: { id: true },
        }),
        prisma.message.count({ where: { senderId: userId, isGeneral: false } }),
        prisma.plan.count({ where: { creatorId: userId, type: "USER_CREATED" } }),
        prisma.plan.count({
            where: { creatorId: userId, type: "USER_CREATED", isPublic: true },
        }),
        prisma.plan.count({
            where: {
                creatorId: userId,
                originalCreatorId: { not: null },
                NOT: { originalCreatorId: userId },
            },
        }),
        prisma.plan.count({
            where: {
                originalCreatorId: userId,
                creatorId: { not: userId },
            },
        }),
        countProfileVisitsMade(userId),
        countDailyMetricLogs(userId),
        prisma.workoutLog.findMany({
            where: { userId, status: "COMPLETED" },
            select: { loggedAt: true },
            orderBy: { loggedAt: "desc" },
            take: 500,
        }),
        prisma.checkIn.findMany({
            where: { userId },
            select: { createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 500,
        }),
        prisma.$queryRaw<Array<{ loggedDate: Date }>>`
            SELECT "loggedDate" FROM "bodyweight_logs" WHERE "userId" = ${userId}
            ORDER BY "loggedDate" DESC LIMIT 500
        `,
    ]);

    const workoutDayTimes = completedWorkoutDays.map((l) => {
        const d = new Date(l.loggedAt);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    });

    const maxStreak = computeMaxConsecutiveDays(workoutDayTimes);

    const activeDaySet = new Set<number>();
    for (const t of workoutDayTimes) activeDaySet.add(t);
    for (const c of checkInDays) {
        const d = new Date(c.createdAt);
        d.setHours(0, 0, 0, 0);
        activeDaySet.add(d.getTime());
    }
    for (const b of bodyweightDays) {
        const d = new Date(b.loggedDate);
        d.setHours(0, 0, 0, 0);
        activeDaySet.add(d.getTime());
    }
    const maxActiveDayStreak = computeMaxConsecutiveDays([...activeDaySet]);

    return {
        workoutLogsTotal,
        workoutsCompleted,
        checkIns,
        prCount,
        bodyweightLogs,
        currentStreak: maxStreak,
        maxStreak,
        publicPlans,
        plansCreated,
        plansCopied,
        messagesSent,
        profileVisitsMade,
        plansCopiedFromUser,
        accountAgeDays,
        completedSets,
        totalTrainingMinutes: trainingAgg._sum.duration ?? 0,
        hasEstimated1RM: Boolean(hasEstimated1RM),
        maxActiveDayStreak,
        onboardingDone: user?.onboardingDone ?? false,
        dailyMetricsLogs,
    };
}

async function getUnlockedMap(userId: string): Promise<Map<string, Date>> {
    await ensureAchievementsTables();
    const rows = await prisma.$queryRaw<UserAchievementRow[]>`
        SELECT "achievementId", "unlockedAt"
        FROM "user_achievements"
        WHERE "userId" = ${userId}
    `;
    return new Map(rows.map((r) => [r.achievementId, r.unlockedAt]));
}

function buildDisplayList(
    stats: AchievementStats,
    unlocked: Map<string, Date>
): AchievementDisplayItem[] {
    return ACHIEVEMENT_DEFINITIONS.map((def) => {
        const unlockedAt = unlocked.get(def.id);
        const isUnlocked = Boolean(unlockedAt) || evaluateAchievement(def, stats);
        return {
            id: def.id,
            title: def.title,
            description: def.description,
            rarity: def.rarity,
            icon: def.icon,
            unlocked: isUnlocked,
            unlockedAt: unlockedAt?.toISOString() ?? null,
            progress: getAchievementProgress(def, stats),
        };
    });
}

export async function syncUserAchievements(userId: string): Promise<string[]> {
    await ensureAchievementsTables();

    const [stats, unlocked] = await Promise.all([
        getAchievementStats(userId),
        getUnlockedMap(userId),
    ]);

    const newlyUnlocked: string[] = [];

    for (const def of ACHIEVEMENT_DEFINITIONS) {
        if (unlocked.has(def.id)) continue;
        if (!evaluateAchievement(def, stats)) continue;

        const id = randomUUID();
        try {
            await prisma.$executeRaw`
                INSERT INTO "user_achievements" ("id", "userId", "achievementId")
                VALUES (${id}, ${userId}, ${def.id})
                ON CONFLICT ("userId", "achievementId") DO NOTHING
            `;
        } catch (err) {
            console.error("[achievements] insert failed", def.id, err);
            continue;
        }

        unlocked.set(def.id, new Date());
        newlyUnlocked.push(def.id);

        await createNotification({
            userId,
            type: NOTIFICATION_TYPES.ACHIEVEMENT_UNLOCKED,
            message: `🏆 Achievement Unlocked — ${def.title}`,
            entityType: "ACHIEVEMENT",
            entityId: def.id,
            route: `/profile/${userId}?achievements=1`,
        });
    }

    return newlyUnlocked;
}

export async function getUserAchievementsDisplay(userId: string): Promise<AchievementDisplayItem[]> {
    await syncUserAchievements(userId);
    const [stats, unlocked] = await Promise.all([
        getAchievementStats(userId),
        getUnlockedMap(userId),
    ]);
    return buildDisplayList(stats, unlocked);
}

export async function getAchievementSummary(userId: string): Promise<AchievementSummary> {
    const achievements = await getUserAchievementsDisplay(userId);
    const totalUnlocked = achievements.filter((a) => a.unlocked).length;

    return {
        totalUnlocked,
        totalAchievements: TOTAL_ACHIEVEMENTS,
        preview: achievements.slice(0, 5),
        achievements,
    };
}

export function triggerAchievementSync(userId: string) {
    void syncUserAchievements(userId).catch((err) => {
        console.error("[achievements] sync failed for", userId, err);
    });
}

export function triggerAchievementSyncForUsers(...userIds: string[]) {
    for (const userId of [...new Set(userIds.filter(Boolean))]) {
        triggerAchievementSync(userId);
    }
}
