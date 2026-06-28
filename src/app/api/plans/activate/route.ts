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

    const { planId } = z.object({ planId: z.string().nullable() }).parse(await req.json());

    if (planId) {
        const assignment = await prisma.userPlan.findUnique({
            where: { userId_planId: { userId: user.id, planId } },
        });
        if (!assignment) {
            return NextResponse.json({ error: "Plan is not in your library" }, { status: 404 });
        }
    }

    const previousActive = await prisma.userPlan.findFirst({
        where: { userId: user.id, isActive: true },
        select: { planId: true },
    });

    const switchingPlans = Boolean(
        planId && previousActive && previousActive.planId !== planId
    );

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
            await tx.userPlan.update({
                where: { userId_planId: { userId: user.id, planId } },
                data: switchingPlans
                    ? { isActive: true, startedAt: new Date() }
                    : { isActive: true },
            });
        }
    });

    return NextResponse.json({ success: true });
}
