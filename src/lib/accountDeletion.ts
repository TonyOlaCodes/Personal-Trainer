import type { Prisma, PrismaClient, Role } from "@prisma/client";
import { markUserAccountDeleted } from "@/lib/userDeactivation";

const emptyList: string[] = [];

export async function anonymizeDeletedUserAccount(
    prisma: PrismaClient,
    user: { id: string; clerkId: string; email: string; name?: string | null; role: Role; coachId?: string | null }
) {
    const now = new Date();
    const deletedIdentity = `deleted-${user.id}`;
    const isCoachAccount = user.role === "COACH" || user.role === "SUPER_ADMIN";

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.reaction.deleteMany({ where: { userId: user.id } });
        await tx.message.deleteMany({
            where: {
                OR: [
                    { senderId: user.id },
                    { receiverId: user.id },
                    { mentions: { has: user.id } },
                ],
            },
        });
        await tx.checkIn.deleteMany({ where: { userId: user.id } });
        await tx.workoutLog.deleteMany({ where: { userId: user.id } });
        await tx.userPlan.deleteMany({ where: { userId: user.id } });

        await tx.accessCode.updateMany({
            where: { usedById: user.id },
            data: { isActive: false, status: "expired" },
        });
        await tx.accessCode.updateMany({
            where: { generatedBy: user.id },
            data: { isActive: false, expiresAt: now },
        });

        if (isCoachAccount) {
            await tx.user.updateMany({
                where: { coachId: user.id },
                data: { coachId: null },
            });
        }

        await tx.plan.deleteMany({ where: { creatorId: user.id } });

        await tx.user.update({
            where: { id: user.id },
            data: {
                clerkId: `${deletedIdentity}-${Date.now()}`,
                email: `${deletedIdentity}@deleted.local`,
                name: user.name ?? "Deleted account",
                avatarUrl: null,
                role: "FREE",
                onboardingDone: false,
                goal: null,
                trainingDaysPerWeek: null,
                experienceLevel: null,
                trainingLocation: null,
                equipment: emptyList,
                hasInjuries: null,
                injuryDetails: null,
                age: null,
                heightCm: null,
                weightKg: null,
                targetWeightKg: null,
                sessionLengthMin: null,
                likedExercises: emptyList,
                dislikedExercises: emptyList,
                weakMuscles: emptyList,
                benchPressKg: null,
                squatKg: null,
                deadliftKg: null,
                ohpKg: null,
                cardioPreference: null,
                dietAwareness: null,
                preferredSplit: null,
                coachId: isCoachAccount ? null : user.coachId ?? null,
            },
        });

        await markUserAccountDeleted(user, tx);
    });
}
