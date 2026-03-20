import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const planSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    type: z.enum(["USER_CREATED", "PREBUILT"]).default("USER_CREATED"),
    weeks: z.array(z.object({
        weekNumber: z.number(),
        name: z.string().optional(),
        workouts: z.array(z.object({
            dayNumber: z.number(),
            dayOfWeek: z.number().min(0).max(6).optional(),
            name: z.string(),
            notes: z.string().optional(),
            exercises: z.array(z.object({
                name: z.string(),
                sets: z.number(),
                reps: z.string(),
                weightTargetKg: z.number().optional(),
                restSeconds: z.number().optional(),
                notes: z.string().optional(),
                order: z.number().default(0),
                muscleGroup: z.string().optional(),
            })),
        })),
    })),
});

// GET all plans for the user
export async function GET() {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const userPlans = await prisma.userPlan.findMany({
        where: { userId: user.id },
        include: {
            plan: {
                include: {
                    weeks: {
                        include: { workouts: { include: { exercises: true } } },
                        orderBy: { weekNumber: "asc" },
                    },
                    _count: { select: { weeks: true } },
                },
            },
        },
        orderBy: { startedAt: "desc" },
    });

    return NextResponse.json(userPlans);
}

// POST create a new plan
export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const parsed = planSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { name, description, type, weeks } = parsed.data;

    const plan = await prisma.plan.create({
        data: {
            name,
            description,
            type: type as never,
            creatorId: user.id,
            weeks: {
                create: weeks.map((w) => ({
                    weekNumber: w.weekNumber,
                    name: w.name,
                    workouts: {
                        create: w.workouts.map((wd) => ({
                            dayNumber: wd.dayNumber,
                            dayOfWeek: wd.dayOfWeek,
                            name: wd.name,
                            notes: wd.notes,
                            exercises: {
                                create: wd.exercises.map((ex) => ({
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
    });

    // Assign plan to user (not active by default)
    await prisma.userPlan.create({
        data: { userId: user.id, planId: plan.id },
    });

    return NextResponse.json(plan, { status: 201 });
}
