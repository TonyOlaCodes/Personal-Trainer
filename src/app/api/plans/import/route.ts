import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { code } = await req.json();
    if (!code) return NextResponse.json({ error: "Share code is required" }, { status: 400 });

    const originalPlan = await prisma.plan.findUnique({
        where: { shareCode: code.toUpperCase().trim() },
        include: {
            creator: true,
            weeks: {
                include: {
                    workouts: {
                        include: { exercises: true },
                    },
                },
            },
        },
    });

    if (!originalPlan) return NextResponse.json({ error: "Plan not found! Verify your share code." }, { status: 404 });

    // Clone it
    const clonedPlan = await prisma.plan.create({
        data: {
            name: `${originalPlan.name} (Imported)`,
            description: originalPlan.description,
            type: "USER_CREATED",
            creatorId: user.id,
            weeks: {
                create: originalPlan.weeks.map(w => ({
                    weekNumber: w.weekNumber,
                    name: w.name,
                    workouts: {
                        create: w.workouts.map(wd => ({
                            dayNumber: wd.dayNumber,
                            dayOfWeek: wd.dayOfWeek,
                            name: wd.name,
                            notes: wd.notes,
                            exercises: {
                                create: wd.exercises.map(ex => ({
                                    name: ex.name,
                                    sets: ex.sets,
                                    reps: ex.reps,
                                    weightTargetKg: ex.weightTargetKg,
                                    restSeconds: ex.restSeconds,
                                    notes: ex.notes,
                                    order: ex.order,
                                    muscleGroup: ex.muscleGroup,
                                }))
                            }
                        }))
                    }
                }))
            }
        }
    });

    await prisma.userPlan.create({
        data: { userId: user.id, planId: clonedPlan.id }
    });

    return NextResponse.json({ 
        author: originalPlan.creator?.name || "Anonymous Athlete",
        id: clonedPlan.id
    }, { status: 200 });
}
