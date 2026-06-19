import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { CoachDashboardClient } from "./CoachDashboardClient";
import { getUserCheckInSchedule } from "@/lib/checkInSchedule";
import { getDailyMetricTargets } from "@/lib/dailyMetrics";
import { ensureBodyweightTable } from "@/lib/bodyweight";

export const metadata = { title: "Coach Dashboard" };

export default async function CoachDashboardPage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const coach = await prisma.user.findUnique({
        where: { clerkId: userId },
        include: {
            clients: {
                select: {
                    id: true, name: true, email: true, role: true, avatarUrl: true,
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

    const [recentCheckIns, bodyweightRows, availablePlans] = await Promise.all([
        prisma.checkIn.findMany({
            where: { user: { coachId: coach.id } },
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
            take: 5
        }),
        clientIds.length > 0 ? prisma.$queryRaw<Array<{ userId: string; date: string; weightKg: number }>>`
            SELECT "userId", "loggedDate"::text AS "date", "weightKg"
            FROM "bodyweight_logs"
            WHERE "userId" IN (${Prisma.join(clientIds)})
            ORDER BY "loggedDate" ASC
        ` : Promise.resolve([]),
        prisma.plan.findMany({
            where: {
                OR: [
                    { type: "PREBUILT" },
                    { creatorId: coach.id }
                ]
            },
            select: { id: true, name: true, type: true }
        })
    ]);

    const bodyweightByClientId = new Map<string, { date: string; weightKg: number }[]>();
    bodyweightRows.forEach((row) => {
        const rows = bodyweightByClientId.get(row.userId) ?? [];
        rows.push({ date: row.date, weightKg: row.weightKg });
        bodyweightByClientId.set(row.userId, rows);
    });

    const clientExtraData = await Promise.all(
        coach.clients.map(async (client) => {
            const schedule = await getUserCheckInSchedule(client.id);
            const targets = await getDailyMetricTargets(client.id);
            return {
                id: client.id,
                schedule,
                targets,
            };
        })
    );
    const extraDataByClientId = new Map(clientExtraData.map((item) => [item.id, item]));

    return (
        <>
            <TopBar title="Coach Command Centre" subtitle="Manage your stable of athletes" />
            <div className="p-6 max-w-6xl mx-auto">
                <CoachDashboardClient
                    clients={coach.clients.map(c => {
                        const extra = extraDataByClientId.get(c.id);
                        return {
                            id: c.id,
                            name: c.name || "Unnamed Client",
                            email: c.email,
                            avatarUrl: c.avatarUrl,
                            isDeleted: c.email.endsWith("@deleted.local"),
                            goal: c.goal,
                            currentWeightKg: c.weightKg,
                            targetWeightKg: c.targetWeightKg,
                            hasCheckInSchedule: extra?.schedule?.day !== null,
                            checkInSchedule: extra?.schedule ?? { day: null, frequencyWeeks: null, startDate: null },
                            targetCalories: extra?.targets?.targetCalories ?? null,
                            targetSteps: extra?.targets?.targetSteps ?? null,
                            targetSleepHours: extra?.targets?.targetSleepHours ?? null,
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
                        };
                    })}
                    recentCheckIns={recentCheckIns.map(ci => ({
                        id: ci.id,
                        clientName: ci.user.name || "Client",
                        week: ci.weekNumber,
                        date: ci.createdAt.toISOString(),
                        status: ci.coachResponse ? "Responded" : "Pending",
                    }))}
                    availablePlans={availablePlans}
                />
            </div>
        </>
    );
}
