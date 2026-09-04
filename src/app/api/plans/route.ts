import { NextResponse } from "next/server";
import { prisma, ensureDbSchema } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/apiAuth";
import { z } from "zod";
import { generateUniquePlanShareCode } from "@/lib/planShareCode";
import { activeWorkoutWhere } from "@/lib/planWorkouts";
import { isCoachRole } from "@/lib/roles";
import { triggerAchievementSync } from "@/lib/achievements";

const planSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    type: z.enum(["USER_CREATED", "PREBUILT"]).default("USER_CREATED"),
    // 0=Mon … 6=Sun — when provided, Week 1 starts on the next occurrence of that weekday
    weekStartDay: z.number().int().min(0).max(6).optional().nullable(),
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
                targetDurationSec: z.number().optional().nullable(),
                targetDistanceMeters: z.number().optional().nullable(),
                targetHeightCm: z.number().optional().nullable(),
                targetRpe: z.number().optional().nullable(),
                targetResistance: z.number().optional().nullable(),
                targetInclinePct: z.number().optional().nullable(),
                restSeconds: z.number().optional(),
                notes: z.string().optional(),
                order: z.number().default(0),
                muscleGroup: z.string().optional(),
            })),
        })),
    })),
});

/**
 * Given a day-of-week (0=Mon … 6=Sun) return the Date for the
 * next occurrence of that day (today if today already matches).
 */
function nextWeekdayDate(targetDow: number): Date {
    const now = new Date();
    // JS getDay(): 0=Sun, 1=Mon … 6=Sat → convert to Mon=0 … Sun=6
    const jsDow = now.getDay();
    const todayMon0 = jsDow === 0 ? 6 : jsDow - 1;
    let daysUntil = targetDow - todayMon0;
    if (daysUntil < 0) daysUntil += 7;
    const target = new Date(now);
    target.setDate(now.getDate() + daysUntil);
    target.setHours(0, 0, 0, 0);
    return target;
}

// GET all plans for the user
export async function GET(req: Request) {
    await ensureDbSchema();
    const authResult = await requireActiveUser(req);
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const userPlans = await prisma.userPlan.findMany({
        where: { userId: user.id },
        include: {
            plan: {
                include: {
                    weeks: {
                        include: {
                            workouts: {
                                where: activeWorkoutWhere(),
                                include: { exercises: { where: { isCustom: false }, orderBy: { order: "asc" } } },
                                orderBy: { dayNumber: "asc" },
                            },
                        },
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
    const authResult = await requireActiveUser(req);
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    await ensureDbSchema();

    const body = await req.json();
    const parsed = planSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { name, description, type, weekStartDay, weeks } = parsed.data;
    const effectiveWeekStartDay = weeks.length <= 1 ? null : weekStartDay;
    const planStartedAt = (effectiveWeekStartDay != null) ? nextWeekdayDate(effectiveWeekStartDay) : new Date();
    
    const shareCode = await generateUniquePlanShareCode();

    try {
    const plan = await prisma.plan.create({
        data: {
            name,
            description,
            type: type as never,
            creatorId: user.id,
            originalCreatorId: user.id,
            shareCode,
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
                                    targetDurationSec: ex.targetDurationSec ?? undefined,
                                    targetDistanceMeters: ex.targetDistanceMeters ?? undefined,
                                    targetHeightCm: ex.targetHeightCm ?? undefined,
                                    targetRpe: ex.targetRpe ?? undefined,
                                    targetResistance: ex.targetResistance ?? undefined,
                                    targetInclinePct: ex.targetInclinePct ?? undefined,
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

    // Assign plan to client accounts only — coaches build templates without an active assignment
    if (!isCoachRole(user.role)) {
        const hasActivePlan = await prisma.userPlan.findFirst({
            where: { userId: user.id, isActive: true },
        });

        await prisma.userPlan.create({
            data: {
                userId: user.id,
                planId: plan.id,
                isActive: !hasActivePlan,
                startedAt: planStartedAt,
            },
        });
    }

    triggerAchievementSync(user.id);

    return NextResponse.json(plan, { status: 201 });
    } catch (error) {
        console.error("[Plans POST] Failed to create plan:", error);
        return NextResponse.json(
            { error: "The plan could not be saved. Please try again." },
            { status: 500 },
        );
    }
}
