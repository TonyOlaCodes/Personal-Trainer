import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAuthUser } from "@/lib/apiAuth";
import { isCoachRole } from "@/lib/roles";
import { serializePlanWeeksForSchedule } from "@/lib/planScheduleHistory";
import { snapshotMissedSessionsForPlanChange } from "@/lib/planMissedSessionHistory";
import { activeWorkoutWhere } from "@/lib/planWorkouts";

// POST /api/plans/activate  — set one plan as active, or pass null to deactivate all
export async function POST(req: Request) {
    const authResult = await requireAuthUser(req);
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    if (isCoachRole(user.role)) {
        return NextResponse.json(
            { error: "Coach accounts cannot activate training plans on themselves." },
            { status: 403 }
        );
    }

    const { planId, weekStartDay } = z.object({
        planId: z.string().nullable(),
        weekStartDay: z.number().int().min(0).max(6).optional().nullable(),
    }).parse(await req.json());

    // Compute the desired startedAt based on weekStartDay selection
    function nextWeekdayDate(targetDow: number): Date {
        const now = new Date();
        const jsDow = now.getDay();
        const todayMon0 = jsDow === 0 ? 6 : jsDow - 1;
        let daysUntil = targetDow - todayMon0;
        if (daysUntil < 0) daysUntil += 7;
        const target = new Date(now);
        target.setDate(now.getDate() + daysUntil);
        target.setHours(0, 0, 0, 0);
        return target;
    }
    const targetAssignment = planId
        ? await prisma.userPlan.findUnique({
            where: { userId_planId: { userId: user.id, planId } },
            select: { startedAt: true },
        })
        : null;

    if (planId) {
        if (!targetAssignment) {
            return NextResponse.json({ error: "Plan is not in your library" }, { status: 404 });
        }
    }

    const activatingPlanWeekCount = planId
        ? await prisma.planWeek.count({ where: { planId } })
        : 0;
    const isSingleWeekPlan = activatingPlanWeekCount <= 1;
    const effectiveWeekStartDay = isSingleWeekPlan ? null : weekStartDay;
    const chosenStartedAt = (effectiveWeekStartDay != null) ? nextWeekdayDate(effectiveWeekStartDay) : null;

    const previousActive = await prisma.userPlan.findFirst({
        where: { userId: user.id, isActive: true },
        select: { planId: true },
    });

    const switchingPlans = Boolean(
        planId && previousActive && previousActive.planId !== planId
    );

    const earliestCompletedLogForTarget = planId
        ? await prisma.workoutLog.findFirst({
            where: {
                userId: user.id,
                status: "COMPLETED",
                workout: { week: { planId } },
            },
            select: { loggedAt: true },
            orderBy: { loggedAt: "asc" },
        })
        : null;

    await prisma.$transaction(async (tx) => {
        if (switchingPlans && previousActive) {
            const leavingPlan = await tx.plan.findUnique({
                where: { id: previousActive.planId },
                include: {
                    weeks: {
                        include: {
                            workouts: {
                                where: activeWorkoutWhere(),
                                orderBy: { dayNumber: "asc" },
                            },
                        },
                        orderBy: { weekNumber: "asc" },
                    },
                },
            });
            if (leavingPlan) {
                const weekSnapshot = serializePlanWeeksForSchedule(leavingPlan.weeks);
                await snapshotMissedSessionsForPlanChange(tx, leavingPlan.id, weekSnapshot);
            }
        }

        await tx.userPlan.updateMany({
            where: { userId: user.id },
            data: { isActive: false },
        });

        if (planId) {
            let reactivatedStartedAt: Date;
            if (isSingleWeekPlan) {
                reactivatedStartedAt = new Date();
            } else if (chosenStartedAt) {
                reactivatedStartedAt = chosenStartedAt;
            } else {
                reactivatedStartedAt = earliestCompletedLogForTarget
                    ? new Date(Math.min(
                        targetAssignment!.startedAt.getTime(),
                        earliestCompletedLogForTarget.loggedAt.getTime()
                    ))
                    : new Date();
            }

            await tx.userPlan.update({
                where: { userId_planId: { userId: user.id, planId } },
                data: switchingPlans || chosenStartedAt || isSingleWeekPlan
                    ? { isActive: true, startedAt: reactivatedStartedAt }
                    : { isActive: true },
            });
        }
    });

    return NextResponse.json({ success: true });
}
