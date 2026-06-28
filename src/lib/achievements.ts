import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { ensureBodyweightTable } from "@/lib/bodyweight";
import { ensureDailyMetricsTable } from "@/lib/dailyMetrics";
import { createNotification, ensureNotificationsTable } from "@/lib/notifications";
import { NOTIFICATION_TYPES } from "@/lib/notificationTypes";
import {
    ACHIEVEMENT_DEFINITIONS,
    TOTAL_CLIENT_ACHIEVEMENTS,
    evaluateAchievement,
    getAchievementProgress,
    type AchievementDefinition,
    type AchievementStats,
} from "@/lib/achievementDefinitions";
import {
    COACH_ACHIEVEMENT_DEFINITIONS,
    TOTAL_COACH_ACHIEVEMENTS,
    evaluateCoachAchievement,
    getCoachAchievementProgress,
    type CoachAchievementDefinition,
    type CoachAchievementStats,
} from "@/lib/coachAchievementDefinitions";
import { ensureCoachAttentionActionsTable } from "@/lib/coachAttentionActions";
import { ensureMessageActionColumns } from "@/lib/coachChat";
import { ensureWorkoutNotesTable } from "@/lib/workoutNotes";
import { isCoachRole } from "@/lib/roles";
import { getWorkoutAdherenceForUser } from "@/lib/workoutAdherenceStreak";

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

export function isCoachAchievementId(id: string): boolean {
    return id.startsWith("coach-");
}

export function getAchievementCatalogForRole(role: string): Array<AchievementDefinition | CoachAchievementDefinition> {
    if (isCoachRole(role)) return COACH_ACHIEVEMENT_DEFINITIONS;
    return ACHIEVEMENT_DEFINITIONS;
}

export function getTotalAchievementsForRole(role: string): number {
    if (isCoachRole(role)) return TOTAL_COACH_ACHIEVEMENTS;
    return TOTAL_CLIENT_ACHIEVEMENTS;
}

async function getUserRole(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
    });
    return user?.role ?? "FREE";
}

let achievementsReady = false;
const syncInFlight = new Map<string, Promise<string[]>>();

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
    ]);

    const adherence = await getWorkoutAdherenceForUser(userId);

    return {
        workoutLogsTotal,
        workoutsCompleted,
        checkIns,
        prCount,
        bodyweightLogs,
        maxAdherenceStreak: adherence.maxStreak,
        perfectWeeks: adherence.perfectWeeks,
        scheduledHits: adherence.scheduledHits,
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
        onboardingDone: user?.onboardingDone ?? false,
        dailyMetricsLogs,
    };
}

export async function getCoachAchievementStats(coachId: string): Promise<CoachAchievementStats> {
    await ensureAchievementsTables();
    await ensureMessageActionColumns();
    await ensureWorkoutNotesTable();
    await ensureCoachAttentionActionsTable();

    const user = await prisma.user.findUnique({
        where: { id: coachId },
        select: { createdAt: true },
    });

    const coachAccountAgeDays = user
        ? Math.floor((Date.now() - user.createdAt.getTime()) / 86400000)
        : 0;

    const clientWhere = {
        coachId,
        isDeleted: false,
        isDeactivated: false,
    };

    const [
        activeClients,
        checkInsReviewed,
        plansCreated,
        plansAssigned,
        workoutNotes,
        accessCodesGenerated,
        accessCodesRedeemed,
        clientMessages,
        videoCheckInReviews,
        attentionRows,
    ] = await Promise.all([
        prisma.user.count({ where: clientWhere }),
        prisma.checkIn.count({
            where: {
                user: { coachId },
                status: "REVIEWED",
                respondedAt: { not: null },
            },
        }),
        prisma.plan.count({ where: { creatorId: coachId } }),
        prisma.userPlan.count({
            where: {
                user: { coachId },
            },
        }),
        prisma.workoutNote.count({ where: { coachId } }),
        prisma.accessCode.count({ where: { generatedBy: coachId } }),
        prisma.accessCode.count({
            where: {
                generatedBy: coachId,
                usedById: { not: null },
            },
        }),
        prisma.user.findMany({
            where: clientWhere,
            select: { id: true },
        }).then((clients) =>
            clients.length === 0
                ? 0
                : prisma.message.count({
                    where: {
                        senderId: coachId,
                        isGeneral: false,
                        receiverId: { in: clients.map((client) => client.id) },
                    },
                })
        ),
        prisma.checkIn.count({
            where: {
                user: { coachId },
                coachVideoUrl: { not: null },
            },
        }),
        prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*)::bigint AS count
            FROM "coach_attention_actions"
            WHERE "coachId" = ${coachId}
        `,
    ]);

    return {
        activeClients,
        checkInsReviewed,
        plansCreated,
        plansAssigned,
        workoutNotes,
        accessCodesGenerated,
        accessCodesRedeemed,
        clientMessages,
        attentionActions: Number(attentionRows[0]?.count ?? 0),
        videoCheckInReviews,
        coachAccountAgeDays,
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

function buildClientDisplayList(
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

function buildCoachDisplayList(
    stats: CoachAchievementStats,
    unlocked: Map<string, Date>
): AchievementDisplayItem[] {
    return COACH_ACHIEVEMENT_DEFINITIONS.map((def) => {
        const unlockedAt = unlocked.get(def.id);
        const isUnlocked = Boolean(unlockedAt) || evaluateCoachAchievement(def, stats);
        return {
            id: def.id,
            title: def.title,
            description: def.description,
            rarity: def.rarity,
            icon: def.icon,
            unlocked: isUnlocked,
            unlockedAt: unlockedAt?.toISOString() ?? null,
            progress: getCoachAchievementProgress(def, stats),
        };
    });
}

/** Most recently unlocked achievements for profile preview. */
export function getRecentAchievementPreview(
    achievements: AchievementDisplayItem[],
    limit = 3
): AchievementDisplayItem[] {
    return achievements
        .filter((item) => item.unlocked)
        .sort((a, b) => {
            const aTime = a.unlockedAt ? new Date(a.unlockedAt).getTime() : 0;
            const bTime = b.unlockedAt ? new Date(b.unlockedAt).getTime() : 0;
            return bTime - aTime;
        })
        .slice(0, limit);
}

export async function syncUserAchievements(userId: string): Promise<string[]> {
    const inFlight = syncInFlight.get(userId);
    if (inFlight) return inFlight;

    const run = doSyncUserAchievements(userId).finally(() => {
        syncInFlight.delete(userId);
    });
    syncInFlight.set(userId, run);
    return run;
}

async function doSyncUserAchievements(userId: string): Promise<string[]> {
    await ensureAchievementsTables();

    const role = await getUserRole(userId);
    const unlocked = await getUnlockedMap(userId);
    const newlyUnlocked: string[] = [];

    if (isCoachRole(role)) {
        const stats = await getCoachAchievementStats(userId);

        for (const def of COACH_ACHIEVEMENT_DEFINITIONS) {
            if (unlocked.has(def.id)) continue;
            if (!evaluateCoachAchievement(def, stats)) continue;

            const inserted = await insertAchievementUnlock(userId, def.id, unlocked);
            if (!inserted) continue;

            newlyUnlocked.push(def.id);
            await notifyAchievementUnlock(userId, def.id, def.title);
        }

        return newlyUnlocked;
    }

    const stats = await getAchievementStats(userId);

    for (const def of ACHIEVEMENT_DEFINITIONS) {
        if (unlocked.has(def.id)) continue;
        if (!evaluateAchievement(def, stats)) continue;

        const inserted = await insertAchievementUnlock(userId, def.id, unlocked);
        if (!inserted) continue;

        newlyUnlocked.push(def.id);
        await notifyAchievementUnlock(userId, def.id, def.title);
    }

    return newlyUnlocked;
}

async function insertAchievementUnlock(
    userId: string,
    achievementId: string,
    unlocked: Map<string, Date>
): Promise<boolean> {
    const id = randomUUID();
    try {
        const rows = await prisma.$queryRaw<Array<{ id: string }>>`
            INSERT INTO "user_achievements" ("id", "userId", "achievementId")
            VALUES (${id}, ${userId}, ${achievementId})
            ON CONFLICT ("userId", "achievementId") DO NOTHING
            RETURNING "id"
        `;
        if (rows.length === 0) return false;
        unlocked.set(achievementId, new Date());
        return true;
    } catch (err) {
        console.error("[achievements] insert failed", achievementId, err);
        return false;
    }
}

async function notifyAchievementUnlock(userId: string, achievementId: string, title: string) {
    await ensureNotificationsTable();
    const existingNotification = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "notifications"
        WHERE "userId" = ${userId}
          AND "type" = ${NOTIFICATION_TYPES.ACHIEVEMENT_UNLOCKED}
          AND "entityId" = ${achievementId}
        LIMIT 1
    `;
    if (existingNotification.length > 0) return;

    await createNotification({
        userId,
        type: NOTIFICATION_TYPES.ACHIEVEMENT_UNLOCKED,
        message: `🏆 Achievement Unlocked — ${title}`,
        entityType: "ACHIEVEMENT",
        entityId: achievementId,
        route: `/profile/${userId}?achievements=1`,
    });
}

export async function getUserAchievementsDisplay(userId: string): Promise<AchievementDisplayItem[]> {
    await syncUserAchievements(userId);
    const role = await getUserRole(userId);
    const unlocked = await getUnlockedMap(userId);

    if (isCoachRole(role)) {
        const stats = await getCoachAchievementStats(userId);
        return buildCoachDisplayList(stats, unlocked);
    }

    const stats = await getAchievementStats(userId);
    return buildClientDisplayList(stats, unlocked);
}

export async function getAchievementSummary(userId: string): Promise<AchievementSummary> {
    const role = await getUserRole(userId);
    const achievements = await getUserAchievementsDisplay(userId);
    const totalUnlocked = achievements.filter((a) => a.unlocked).length;

    return {
        totalUnlocked,
        totalAchievements: getTotalAchievementsForRole(role),
        preview: getRecentAchievementPreview(achievements, 3),
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
