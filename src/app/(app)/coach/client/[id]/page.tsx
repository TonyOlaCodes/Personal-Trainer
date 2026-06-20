import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { ClientDetailView } from "./ClientDetailView";
import { getUserCheckInSchedule } from "@/lib/checkInSchedule";
import { getDailyMetricTargets } from "@/lib/dailyMetrics";
import { calculateOneRM } from "@/lib/utils";

import { SafeFallback, rethrowNextInternalErrors } from "@/components/shared/SafeFallback";
import { formatErrorDetails } from "@/lib/ensureAppSchema";
import { dedupeCoachPlansByName } from "@/lib/coachPlans";

export const metadata = { title: "Client Details" };

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { userId } = await auth();
        if (!userId) redirect("/sign-in");

        const actor = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (!actor || !["COACH", "SUPER_ADMIN"].includes(actor.role)) redirect("/dashboard");

        const target = await prisma.user.findUnique({
            where: { id },
            include: {
                workoutLogs: {
                    include: { workout: { select: { name: true } }, sets: true },
                    orderBy: { loggedAt: "desc" },
                    take: 40,
                },
                checkIns: { orderBy: { createdAt: "desc" }, take: 5 },
                plans: { where: { isActive: true }, include: { plan: true }, take: 1 },
                coach: { select: { name: true, email: true } },
            },
        });

        if (!target) notFound();
        if (actor.role === "COACH" && target.coachId !== actor.id) {
            redirect("/coach");
        }
        const isInactiveClient =
            target.isDeleted ||
            target.isDeactivated ||
            target.email.endsWith("@deleted.local");

        const [activePlan, availablePlans, checkInSchedule, bodyweightRows, workoutNotesRows, completedLogs, clientMetricTargets] = await Promise.all([
            Promise.resolve(target.plans[0]?.plan ?? null),
            prisma.plan.findMany({
                where: { creatorId: actor.id },
                select: { id: true, name: true, type: true, updatedAt: true },
                orderBy: { updatedAt: "desc" },
            }).then((plans) => dedupeCoachPlansByName(plans).map(({ updatedAt: _updatedAt, ...plan }) => plan)),
            getUserCheckInSchedule(target.id),
            prisma.$queryRaw<Array<{ date: string; weightKg: number }>>`
                SELECT "loggedDate"::text AS "date", "weightKg"
                FROM "bodyweight_logs"
                WHERE "userId" = ${target.id}
                ORDER BY "loggedDate" ASC
            `,
            prisma.$queryRaw<Array<{ id: string; workoutLogId: string; text: string; createdAt: Date; workoutName: string }>>`
                SELECT
                    wn."id",
                    wn."workoutLogId",
                    wn."text",
                    wn."createdAt",
                    w."name" AS "workoutName"
                FROM "workout_notes" wn
                JOIN "workout_logs" wl ON wl."id" = wn."workoutLogId"
                JOIN "workouts" w ON w."id" = wl."workoutId"
                WHERE wl."userId" = ${target.id}
                ORDER BY wn."createdAt" DESC
            `,
            prisma.workoutLog.findMany({
                where: { userId: target.id, status: "COMPLETED" },
                include: {
                    workout: { select: { name: true } },
                    sets: {
                        include: {
                            exercise: { select: { name: true, muscleGroup: true } }
                        },
                        orderBy: { setNumber: "asc" }
                    }
                },
                orderBy: { loggedAt: "asc" }
            }),
            getDailyMetricTargets(target.id)
        ]);

        const exerciseHistory: Record<string, any[]> = {};
        const exerciseLastDone: Record<string, number> = {};

        (completedLogs ?? []).forEach(log => {
            const dateStr = log.loggedAt ? log.loggedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
            const logTime = log.loggedAt ? log.loggedAt.getTime() : 0;
            
            (log.sets ?? []).forEach((set: any) => {
                if (!set.exercise || !set.isCompleted) return;
                const exName = set.exercise.name;
                const sWeight = set.weightKg || 0;
                const sReps = set.reps || 0;
                const sVol = sWeight * sReps;
                const currentOneRM = calculateOneRM(sWeight, sReps);
                
                exerciseLastDone[exName] = Math.max(exerciseLastDone[exName] || 0, logTime);
                
                if (!exerciseHistory[exName]) exerciseHistory[exName] = [];
                const existingSession = exerciseHistory[exName].find((h: any) => h.date === dateStr);
                if (existingSession) {
                    if (sWeight > existingSession.weight) { 
                        existingSession.weight = sWeight; 
                        existingSession.reps = sReps; 
                    }
                    if (currentOneRM > (existingSession.oneRM || 0)) {
                        existingSession.oneRM = currentOneRM;
                    }
                    existingSession.volume += sVol;
                } else {
                    exerciseHistory[exName].push({ date: dateStr, weight: sWeight, reps: sReps, volume: sVol, oneRM: currentOneRM });
                }
            });
        });

        // Dynamic Adherence and Trend Calculation
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

        const completedLast30Days = (completedLogs ?? []).filter(log => log.loggedAt && log.loggedAt >= thirtyDaysAgo).length;
        const expectedLast30Days = Math.round(((target.trainingDaysPerWeek ?? 3) * 30) / 7);
        const adherencePercentage = expectedLast30Days > 0 
            ? Math.min(100, Math.round((completedLast30Days / expectedLast30Days) * 100))
            : 100;

        const w1 = (completedLogs ?? []).filter(log => log.loggedAt && log.loggedAt >= fifteenDaysAgo).length;
        const w2 = (completedLogs ?? []).filter(log => log.loggedAt && log.loggedAt >= thirtyDaysAgo && log.loggedAt < fifteenDaysAgo).length;
        const adherenceTrend = w1 > w2 ? "UP" : w1 < w2 ? "DOWN" : "STABLE";

        return (
            <>
                <TopBar
                    title={isInactiveClient ? "Inactive account" : target.name || "Client Details"}
                    subtitle={isInactiveClient ? "This account is deleted or deactivated — view only." : target.email}
                    hideSearch={true}
                />
                <div className="p-6 max-w-5xl mx-auto">
                    <ClientDetailView
                        readOnly={isInactiveClient}
                        client={{
                            id: target.id,
                            name: isInactiveClient ? "Inactive account" : target.name,
                            email: isInactiveClient ? "View only" : target.email,
                            role: target.role,
                            assignedCoachName: actor.role === "SUPER_ADMIN" ? target.coach?.name ?? target.coach?.email ?? null : null,
                            avatarUrl: target.avatarUrl,
                            activePlan: activePlan ? { id: activePlan.id, name: activePlan.name } : null,
                            experience: target.experienceLevel,
                            goal: target.goal,
                            trainingLocation: target.trainingLocation,
                            trainingDaysPerWeek: target.trainingDaysPerWeek,
                            checkInSchedule,
                            targetWeightKg: target.targetWeightKg,
                            currentWeightKg: target.weightKg,
                            adherencePercentage,
                            adherenceTrend,
                            lastActiveAt: target.lastActiveAt?.toISOString() || null,
                            hiddenGoals: target.hiddenGoals ?? [],
                            targetCalories: clientMetricTargets.targetCalories,
                            targetSteps: clientMetricTargets.targetSteps,
                            targetSleepHours: clientMetricTargets.targetSleepHours,
                        }}
                        currentUserId={actor.id}
                        availablePlans={availablePlans}
                        logs={(completedLogs ?? [])
                            .slice()
                            .sort((a, b) => (b.loggedAt?.getTime() ?? 0) - (a.loggedAt?.getTime() ?? 0))
                            .map((l) => ({
                                id: l.id,
                                workoutName: l.workout.name,
                                date: l.loggedAt ? l.loggedAt.toISOString() : new Date().toISOString(),
                                setCount: (l.sets ?? []).filter((s) => s.isCompleted).length,
                            }))}
                        checkIns={(target.checkIns ?? []).map((ci) => ({
                            id: ci.id,
                            week: ci.weekNumber,
                            date: ci.createdAt ? ci.createdAt.toISOString() : new Date().toISOString(),
                            status: ci.coachResponse ? "Responded" : "Pending",
                        }))}
                        bodyweightHistory={bodyweightRows || []}
                        workoutNotes={(workoutNotesRows || []).map(n => ({
                            id: n.id,
                            workoutLogId: n.workoutLogId,
                            text: n.text,
                            createdAt: n.createdAt ? n.createdAt.toISOString() : new Date().toISOString(),
                            workoutName: n.workoutName,
                        }))}
                        workoutHistory={(target.workoutLogs ?? []).map((l) => ({
                            id: l.id,
                            workoutName: l.workout.name,
                            date: l.loggedAt ? l.loggedAt.toISOString() : new Date().toISOString(),
                            duration: l.duration || 0,
                            volume: (l.sets ?? []).reduce((sum: number, s: any) => sum + (s.reps || 0) * (s.weightKg || 0), 0),
                        }))}
                        exerciseHistory={exerciseHistory}
                        exerciseLastDone={exerciseLastDone}
                    />
                </div>
            </>
        );
    } catch (e) {
        rethrowNextInternalErrors(e);
        console.error("[ClientDetailPage] Error:", e);
        return <SafeFallback title="Client Details" errorDetails={formatErrorDetails(e)} />;
    }
}
