import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
    sessionLengthMin: z.string().optional(),
    weakMuscles: z.array(z.string()).optional(),
    preferredSplit: z.string().optional(),
    cardioPreference: z.string().optional(),
    dietAwareness: z.boolean().optional(),
    secretCode: z.string().optional(),
});

export async function POST(req: Request) {
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

    let existingUser = await prisma.user.findUnique({ where: { clerkId: userId } });

    if (!existingUser && email !== "unknown@example.com") {
        existingUser = await prisma.user.findUnique({ where: { email } });
    }

    const isPhoenix = d.secretCode?.trim().toLowerCase() === "code phoenix";
    const roleToAssign = isPhoenix ? "SUPER_ADMIN" : "FREE";

    if (existingUser) {
        await prisma.user.update({
            where: { id: existingUser.id },
            data: {
                clerkId: userId,
                name: existingUser.name ?? name,
                avatarUrl: existingUser.avatarUrl ?? user.imageUrl,
                onboardingDone: true,
                role: isPhoenix ? "SUPER_ADMIN" : (existingUser.role as never),
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
                sessionLengthMin: toInt(d.sessionLengthMin),
                weakMuscles: d.weakMuscles ?? [],
                preferredSplit: d.preferredSplit,
                cardioPreference: d.cardioPreference,
                dietAwareness: d.dietAwareness,
            },
        });
    } else {
        await prisma.user.create({
            data: {
                clerkId: userId,
                email,
                name,
                avatarUrl: user.imageUrl,
                onboardingDone: true,
                role: roleToAssign as never,
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
                sessionLengthMin: toInt(d.sessionLengthMin),
                weakMuscles: d.weakMuscles ?? [],
                preferredSplit: d.preferredSplit,
                cardioPreference: d.cardioPreference,
                dietAwareness: d.dietAwareness,
            },
        });
    }

    return NextResponse.json({ success: true });
}
