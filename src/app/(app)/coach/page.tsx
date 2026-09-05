import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { CoachDashboardClient } from "./CoachDashboardClient";
import { getUserCheckInSchedule } from "@/lib/checkInSchedule";
import { getClientGoalTargets } from "@/lib/clientGoalTargets";
import { ensureBodyweightTable } from "@/lib/bodyweight";
import { dedupeCoachPlansByName, normalizePlanIdForPicker } from "@/lib/coachPlans";
import { getActiveSessionsForClients } from "@/lib/coachChat";
import { loadCoachDashboardInsights } from "@/lib/coachDashboardInsights";
import { loadNicknameMap, pickDisplayName } from "@/lib/userNicknames";

export const metadata = { title: "Coach Dashboard" };

export default async function CoachDashboardPage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const coach = await prisma.user.findUnique({
        where: { clerkId: userId },
        include: {
            clients: {
                where: {
                    isDeleted: false,
                    isDeactivated: false,
                    NOT: { email: { endsWith: "@deleted.local" } },
                },
                select: {
                    id: true, name: true, email: true, role: true, avatarUrl: true,
                    isDeleted: true, isDeactivated: true, lastActiveAt: true,
                    isCoachPaused: true, coachPausedAt: true, coachResumedAt: true,
                    goal: true, targetWeightKg: true, weightKg: true,
                    workoutLogs: {
                        where: { status: "COMPLETED" },
                        select: {
                            id: true,
                            loggedAt: true,
                            workout: { select: { name: true } },
                            sets: { select: { id: true } },
                        },
                        orderBy: { loggedAt: "desc" },
                        take: 12,
                    },
                    checkIns: {
                        select: { id: true, createdAt: true, weekNumber: true, bodyweightKg: true, status: true },
                        orderBy: { createdAt: "desc" },
                        take: 12,
                    },
                    _count: { select: { workoutLogs: true, checkIns: true } }
                }
            }
        }
    });

    if (!coach || !["COACH", "SUPER_ADMIN"].includes(coach.role)) {
        redirect("/dashboard");
    }

    await ensureBodyweightTable();

    const clientIds = coach.clients.map((client) => client.id);

    const [recentCheckIns, pendingReviews, bodyweightRows, allCoachPlans, activeClientPlans, inviteClientPlans] = await Promise.all([
        prisma.checkIn.findMany({
            where: {
                user: {
                    coachId: coach.id,
                    isDeleted: false,
                    isDeactivated: false,
                    NOT: { email: { endsWith: "@deleted.local" } },
                },
            },
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
            take: 5
        }),
        prisma.checkIn.findMany({
            where: {
                status: "PENDING",
                user: {
                    coachId: coach.id,
                    isDeleted: false,
                    isDeactivated: false,
                },
            },
            include: {
                user: { select: { id: true, name: true, avatarUrl: true } },
            },
            orderBy: { createdAt: "desc" },
        }),
        clientIds.length > 0 ? prisma.$queryRaw<Array<{ userId: string; date: string; weightKg: number }>>`
            SELECT "userId", "loggedDate"::text AS "date", "weightKg"
            FROM "bodyweight_logs"
            WHERE "userId" IN (${Prisma.join(clientIds)})
            ORDER BY "loggedDate" ASC
        ` : Promise.resolve([]),
        prisma.plan.findMany({
            where: { creatorId: coach.id },
            select: { id: true, name: true, type: true, updatedAt: true },
            orderBy: { updatedAt: "desc" },
        }),
        clientIds.length > 0
            ? prisma.userPlan.findMany({
                where: { userId: { in: clientIds }, isActive: true },
                select: { userId: true, planId: true },
            })
            : Promise.resolve([]),
        clientIds.length > 0
            ? prisma.accessCode.findMany({
                where: { usedById: { in: clientIds }, planId: { not: null } },
                select: { usedById: true, planId: true },
                orderBy: { usedAt: "desc" },
            })
            : Promise.resolve([]),
    ]);

    const availablePlans = dedupeCoachPlansByName(allCoachPlans).map(({ updatedAt: _updatedAt, ...plan }) => plan);

    const suggestedPlanByClientId = new Map<string, string>();
    for (const row of inviteClientPlans) {
        if (row.usedById && row.planId) {
            suggestedPlanByClientId.set(row.usedById, row.planId);
        }
    }
    for (const row of activeClientPlans) {
        if (row.planId) {
            suggestedPlanByClientId.set(row.userId, row.planId);
        }
    }

    const bodyweightByClientId = new Map<string, { date: string; weightKg: number }[]>();
    bodyweightRows.forEach((row) => {
        const rows = bodyweightByClientId.get(row.userId) ?? [];
        rows.push({ date: row.date, weightKg: row.weightKg });
        bodyweightByClientId.set(row.userId, rows);
    });

    const clientExtraData = await Promise.all(
        coach.clients.map(async (client) => {
            const schedule = await getUserCheckInSchedule(client.id);
            const targets = await getClientGoalTargets(client.id);
            return {
                id: client.id,
                schedule,
                targets,
            };
        })
    );
    const extraDataByClientId = new Map(clientExtraData.map((item) => [item.id, item]));
    const activeSessions = await getActiveSessionsForClients(clientIds);

    const checkInLookback = new Date();
    checkInLookback.setDate(checkInLookback.getDate() - 90);
    const periodCheckIns = clientIds.length > 0
        ? await prisma.checkIn.findMany({
            where: { userId: { in: clientIds }, createdAt: { gte: checkInLookback } },
            select: { userId: true, weekNumber: true, periodDueDateKey: true },
        })
        : [];
    const recentCheckInWeeksByUserId = new Map<string, number[]>();
    const recentCheckInPeriodKeysByUserId = new Map<string, Array<string | null>>();
    for (const row of periodCheckIns) {
        const weeks = recentCheckInWeeksByUserId.get(row.userId) ?? [];
        weeks.push(row.weekNumber);
        recentCheckInWeeksByUserId.set(row.userId, weeks);
        const keys = recentCheckInPeriodKeysByUserId.get(row.userId) ?? [];
        keys.push(row.periodDueDateKey ?? null);
        recentCheckInPeriodKeysByUserId.set(row.userId, keys);
    }

    const clientNicknameMap = await loadNicknameMap(coach.id, clientIds);
    const clientLabel = (client: { id: string; name: string | null; email: string }) =>
        pickDisplayName(client.name, client.email, clientNicknameMap.get(client.id), "Unnamed Client");

    const insights = await loadCoachDashboardInsights({
        coachId: coach.id,
        clients: coach.clients.map((client) => {
            const extra = extraDataByClientId.get(client.id);
            return {
                id: client.id,
                name: clientLabel(client),
                isDeleted: false,
                isDeactivated: false,
                email: client.email,
                lastActiveAt: client.lastActiveAt,
                hasCheckInSchedule: extra?.schedule?.day !== null,
                checkInSchedule: extra?.schedule ?? { day: null, frequencyWeeks: null, startDate: null },
                recentCheckInWeekNumbers: recentCheckInWeeksByUserId.get(client.id) ?? [],
                recentCheckInPeriodKeys: recentCheckInPeriodKeysByUserId.get(client.id) ?? [],
                isCoachPaused: Boolean(client.isCoachPaused),
                coachResumedAt: client.coachResumedAt ?? null,
                activeSession: activeSessions[client.id] ?? null,
            };
        }),
        pendingReviewCount: pendingReviews.length,
        pendingReviewClientIds: [...new Set(pendingReviews.map((row) => row.user.id))],
        activeSessions,
    });

    return (
        <>
            <TopBar title="Coach Command Centre" subtitle="Manage your clients" />
            <div className="p-6 max-w-6xl mx-auto">
                <CoachDashboardClient
                    clients={coach.clients.map(c => {
                        const extra = extraDataByClientId.get(c.id);
                        return {
                            id: c.id,
                            name: clientLabel(c),
                            email: c.email,
                            avatarUrl: c.avatarUrl,
                            lastActiveAt: c.lastActiveAt?.toISOString() ?? null,
                            isCoachPaused: Boolean(c.isCoachPaused),
                            goal: c.goal,
                            currentWeightKg: c.weightKg,
                            targetWeightKg: c.targetWeightKg,
                            hasCheckInSchedule: extra?.schedule?.day !== null,
                            checkInSchedule: extra?.schedule ?? { day: null, frequencyWeeks: null, startDate: null },
                            targetCalories: extra?.targets?.targetCalories ?? null,
                            targetSteps: extra?.targets?.targetSteps ?? null,
                            targetSleepHours: extra?.targets?.targetSleepHours ?? null,
                            suggestedPlanId: normalizePlanIdForPicker(
                                suggestedPlanByClientId.get(c.id),
                                allCoachPlans,
                                availablePlans
                            ) || null,
                            stats: { logs: c._count.workoutLogs, checkins: c._count.checkIns },
                            recentLogs: c.workoutLogs.map((log) => ({
                                id: log.id,
                                workoutName: log.workout.name,
                                date: log.loggedAt.toISOString(),
                                setCount: log.sets.length,
                            })),
                            recentCheckIns: c.checkIns.map((checkIn) => ({
                                id: checkIn.id,
                                week: checkIn.weekNumber,
                                date: checkIn.createdAt.toISOString(),
                                status: checkIn.status,
                                bodyweightKg: checkIn.bodyweightKg,
                            })),
                            bodyweightHistory: bodyweightByClientId.get(c.id) ?? [],
                            activeSession: activeSessions[c.id] ?? null,
                        };
                    })}
                    recentCheckIns={recentCheckIns.map(ci => ({
                        id: ci.id,
                        clientName: clientLabel(ci.user),
                        week: ci.weekNumber,
                        date: ci.createdAt.toISOString(),
                        status: ci.coachResponse ? "Responded" : "Pending",
                    }))}
                    pendingReviews={pendingReviews.map((ci) => ({
                        id: ci.id,
                        clientId: ci.user.id,
                        clientName: clientLabel(ci.user),
                        avatarUrl: ci.user.avatarUrl,
                        week: ci.weekNumber,
                        date: ci.createdAt.toISOString(),
                    }))}
                    availablePlans={availablePlans}
                    insights={insights}
                />
            </div>
        </>
    );
}
