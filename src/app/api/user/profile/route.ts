import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeCalories, normalizeSleepHours, normalizeSteps, updateDailyMetricTargets } from "@/lib/dailyMetrics";
import { ensureNotificationPreferenceColumns } from "@/lib/notifications";
import { normalizeStoredUploadUrl, withResolvedAvatar } from "@/lib/uploadUrls";
import { z } from "zod";

const storedUploadUrlSchema = z.string().refine(
    (val) =>
        val.startsWith("http://") ||
        val.startsWith("https://") ||
        val.startsWith("/uploads/") ||
        val.startsWith("/api/uploads/"),
    { message: "Invalid avatar URL" }
);

const profileSchema = z.object({
    name: z.string().min(1).max(50).optional(),
    avatarUrl: z.union([storedUploadUrlSchema, z.literal("")]).optional(),
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
    hiddenGoals: z.array(z.string()).optional(),
    notifyOnWorkout: z.boolean().optional(),
    notifyOnCheckIn: z.boolean().optional(),
    notifyOnMetricUpdate: z.boolean().optional(),
    notifyOnCoachMessage: z.boolean().optional(),
    notifyOnPlanUpdate: z.boolean().optional(),
    notifyOnCheckInReview: z.boolean().optional(),
    notifyOnWorkoutFeedback: z.boolean().optional(),
    notifyOnMissedCheckIn: z.boolean().optional(),
    notifyOnMissedWorkout: z.boolean().optional(),
});

export async function PATCH(req: Request) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const parsed = profileSchema.parse(body);
        const normalizedAvatar =
            parsed.avatarUrl !== undefined
                ? parsed.avatarUrl === ""
                    ? null
                    : normalizeStoredUploadUrl(parsed.avatarUrl)
                : undefined;

        await ensureNotificationPreferenceColumns();

        let updated;
        try {
            updated = await prisma.user.update({
                where: { clerkId: userId },
                data: {
                    ...(parsed.name !== undefined && { name: parsed.name }),
                    ...(parsed.avatarUrl !== undefined && { avatarUrl: normalizedAvatar }),
                    ...(parsed.goal !== undefined && { goal: parsed.goal }),
                    ...(parsed.trainingDaysPerWeek !== undefined && { trainingDaysPerWeek: parsed.trainingDaysPerWeek }),
                    ...(parsed.experienceLevel !== undefined && { experienceLevel: parsed.experienceLevel }),
                    ...(parsed.trainingLocation !== undefined && { trainingLocation: parsed.trainingLocation }),
                    ...(parsed.targetWeightKg !== undefined && { targetWeightKg: Math.round(parsed.targetWeightKg * 100) / 100 }),
                    ...(parsed.weightKg !== undefined && { weightKg: Math.round(parsed.weightKg * 100) / 100 }),
                    ...(parsed.hiddenGoals !== undefined && { hiddenGoals: parsed.hiddenGoals }),
                    ...(parsed.notifyOnWorkout !== undefined && { notifyOnWorkout: parsed.notifyOnWorkout }),
                    ...(parsed.notifyOnCheckIn !== undefined && { notifyOnCheckIn: parsed.notifyOnCheckIn }),
                    ...(parsed.notifyOnMetricUpdate !== undefined && { notifyOnMetricUpdate: parsed.notifyOnMetricUpdate }),
                    ...(parsed.notifyOnCoachMessage !== undefined && { notifyOnCoachMessage: parsed.notifyOnCoachMessage }),
                    ...(parsed.notifyOnPlanUpdate !== undefined && { notifyOnPlanUpdate: parsed.notifyOnPlanUpdate }),
                    ...(parsed.notifyOnCheckInReview !== undefined && { notifyOnCheckInReview: parsed.notifyOnCheckInReview }),
                    ...(parsed.notifyOnWorkoutFeedback !== undefined && { notifyOnWorkoutFeedback: parsed.notifyOnWorkoutFeedback }),
                    ...(parsed.notifyOnMissedCheckIn !== undefined && { notifyOnMissedCheckIn: parsed.notifyOnMissedCheckIn }),
                    ...(parsed.notifyOnMissedWorkout !== undefined && { notifyOnMissedWorkout: parsed.notifyOnMissedWorkout }),
                },
            });
        } catch (dbErr) {
            console.warn("[Profile PATCH] Update failed, retrying without hiddenGoals field:", dbErr);
            updated = await prisma.user.update({
                where: { clerkId: userId },
                data: {
                    ...(parsed.name !== undefined && { name: parsed.name }),
                    ...(parsed.avatarUrl !== undefined && { avatarUrl: normalizedAvatar }),
                    ...(parsed.goal !== undefined && { goal: parsed.goal }),
                    ...(parsed.trainingDaysPerWeek !== undefined && { trainingDaysPerWeek: parsed.trainingDaysPerWeek }),
                    ...(parsed.experienceLevel !== undefined && { experienceLevel: parsed.experienceLevel }),
                    ...(parsed.trainingLocation !== undefined && { trainingLocation: parsed.trainingLocation }),
                    ...(parsed.targetWeightKg !== undefined && { targetWeightKg: Math.round(parsed.targetWeightKg * 100) / 100 }),
                    ...(parsed.weightKg !== undefined && { weightKg: Math.round(parsed.weightKg * 100) / 100 }),
                },
            });
        }

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

        return NextResponse.json(withResolvedAvatar(updated));
    } catch (err) {
        console.error(err);
        if (err instanceof z.ZodError) {
            return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid profile data" }, { status: 400 });
        }
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }
}
