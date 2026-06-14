import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeCalories, normalizeSleepHours, normalizeSteps, updateDailyMetricTargets } from "@/lib/dailyMetrics";
import { z } from "zod";

const profileSchema = z.object({
    name: z.string().min(1).max(50).optional(),
    avatarUrl: z.string().url().optional().or(z.literal("")),
    // Goals fields
    goal: z.enum(["GAIN_MUSCLE", "LOSE_WEIGHT", "RECOMPOSITION", "STRENGTH"]).optional(),
    trainingDaysPerWeek: z.number().int().min(1).max(7).optional(),
    experienceLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
    trainingLocation: z.enum(["GYM", "HOME"]).optional(),
    targetWeightKg: z.number().optional(),
    weightKg: z.number().optional(),
    targetCalories: z.number().nullable().optional(),
    targetSteps: z.number().nullable().optional(),
    targetSleepHours: z.number().nullable().optional(),
});

export async function PATCH(req: Request) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const parsed = profileSchema.parse(body);

        const updated = await prisma.user.update({
            where: { clerkId: userId },
            data: {
                ...(parsed.name !== undefined && { name: parsed.name }),
                ...(parsed.avatarUrl !== undefined && { avatarUrl: parsed.avatarUrl === "" ? null : parsed.avatarUrl }),
                ...(parsed.goal !== undefined && { goal: parsed.goal }),
                ...(parsed.trainingDaysPerWeek !== undefined && { trainingDaysPerWeek: parsed.trainingDaysPerWeek }),
                ...(parsed.experienceLevel !== undefined && { experienceLevel: parsed.experienceLevel }),
                ...(parsed.trainingLocation !== undefined && { trainingLocation: parsed.trainingLocation }),
                ...(parsed.targetWeightKg !== undefined && { targetWeightKg: Math.round(parsed.targetWeightKg * 100) / 100 }),
                ...(parsed.weightKg !== undefined && { weightKg: Math.round(parsed.weightKg * 100) / 100 }),
            },
        });

        if (
            parsed.targetCalories !== undefined ||
            parsed.targetSteps !== undefined ||
            parsed.targetSleepHours !== undefined
        ) {
            await updateDailyMetricTargets(updated.id, {
                targetCalories: normalizeCalories(parsed.targetCalories),
                targetSteps: normalizeSteps(parsed.targetSteps),
                targetSleepHours: normalizeSleepHours(parsed.targetSleepHours),
            });
        }

        return NextResponse.json(updated);
    } catch (err) {
        console.error(err);
        if (err instanceof z.ZodError) {
            return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid profile data" }, { status: 400 });
        }
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }
}
