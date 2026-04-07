import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: exerciseId } = await params;
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

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

    await prisma.exercise.delete({ where: { id: exerciseId } });
    return NextResponse.json({ success: true });
}
