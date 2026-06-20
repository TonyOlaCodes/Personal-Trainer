import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redeemAccessCodeForUser } from "@/lib/accessCodes";
import { anonymizeDeletedUserAccount } from "@/lib/accountDeletion";
import { normalizeCalories, normalizeSleepHours, normalizeSteps, updateDailyMetricTargets } from "@/lib/dailyMetrics";
import { getUserDeactivationStatusByClerkId } from "@/lib/userDeactivation";
import { defaultHomeForRole } from "@/lib/roles";
import { z } from "zod";

const schema = z.object({
    goal: z.enum(["GAIN_MUSCLE", "LOSE_WEIGHT", "RECOMPOSITION", "STRENGTH"]).optional(),
    trainingDaysPerWeek: z.number().min(2).max(6).optional(),
    experienceLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
    trainingLocation: z.enum(["GYM", "HOME"]).optional(),
    hasInjuries: z.boolean().optional(),
    injuryDetails: z.string().optional(),
    age: z.string().optional(),
    heightCm: z.string().optional(),
    weightKg: z.string().optional(),
    targetWeightKg: z.string().optional(),
    cardioPreference: z.string().optional(),
    dietAwareness: z.boolean().optional(),
    targetCalories: z.string().optional(),
    targetSteps: z.string().optional(),
    targetSleepHours: z.string().optional(),
    secretCode: z.string().optional(),
});

export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        const user = await currentUser();
        if (!userId || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

        const d = parsed.data;

        const toFloat = (v?: string) => (v && v !== "" ? parseFloat(v) : null);
        const toInt = (v?: string) => (v && v !== "" ? parseInt(v) : null);

        const email = user.emailAddresses[0]?.emailAddress ?? "unknown@example.com";
        const name = user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : null;

        const existingUser = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (existingUser && await getUserDeactivationStatusByClerkId(userId)) {
            return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
        }

        const accessCode = d.secretCode?.trim();
        let savedUserId = existingUser?.id;

        if (existingUser) {
            const savedUser = await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    clerkId: userId,
                    name: existingUser.name ?? name,
                    avatarUrl: existingUser.avatarUrl ?? user.imageUrl,
                    onboardingDone: true,
                    role: existingUser.role as never,
                    goal: d.goal as never,
                    trainingDaysPerWeek: d.trainingDaysPerWeek,
                    experienceLevel: d.experienceLevel as never,
                    trainingLocation: d.trainingLocation as never,
                    hasInjuries: d.hasInjuries,
                    injuryDetails: d.injuryDetails,
                    age: toInt(d.age),
                    heightCm: toFloat(d.heightCm),
                    weightKg: toFloat(d.weightKg),
                    targetWeightKg: toFloat(d.targetWeightKg),
                    cardioPreference: d.cardioPreference,
                    dietAwareness: d.dietAwareness,
                },
            });
            savedUserId = savedUser.id;
        } else {
            if (email !== "unknown@example.com") {
                const staleEmailUser = await prisma.user.findUnique({ where: { email } });
                if (staleEmailUser && staleEmailUser.clerkId !== userId) {
                    await anonymizeDeletedUserAccount(prisma, staleEmailUser);
                }
            }

            const savedUser = await prisma.user.create({
                data: {
                    clerkId: userId,
                    email,
                    name,
                    avatarUrl: user.imageUrl,
                    onboardingDone: true,
                    role: "FREE",
                    goal: d.goal as never,
                    trainingDaysPerWeek: d.trainingDaysPerWeek,
                    experienceLevel: d.experienceLevel as never,
                    trainingLocation: d.trainingLocation as never,
                    hasInjuries: d.hasInjuries,
                    injuryDetails: d.injuryDetails,
                    age: toInt(d.age),
                    heightCm: toFloat(d.heightCm),
                    weightKg: toFloat(d.weightKg),
                    targetWeightKg: toFloat(d.targetWeightKg),
                    cardioPreference: d.cardioPreference,
                    dietAwareness: d.dietAwareness,
                },
            });
            savedUserId = savedUser.id;
        }

        if (accessCode && savedUserId) {
            const result = await redeemAccessCodeForUser(prisma, { id: savedUserId }, accessCode);
            if ("error" in result) {
                return NextResponse.json({ error: result.error }, { status: result.status });
            }
        }

        if (savedUserId) {
            await updateDailyMetricTargets(savedUserId, {
                targetCalories: normalizeCalories(toInt(d.targetCalories)),
                targetSteps: normalizeSteps(toInt(d.targetSteps)),
                targetSleepHours: normalizeSleepHours(toFloat(d.targetSleepHours)),
            });
        }

        const finalUser = savedUserId
            ? await prisma.user.findUnique({ where: { id: savedUserId }, select: { role: true } })
            : null;
        const role = finalUser?.role ?? "FREE";

        return NextResponse.json({
            success: true,
            role,
            redirectTo: defaultHomeForRole(role),
        });
    } catch (err) {
        console.error("[Onboarding] Failed to save profile:", err);
        return NextResponse.json(
            { error: "Could not save profile. Check the database connection and try again." },
            { status: 500 }
        );
    }
}
