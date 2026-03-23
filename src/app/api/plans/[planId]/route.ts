import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ planId: string }> }
) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { planId } = await params;
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const plan = await prisma.plan.findUnique({
        where: { id: planId },
        include: {
            weeks: {
                orderBy: { weekNumber: "asc" },
                include: {
                    workouts: {
                        orderBy: { dayNumber: "asc" },
                        include: { exercises: { orderBy: { order: "asc" } } },
                    },
                },
            },
        },
    });

    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    // Auth check: Creator, Admin, or the Coach of whoever is assigned this plan
    const isOwner = plan.creatorId === user.id;
    const isAdmin = user.role === "SUPER_ADMIN";
    
    if (!isOwner && !isAdmin) {
        // Check if any user assigned this plan is a client of the requester
        const isCoachOfAssignee = await prisma.userPlan.findFirst({
            where: { 
                planId: plan.id,
                user: { coachId: user.id }
            }
        });

        // Also check if the requester is the person assigned the plan
        const isAssignee = await prisma.userPlan.findFirst({
            where: { planId: plan.id, userId: user.id }
        });

        if (!isCoachOfAssignee && !isAssignee) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
    }

    return NextResponse.json(plan);
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ planId: string }> }
) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { planId } = await params;
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const { name, description, weeks } = body;

    const existing = await prisma.plan.findUnique({
        where: { id: planId },
        select: { creatorId: true }
    });

    if (!existing) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    const isOwner = existing.creatorId === user.id;
    const isAdmin = user.role === "SUPER_ADMIN";
    
    if (!isOwner && !isAdmin) {
        // Allow coach to edit if they are the coach of the person with this plan
        const isCoachOfAssignee = await prisma.userPlan.findFirst({
            where: { 
                planId: planId,
                user: { coachId: user.id }
            }
        });
        if (!isCoachOfAssignee) {
            return NextResponse.json({ error: "Unauthorized to edit" }, { status: 403 });
        }
    }

    try {
        const updatedPlan = await prisma.$transaction(async (tx) => {
            // Delete existing structure (Cascades handle workouts/exercises/logs)
            await tx.week.deleteMany({ where: { planId } });

            return await tx.plan.update({
                where: { id: planId },
                data: {
                    name,
                    description,
                    weeks: {
                        create: weeks.map((w: any) => ({
                            weekNumber: w.weekNumber,
                            name: w.name,
                            workouts: {
                                create: w.workouts.map((wd: any) => ({
                                    dayNumber: wd.dayNumber,
                                    dayOfWeek: wd.dayOfWeek,
                                    name: wd.name,
                                    notes: wd.notes,
                                    exercises: {
                                        create: wd.exercises.map((ex: any) => ({
                                            name: ex.name,
                                            sets: ex.sets,
                                            reps: ex.reps,
                                            weightTargetKg: ex.weightTargetKg,
                                            restSeconds: ex.restSeconds,
                                            notes: ex.notes,
                                            order: ex.order,
                                            muscleGroup: ex.muscleGroup,
                                        })),
                                    },
                                })),
                            },
                        })),
                    },
                },
                include: {
                    weeks: {
                        include: { workouts: { include: { exercises: true } } },
                    },
                },
            });
        });

        return NextResponse.json(updatedPlan);
    } catch (err: any) {
        console.error("Plan Update Error:", err);
        return NextResponse.json({ error: err.message || "Failed to edit plan" }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ planId: string }> }
) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { planId } = await params;
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || plan.creatorId !== user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.plan.delete({ where: { id: planId } });
    return NextResponse.json({ success: true });
}
