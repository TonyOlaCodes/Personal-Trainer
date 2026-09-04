import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/apiAuth";
import { countLogSetsForExercise, DataSafetyError, softHideExercise } from "@/lib/dataSafety";

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireActiveUser(req);
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id: exerciseId } = await params;

    const exercise = await prisma.exercise.findUnique({
        where: { id: exerciseId },
        include: { workout: { include: { week: { include: { plan: true } } } } },
    });

    if (!exercise) return NextResponse.json({ error: "Exercise not found" }, { status: 404 });

    const plan = exercise.workout.week.plan;

    // Permissions: Plan creator, Admin, or the Coach of whoever is assigned this plan,
    // OR the person assigned the plan if we want to allow clients to customize their plan.
    const isOwner = plan.creatorId === user.id;
    const isAdmin = user.role === "SUPER_ADMIN";
    
    let isAllowed = isOwner || isAdmin;

    if (!isAllowed) {
        const userPlan = await prisma.userPlan.findFirst({
            where: { planId: plan.id, userId: user.id }
        });
        if (userPlan) isAllowed = true;
    }

    if (!isAllowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const logSetCount = await countLogSetsForExercise(exerciseId);
    if (logSetCount > 0) {
        await softHideExercise(exerciseId);
        return NextResponse.json({
            success: true,
            softDeleted: true,
            message: DataSafetyError.exerciseHasHistory,
        });
    }

    await prisma.exercise.delete({ where: { id: exerciseId } });
    return NextResponse.json({ success: true });
}
