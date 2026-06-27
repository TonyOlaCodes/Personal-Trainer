import { prisma } from "@/lib/prisma";
import { isCoachRole } from "@/lib/roles";

let profileColumnsReady = false;

export async function ensureUserProfileColumns() {
    if (profileColumnsReady) return;

    await prisma.$executeRaw`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" TEXT
    `;
    await prisma.$executeRaw`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isPrivateProfile" BOOLEAN NOT NULL DEFAULT false
    `;

    profileColumnsReady = true;
}

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
        orderBy: { createdAt: "desc" },
        take: 50,
    });

    const big3Labels: Record<string, string> = {
        "bench press": "Bench Press PR",
        squat: "Squat PR",
        deadlift: "Deadlift PR",
    };

    const seenBig3 = new Set<string>();
    for (const set of prSets) {
        const key = set.exercise.name.trim().toLowerCase();
        for (const [match, title] of Object.entries(big3Labels)) {
            if (key.includes(match) && !seenBig3.has(match)) {
                seenBig3.add(match);
                achievements.push({
                    id: `big3-${match.replace(/\s+/g, "-")}`,
                    title,
                    description: `Personal best on ${set.exercise.name}`,
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

    return plan.isPublic;
}

export async function getPublicPlansForUser(ownerUserId: string) {
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
            createdAt: true,
            _count: { select: { weeks: true } },
        },
        orderBy: { createdAt: "desc" },
    });
}
