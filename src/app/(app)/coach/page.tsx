import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { CoachDashboardClient } from "./CoachDashboardClient";
import { getUserCheckInSchedule } from "@/lib/checkInSchedule";
import { ensureBodyweightTable } from "@/lib/bodyweight";
import { ensureWorkoutNotesTable } from "@/lib/workoutNotes";

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

    await Promise.all([ensureBodyweightTable(), ensureWorkoutNotesTable()]);

    // Get recent activity across all clients
    const clientIds = coach.clients.map((client) => client.id);

    const [recentCheckIns, activePlans, bodyweightRows, recentWorkoutNotes] = await Promise.all([
        prisma.checkIn.findMany({
            where: { user: { coachId: coach.id } },
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
            take: 5
        }),
        prisma.userPlan.findMany({
            where: { isActive: true, user: { coachId: coach.id } },
            include: {
                user: { select: { id: true, name: true, email: true } },
                plan: { select: { id: true, name: true, _count: { select: { weeks: true } } } },
            },
            orderBy: { startedAt: "desc" },
        }),
        clientIds.length > 0 ? prisma.$queryRaw<Array<{ userId: string; date: string; weightKg: number }>>`
            SELECT "userId", "loggedDate"::text AS "date", "weightKg"
            FROM "bodyweight_logs"
            WHERE "userId" IN (${Prisma.join(clientIds)})
            ORDER BY "loggedDate" ASC
        ` : Promise.resolve([]),
        prisma.$queryRaw<Array<{ id: string; workoutLogId: string; text: string; createdAt: Date; clientName: string | null; workoutName: string }>>`
            SELECT
                wn."id",
                wn."workoutLogId",
                wn."text",
                wn."createdAt",
                u."name" AS "clientName",
                w."name" AS "workoutName"
            FROM "workout_notes" wn
            JOIN "workout_logs" wl ON wl."id" = wn."workoutLogId"
            JOIN "users" u ON u."id" = wl."userId"
            JOIN "workouts" w ON w."id" = wl."workoutId"
            WHERE wn."coachId" = ${coach.id}
            ORDER BY wn."createdAt" DESC
            LIMIT 8
        `,
    ]);

    const bodyweightByClientId = new Map<string, { date: string; weightKg: number }[]>();
    bodyweightRows.forEach((row) => {
        const rows = bodyweightByClientId.get(row.userId) ?? [];
        rows.push({ date: row.date, weightKg: row.weightKg });
        bodyweightByClientId.set(row.userId, rows);
    });

    const currentWeekForPlan = (startedAt: Date, totalWeeks: number) => {
        const elapsedDays = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / (1000 * 60 * 60 * 24)));
        return Math.min(Math.max(1, Math.floor(elapsedDays / 7) + 1), Math.max(1, totalWeeks));
    };

    const clientSchedules = await Promise.all(
        coach.clients.map(async (client) => ({
            id: client.id,
            schedule: await getUserCheckInSchedule(client.id),
        }))
    );
    const scheduleByClientId = new Map(clientSchedules.map((item) => [item.id, item.schedule]));

    return (
        <>
            <TopBar title="Coach Command Centre" subtitle="Manage your stable of athletes" />
            <div className="p-6 max-w-6xl mx-auto">
                <CoachDashboardClient
                    clients={coach.clients.map(c => ({
                        id: c.id,
                        name: c.name || "Unnamed Client",
                        email: c.email,
                        avatarUrl: c.avatarUrl,
                        isDeleted: c.email.endsWith("@deleted.local"),
                        goal: c.goal,
                        currentWeightKg: c.weightKg,
                        targetWeightKg: c.targetWeightKg,
                        hasCheckInSchedule: scheduleByClientId.get(c.id)?.day !== null,
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
                    }))}
                    activePlans={activePlans.map((up) => ({
                        id: up.id,
                        clientId: up.user.id,
                        clientName: up.user.name || up.user.email,
                        planId: up.plan.id,
                        planName: up.plan.name,
                        currentWeek: currentWeekForPlan(up.startedAt, up.plan._count.weeks),
                    }))}
                    recentWorkoutNotes={recentWorkoutNotes.map((note) => ({
                        id: note.id,
                        workoutLogId: note.workoutLogId,
                        text: note.text,
                        createdAt: note.createdAt.toISOString(),
                        clientName: note.clientName || "Client",
                        workoutName: note.workoutName,
                    }))}
                    recentCheckIns={recentCheckIns.map(ci => ({
                        id: ci.id,
                        clientName: ci.user.name || "Client",
                        week: ci.weekNumber,
                        date: ci.createdAt.toISOString(),
                        status: ci.coachResponse ? "Responded" : "Pending",
                        lastUpdatedByClientAt: ci.lastUpdatedByClientAt?.toISOString() || null,
                        coachLastSeenAt: ci.coachLastSeenAt?.toISOString() || null
                    }))}
                />
            </div>
        </>
    );
}
